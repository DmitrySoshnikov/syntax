/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import {MODES as GRAMMAR_MODE} from '../grammar/grammar-mode';
import GrammarSymbol from '../grammar/grammar-symbol';
import SetsGenerator from '../sets-generator';
import TablePrinter from '../table-printer';
import {EOF} from '../special-symbols';

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
 * The table looks like this:
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
  constructor({canonicalCollection, grammar}) {
    this._canonicalCollection = canonicalCollection;
    this._grammar = grammar;
    this._setsGenerator = new SetsGenerator({grammar});

    this._action = grammar.getTerminals()
      .concat(new GrammarSymbol(EOF));

    this._goto = grammar.getNonTerminals();
    this._table = {};
    this._build(this._canonicalCollection.getStartingState());
  }

  get() {
    return this._table;
  }

  print() {
    this._grammar.print();

    console.log(`\n${this._grammar.getMode().toString()} parsing table:\n`);

    let terminals = this._grammar
      .getTerminals()
      .map(terminal => terminal.getSymbol());

    let nonTerminals = this._grammar
      .getNonTerminals()
      .map(nonTerminal => nonTerminal.getSymbol());

    let printer = new TablePrinter({
      head: [''].concat(terminals, EOF, nonTerminals),
    });

    Object.keys(this._table).forEach(stateNumber => {
      let entry = this._table[stateNumber];
      let stateData = [stateNumber];

      // Action part.
      terminals.forEach(terminal => {
        stateData.push(entry[terminal] || '');
      });

      stateData.push(entry[EOF] || '');

      // Goto part.
      nonTerminals.forEach(nonTerminal => {
        stateData.push(entry[nonTerminal] || '');
      });

      printer.push(stateData);
    });

    console.log(printer.toString());
    console.log('');
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

  _build(currentState) {
    // Fill actions and goto for this state (row).
    let row = this._table[currentState.getNumber()] = {};

    currentState.getItems().forEach(item => {

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
            if (this._shouldReduce(production, terminal)) {
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
        if (transitionSymbol.isNonTerminal()) {
          row[transitionSymbol.getSymbol()] = nextState;
        } else {
          this._putActionEntry(
            row,
            transitionSymbol.getSymbol(),
            `s${nextState}`
          );
        }

        // If we haven't visit the next state yet, go recursively to it.
        if (!this._table.hasOwnProperty(nextState)) {
          this._build(item.goto());
        }
      }
    });
  }

  _shouldReduce(production, terminal) {
    let mode = this._grammar.getMode().getRaw();
    switch (mode) {
      case GRAMMAR_MODE.LR0:
        // LR0 reduces for all actions without a lookahead.
        return true;
      case GRAMMAR_MODE.SLR1:
        // SLR1 considers where the action is in the Follow(LHS).
        return this._setsGenerator
          .followOf(production.getLHS())
          .hasOwnProperty(terminal.getSymbol());
      default:
        throw new Error(`Unsupported grammar type: ${mode}.`);
    }
  }

  _putActionEntry(row, column, entry) {
    let previousEntry = row[column];

    // In case we have a transtion on the same
    // symbol, and an action was already registered.
    if (previousEntry === entry) {
      return;
    }

    // Register an entry handling possible "shift-reduce" (s/r)
    // or "reduce-reduce" (r/r) conflicts.
    row[column] = previousEntry
      ? `${previousEntry}/${entry}`
      : entry;
  }
};
