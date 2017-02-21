/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import {MODES as GRAMMAR_MODE} from '../grammar/grammar-mode';
import GrammarSymbol from '../grammar/grammar-symbol';
import TablePrinter from '../table-printer';
import {EOF} from '../special-symbols';
import colors from 'colors';
import debug from '../debug';

/**
 * The LR parsing table is built by traversing the graph of the
 * canonical collection of LR items. Rows of the table correspond to
 * the state (closure) numbers, and columns are terminals (for "action"
 * part) and non-terminals (for "goto" part).
 *
 * For the example grammar (where S' -> S is the augmented production):
 *
 *  +------------+
 *  | S' -> S    |
 *  +------------+
 *  | S -> A A   |
 *  | A -> "a" A |
 *  |    | "b"   |
 *  +------------+
 *
 * The LR(0) parsing table, which is used by LR(0) and SLR(1) parsers,
 * looks like this:
 *
 * State      Action            Goto
 * +---+-----+-----+-----++-----+-----+
 * |   │ "a" │ "b" │  $  ││  S  │  A  │
 * +---+-----+-----+-----++-----+-----+
 * | 0 │ s2  │ s4  │     ││  3  │  1  │
 * +---+-----+-----+-----++-----+-----+
 * | 1 │ s2  │ s4  │     ││     │  5  │
 * +---+-----+-----+-----++-----+-----+
 * | 2 │ s2  │ s4  │     ││     │  6  │
 * +---+-----+-----+-----++-----+-----+
 * | 3 │     │     │ acc ││     │     │
 * +---+-----+-----+-----++-----+-----+
 * | 4 │ r3  │ r3  │ r3  ││     │     │
 * +---+-----+-----+-----++-----+-----+
 * | 5 │ r1  │ r1  │ r1  ││     │     │
 * +---+-----+-----+-----++-----+-----+
 * | 6 │ r2  │ r2  │ r2  ││     │     │
 * +---+-----+-----+-----++-----+-----+
 *
 * Note: for LR(1) items used by LALR(1) and CLR(1) number of reduce steps
 * may decrease. Also number of states may increase in case of CLR(1).
 *
 *   - State: number of a state (closure) in the graph
 *
 *   Action:
 *
 *   - s<n> - Shift<n>: "shift" action (move a symbol onto the stack) and
 *     transit to the state n next
 *
 *   - r<k> - Reduce<k>: "reduce" action (replace RHS of a production <k>
 *     which is on top of the stack, with its LHS.
 *
 *   - acc - "accept" action, successful parse.
 *
 *   Goto:
 *
 *   - <n> - goto to state <n> in the graph.
 *
 * Examples:
 *
 *   - 0:A -> 3: if we're in the state 0, and see non-terminal A, go to
 *     the state 3.
 *
 *   - 1:"a" -> s2: if we're in the state 1, and see the "a" terminal,
 *     shift it from buffer onto the stack, and go to the state 2.
 *
 *   - 5:"b" -> r2: if we're in the state 5, and see the "b" terminal,
 *     reduce the RHS of the production 2 on top of the stack to its
 *     LHS non-terminal.
 */

/**
 * Type of an entry in the parsing table.
 */
const EntryType = {
  ERROR       : 0,
  GOTO        : 1,
  SHIFT       : 2,
  REDUCE      : 3,
  ACCEPT      : 4,
  SR_CONFLICT : 5,
  RR_CONFLICT : 6,
};

/**
 * LR parsing table class.
 */
export default class LRParsingTable {

  /**
   * The table is built from the canonical collection,
   * which was built for the specific grammar.
   */
  constructor({canonicalCollection, grammar, resolveConflicts = false}) {
    this._canonicalCollection = canonicalCollection;
    this._grammar = grammar;
    this._shouldResolveConflicts = resolveConflicts;

    debug.time('Building LR parsing table');

    this._action = grammar.getTerminals()
      .concat(grammar.getTokens(), GrammarSymbol.get(EOF));

    this._goto = grammar.getNonTerminals();
    this._table = {};
    this._build();
    debug.timeEnd('Building LR parsing table');
  }

