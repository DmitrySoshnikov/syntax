/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from '../grammar/grammar-symbol';
import SetsGenerator from '../sets-generator';
import TablePrinter from '../table-printer';
import {EOF} from '../special-symbols';
import colors from 'colors';
import debug from '../debug';

/**
 * LL parsing table.
 *
 * Example for a left-factored calculator grammar:
 *
 *   1. E -> T E'
 *
 *   2. E' -> "+" T E'
 *   3.     | ε
 *
 *   4. T -> F T'
 *
 *   5. T' -> "*" F T'
 *   6.     | ε
 *
 *   7. F -> "id"
 *   8.    | "(" E ")"
 *
 * LL(1) parsing table:
 *
 * ┌────┬─────┬─────┬──────┬─────┬─────┬───┐
 * │    │ "+" │ "*" │ "id" │ "(" │ ")" │ $ │
 * ├────┼─────┼─────┼──────┼─────┼─────┼───┤
 * │ E  │ -   │ -   │ 1    │ 1   │ -   │ - │
 * ├────┼─────┼─────┼──────┼─────┼─────┼───┤
 * │ E' │ 2   │ -   │ -    │ -   │ 3   │ 3 │
 * ├────┼─────┼─────┼──────┼─────┼─────┼───┤
 * │ T  │ -   │ -   │ 4    │ 4   │ -   │ - │
 * ├────┼─────┼─────┼──────┼─────┼─────┼───┤
 * │ T' │ 6   │ 5   │ -    │ -   │ 6   │ 6 │
 * ├────┼─────┼─────┼──────┼─────┼─────┼───┤
 * │ F  │ -   │ -   │ 7    │ 8   │ -   │ - │
 * └────┴─────┴─────┴──────┴─────┴─────┴───┘
 *
 * Notes:
 *
 *   - Row headers are grammar non-terminals
 *
 *   - Columns are the grammar tokens
 *
 *   - The entries are the next production number to apply
 *     for derivation (replacing a non-terminal on the stack with
 *     its right-hand side).
 *
 *   - The entries are build from "predict-sets" (combination of the
 *     "first", and "follow" sets).
 */
export default class LLParsingTable {
  /**
   * Builds an LL parsing table for a given grammar.
   */
  constructor({grammar}) {
    this._grammar = grammar;
    this._setsGenerator = new SetsGenerator({grammar});

    debug.time('Building LL parsing table');

    this._tableTokens = grammar
      .getTerminals()
      .concat(grammar.getTokens(), GrammarSymbol.get(EOF));

    this._table = this._build();

    debug.timeEnd('Building LL parsing table');
  }

  get() {
    return this._table;
  }

  print() {
    this._grammar.print();

    console.info(`\n${this._grammar.getMode().toString()} parsing table:\n`);

    let tokenSymbols = this._tableTokens.map(token => token.getSymbol());

    let printer = new TablePrinter({
      head: [''].concat(tokenSymbols),
    });

    for (let nonTerminal in this._table) {
      let stateLabel = colors.blue(nonTerminal);
      let row = {[stateLabel]: []};
      for (let k = 0; k < tokenSymbols.length; k++) {
        let entry = this._table[nonTerminal][tokenSymbols[k]] || '';

        if (this.entryHasConflict(entry)) {
          entry = colors.red(entry);
        }

        row[stateLabel].push(entry);
      }
      printer.push(row);
    }

    console.info(printer.toString());
    console.info('');
  }

  /**
   * Whether the table/grammar has conflicts.
   */
  hasConflicts() {
    return this._hasConflicts;
  }

  /**
   * Returns table/grammar conflicts.
   */
  getConflicts() {
    if (!this._conflicts) {
      this._conflicts = this._analyzeConfilcts();
      this._hasConflicts = Object.keys(this._conflicts).length !== 0;
    }
    return this._conflicts;
  }

  _analyzeConfilcts() {
    let conflicts = Object.create(null);

    for (let nonTerminal in this._table) {
      let row = this._table[nonTerminal];

      for (let token in row) {
        let entry = row[token];

        if (!this.entryHasConflict(entry)) {
          continue;
        }

        if (!conflicts[nonTerminal]) {
          conflicts[nonTerminal] = {};
        }

        conflicts[nonTerminal][token] = entry;
      }
    }

    return conflicts;
  }

  /**
   * Builds the LL parsing table from First and Follow sets.
   *
   * To build an LL(1) parsing table we need the Predict set,
   * however the Predict set is just a combination of the
   * First set of the production, plus the Follow set if the
   * production derives epsilon. So in building the table
   * we use First and Follow sets directly delegating to needed
   * parts during the table construction.
   */
  _build() {
    let table = {};

    for (let production of this._grammar.getProductions()) {
      let lhs = production.getLHS();
      let rhs = production.getRHS();
      let lhsSymbol = lhs.getSymbol();

      // Initialize columns for this non-terminal.
      if (!table[lhsSymbol]) {
        table[lhsSymbol] = {};
      }

      // All productions goes under the terminal column, if
      // this terminal is not epsilon. Otherwise, an ε-production
      // goes under the columns from the Follow set of LHS.

      let set = !production.isEpsilon()
        ? this._setsGenerator.firstOfRHS(rhs)
        : this._setsGenerator.followOf(lhs);

      for (let terminal in set) {
        this._putProductionNumber(
          table[lhsSymbol],
          terminal,
          production.getNumber()
        );
      }
    }

    return table;
  }

  entryHasConflict(entry) {
    return entry.includes('/');
  }

  /**
   * If we can any conflict ("FIRST/FIRST", "FIRST/FOLLOW", "FOLLOW/FOLLOW"),
   * the table entry records via `/`, e.g. "2/5" - conflict, ambiguous choice
   * of the next grammar rule.
   */
  _putProductionNumber(row, column, entry) {
    let previousEntry = row[column];

    if (previousEntry === entry) {
      return;
    }

    // Exclude duplicates for possibly the same conflict entry.
    if (previousEntry) {
      previousEntry = previousEntry.split('/');
      if (!previousEntry.includes(entry)) {
        previousEntry.push(entry);
      }
      entry = previousEntry.join('/');
    }

    row[column] = entry.toString();
  }
}
