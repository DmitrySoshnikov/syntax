/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar/grammar';
import CanonicalCollection from './canonical-collection';
import LRParsingTable from './lr-parsing-table';
import Tokenizer from '../tokenizer';
import {EOF} from '../special-symbols';
import colors from 'colors';

const EntryType = LRParsingTable.EntryType;

export default class LRParser {
  constructor({grammar}) {
    this._grammar = grammar;

    this._canonicalCollection = new CanonicalCollection({
      grammar: this._grammar,
    });

    this._table = new LRParsingTable({
      canonicalCollection: this._canonicalCollection,
      grammar: this._grammar,
    });

    this._stack = [];
  }

  getGrammar() {
    return this._grammar;
  }

  getTable() {
    return this._table;
  }

  getCanonicalCollection() {
    return this._canonicalCollection;
  }

  parse(string) {
    let tokenizer = new Tokenizer({
      string,
      grammar: this._grammar,
    });

    this._stack = [];

    let startingState = this._canonicalCollection
      .getStartingState()
      .getNumber();

    // Start from the initial state.
    this._stack.push(startingState);

    let token = tokenizer.getNextToken();
    let shiftedToken = null;

    do {
      if (!token) {
        this._unexpectedEndOfInput();
      }

      let state = this._peek();
      let column = token.type;
      let entry = this._table.get()[state][column];

      if (!entry) {
        this._unexpectedToken(token);
      }

      switch (LRParsingTable.getEntryType(entry)) {
        case EntryType.SHIFT:
          this._shift(token, entry);
          shiftedToken = token;
          token = tokenizer.getNextToken();
          break;
        case EntryType.REDUCE:
          this._reduce(entry, shiftedToken);
          // Don't advance tokens on reduce.
          break;
        case EntryType.SR_CONFLICT:
          this._conflictError('shift-reduce', state, column);
          break;
        case EntryType.RR_CONFLICT:
          this._conflictError('reduce-reduce', state, column);
        case EntryType.ACCEPT: {
          // Pop starting production and its state number.
          this._stack.pop();
          let parsed = this._stack.pop();

          if (this._stack.length !== 1 ||
              this._stack[0] !== startingState ||
              tokenizer.hasMoreTokens()) {
            this._unexpectedToken(token);
          }

          let result = {status: 'accept'};

          if (parsed.hasOwnProperty('semanticValue')) {
            result.value = parsed.semanticValue;
          }

          return result;
        }
      }

    } while (tokenizer.hasMoreTokens() || this._stack.length > 1);
  }

  _unexpectedEndOfInput() {
    this._parseError(`Unexpected end of input.`);
  }

  _unexpectedToken(token) {
    if (token.value === EOF) {
      this._unexpectedEndOfInput();
    }

    this._parseError(`Unexpected token: ${token.value}.`);
  }

  _parseError(message) {
    throw new Error(`Parse error: ${message}`);
  }

  _conflictError(conflictType, state, column) {
    this._parseError(
      `Found "${conflictType}" conflict ` +
      `at state ${state}, terminal ${column}.`
    );
  }

  _peek() {
    return this._stack[this._stack.length - 1];
  }

  _shift(token, entry) {
    this._stack.push(
      {symbol: token.type, semanticValue: token.value},
      Number(entry.slice(1))
    );
  }

  _reduce(entry, token) {
    let productionNumber = entry.slice(1);
    let production = this._grammar.getProduction(productionNumber);
    let hasSemanticAction = production.hasSemanticAction();
    let semanticActionArgs = hasSemanticAction ? [] : null;

    // Pop 2x symbols from the stack (RHS + state number for each),
    // unless it's an ε-production for which nothing to pop.
    if (!production.isEpsilon()) {
      let rhsLengh = production.getRHS().length;
      while (rhsLengh--) {
        // Pop state number;
        this._stack.pop();
        // Pop production symbol.
        let stackEntry = this._stack.pop();

        if (hasSemanticAction) {
          semanticActionArgs.unshift(stackEntry.semanticValue);
        }
      }
    }

    let previousState = this._peek();
    let symbolToReduceWith = production.getLHS().getSymbol();

    let reduceStackEntry = {symbol: symbolToReduceWith};

    if (hasSemanticAction) {
      // Pass token info as well.
      semanticActionArgs.unshift(
        token ? token.value : null,
        token ? token.value.length : null
      );

      // Run corresponding semantic action.
      reduceStackEntry.semanticValue = production
        .runSemanticAction(semanticActionArgs);
    }

    // Then push LHS.
    this._stack.push(reduceStackEntry);

    let nextState = this._table.get()[previousState][symbolToReduceWith];

    // And push the next state (goto)
    this._stack.push(nextState);
  }
};