  get() {
    return this._table;
  }

  print() {
    this._grammar.print();

    console.info(`\n${this._grammar.getMode().toString()} parsing table:\n`);

    let actionSymbols = this._action
      .map(actionSymbol => actionSymbol.getSymbol());

    let nonTerminals = this._grammar
      .getNonTerminals()
      .map(nonTerminal => nonTerminal.getSymbol());

    let printer = new TablePrinter({
      head: [''].concat(actionSymbols, nonTerminals),
    });

    Object.keys(this._table).forEach(stateNumber => {
      let tableRow = this._table[stateNumber];
      let stateLabel = colors.blue(stateNumber);
      let row = {[stateLabel]: []};

      // Action part.
      actionSymbols.forEach(actionSymbol => {
        let entry = tableRow[actionSymbol] || '';

        if (this._hasConflict(entry)) {
          entry = colors.red(entry);
        } else if (entry === 'acc') {
          entry = colors.green(entry);
        }

        row[stateLabel].push(entry);
      });

      // Goto part.
      nonTerminals.forEach(nonTerminal => {
        row[stateLabel].push(tableRow[nonTerminal] || '');
      });

      printer.push(row);
    });

    console.info(printer.toString());
    console.info('');
  }

  static get EntryType() {
    return EntryType;
  }

  static getEntryType(entry) {
    if (typeof entry === 'number') {
      return EntryType.GOTO;
    } else if (entry.indexOf('/') !== -1) {

      let entryTypes = entry.split('/')
        .map(e => LRParsingTable.getEntryType(e));

      if (entryTypes.every(type => type === EntryType.REDUCE)) {
        return EntryType.RR_CONFLICT;
      }

      return EntryType.SR_CONFLICT;

    } else if (entry[0] === 's') {
      return EntryType.SHIFT;
    } else if (entry[0] === 'r') {
      return EntryType.REDUCE;
    } else if (entry === 'acc') {
      return EntryType.ACCEPT;
    }

    return EntryType.ERROR;
  }

  _hasConflict(entry) {
    let entryType = LRParsingTable.getEntryType(entry);
    return entryType === EntryType.RR_CONFLICT ||
      entryType === EntryType.SR_CONFLICT;
  }

  _build() {
    this._canonicalCollection.getStates().forEach(state => {
      // Fill actions and goto for this state (row).
      let row = this._table[state.getNumber()] = {};

      state.getItems().forEach(item => {

        // For final item we should "reduce". In LR(0) type we
        // reduce unconditionally for every terminal, in other types
        // e.g. SLR(1) consider lookahead (follow) sets.
        if (item.isFinal()) {
          let production = item.getProduction();

          // For the final item of the augmented production,
          // the action is "acc" (accept).
          if (production.isAugmented()) {
            row[EOF] = 'acc';
          } else {
            // Otherwise, reduce.
            this._action.forEach(terminal => {
              if (this._shouldReduce(item, terminal)) {
                this._putActionEntry(
                  row,
                  terminal.getSymbol(),
                  `r${production.getNumber()}`
                );
              }
            });
          }

        } else {
          let transitionSymbol = item.getCurrentSymbol();
          let rawSymbol = transitionSymbol.getSymbol();
          let nextState = item.goto().getNumber();

          // Other terminals do "shift" action and go to the next state,
          // and non-terminals just go to the next
          if (this._grammar.isTokenSymbol(transitionSymbol)) {
            this._putActionEntry(
              row,
              transitionSymbol.getSymbol(),
              `s${nextState}`
            );
          } else {
            row[transitionSymbol.getSymbol()] = nextState;
          }
        }
      });

      if (Object.keys(row).some(symbol => this._hasConflict(row[symbol]))) {
        this._resolveConflicts(state, row);
      }
    });
  }

