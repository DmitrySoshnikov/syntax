/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from '../grammar/grammar-symbol';
import SetsGenerator from '../sets-generator';
import TablePrinter from '../table-printer';
import {EOF} from '../special-symbols';
import colors from 'colors';

/**
 * LL parsing table.
 */
export default class LLParsingTable {

  /**
   * Builds an LL parsing table for a given grammar.
   */
  constructor({grammar}) {
    this._grammar = grammar;
    this._setsGenerator = new SetsGenerator({grammar});
    this._table = this._build();

    this._tableTokens = grammar.getTerminals()
      .concat(grammar.getTokens(), new GrammarSymbol(EOF));
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
        row[stateLabel].push(
          this._table[nonTerminal][tokenSymbols[k]] || '-'
        );
      }
      printer.push(row);
    }

    console.info(printer.toString());
    console.info('');
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
        table[lhsSymbol][terminal] = production.getNumber();
      }
    }

    return table;
  }
};