  _resolveConflicts(state, row) {
    if (Object.keys(this._grammar.getOperators()) === 0 &&
        !this._shouldResolveConflicts) {
      return;
    }

    Object.keys(row).forEach(symbol => {
      let entryType = LRParsingTable.getEntryType(row[symbol]);

      if (entryType === EntryType.SR_CONFLICT) {
        this._resolveSRConflict(row, symbol);
      } else if (entryType === EntryType.RR_CONFLICT) {
        this._resolveRRConflict(row, symbol);
      }
    });
  }

  _resolveSRConflict(row, symbol) {
    let entry = row[symbol];
    let operators = this._grammar.getOperators();

    let [reducePart, shiftPart] = this._splitSRParts(entry);

    // Default resolution is to shift if no precedence is specified.
    if (!operators.hasOwnProperty(symbol)) {
      if (this._shouldResolveConflicts) {
        row[symbol] = shiftPart;
      }
      return;
    }

    // Else, working with operators precedence.

    let {
      precedence: symbolPrecedence,
      assoc: symbolAssoc,
    } = operators[symbol];

    let productionPrecedence = this._grammar
      .getProduction(reducePart.slice(1))
      .getPrecedence();

    // 1. If production's precedence is higher, the choice is to reduce:
    //
    //   R: E -> E * E • (reduce since `*` > `+`)
    //   S: E -> E • + E
    //
    if (productionPrecedence > symbolPrecedence) {
      row[symbol] = reducePart;
    }

    // 2. If the symbol's precedence is higher, the choice is to shift:
    //
    //   E -> E + E •
    //   E -> E • * E (shift since `*` > `+`)
    //
    else if (symbolPrecedence > productionPrecedence) {
      row[symbol] = shiftPart;
    }

    // 3. If they have equal precedence, the choice is made based on the
    // associativity of that precedence level:
    //
    //   E -> E * E • (choose to reduce since `*` is left-associative)
    //   E -> E • * E
    //
    // This case we want `id * id * id` to be left-associative, i.e.
    // `(id * id) * id`, but not right-associative, that would be
    // `id * (id * id)`.
    //
    else if (productionPrecedence === symbolPrecedence &&
             productionPrecedence !== 0 &&
             symbolPrecedence !== 0) {

      // Left-assoc.
      if (symbolAssoc === 'left') {
        row[symbol] = reducePart;
      } else if (symbolAssoc === 'right') {
        row[symbol] = shiftPart;
      } else if (symbolAssoc === 'nonassoc') {
        // No action on `nonassoc`.
        delete rows[symbol];
      }
    }
  }

  _resolveRRConflict(row, symbol) {
    if (!this._shouldResolveConflicts) {
      return;
    }

    let entry = row[symbol];
    let [r1, r2] = entry.split('/');

    // R/R conflicts are resolved by choosing a production that
    // goes first in the grammar (i.e. its number is smaller).
    row[symbol] = Number(r1.slice(1)) < Number(r2.slice(1))
      ? r1
      : r2;
  }

  _splitSRParts(entry) {
    let srConflict = entry.split('/');

    return LRParsingTable.getEntryType(srConflict[0]) === EntryType.REDUCE
      ? [srConflict[0], srConflict[1]]
      : [srConflict[1], srConflict[0]];
  }

  _shouldReduce(item, terminal) {
    let reduceSet = item.getReduceSet();

    // LR(0) reduces for all terminals.
    if (reduceSet === true) {
      return true;
    }

    // SLR(1) considers Follow(LHS), LALR(1) and CLR(1)
    // considers lookahead sets.
    return reduceSet.hasOwnProperty(terminal.getSymbol());
  }

  _putActionEntry(row, column, entry) {
    let previousEntry = row[column];

    // In case we have a transition on the same
    // symbol, and an action was already registered.
    if (previousEntry === entry) {
      return;
    }

    // Register an entry handling possible "shift-reduce" (s/r)
    // or "reduce-reduce" (r/r) conflicts.

    // Exclude duplicates for possibly the same conflict entry.
    if (previousEntry) {
      previousEntry = previousEntry.split('/');
      if (previousEntry.indexOf(entry) === -1) {
        previousEntry.push(entry);
      }
      entry = previousEntry.join('/');
    }

    row[column] = entry;
  }
};
