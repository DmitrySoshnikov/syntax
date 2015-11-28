/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar/grammar';
import CanonicalCollection from './canonical-collection';
import LRParsingTable from './lr-parsing-table';
import Tokenizer from '../tokenizer';

export default class LRParser {
  constructor({grammar}) {
    this._grammar = grammar instanceof Grammar
      ? grammar
      : new Grammar(grammar);

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
    this._printParseHeader(string);

    let tokenizer = new Tokenizer({
      string,
      grammar: this._grammar,
    });

    let table = this._table.get();

    let startingState = this._canonicalCollection
      .getStartingState()
      .getNumber();

    // Start from the initial state.
    this._stack.push(startingState);

    let token = tokenizer.getNextToken();

    do {
      if (!token) {
        this._unexpectedEndOfSource();
      }

      let state = this._peek();
      let entry = this._table.get()[state][token.type];

      if (!entry) {
        this._unexpectedToken(token);
      }

      switch (LRParsingTable.getEntryType(entry)) {
        case EntryType.SHIFT:
          this._shift(token, entry);
          token = tokenizer.getNextToken();
          break;
        case EntryType.REDUCE:
          this._reduce(entry);
          // Don't advance tokens on reduce.
          break;
        case EntryType.ACCEPT:
          // Pop starting production and its state number.
          this._stack.pop();
          this._stack.pop();

          if (this._stack.length !== 1 ||
              this._stack[0] !== startingState ||
              tokenizer.hasMoreTokens()) {
            this._unexpectedToken(token);
          }

          console.log(`Accepted.`);
          return true;
      }

    } while (tokenizer.hasMoreTokens() || this._stack.length > 1);
  }

  _printParseHeader(string) {
    console.log(`Parsing: "${string}"`);
    this._grammar.print();
    console.log('');
  }

  _unexpectedEndOfSource() {
    this._parseError(`Unexpected end of source`);
  }

  _unexpectedToken(token) {
    if (token.value === EOF) {
      this._unexpectedEndOfSource();
    }

    this._parseError(`Unexpected token: ${token.value}`);
  }

  _parseError(message) {
    throw new Error(`Parse error: ${message}.`);
  }

  _peek() {
    return this._stack[this._stack.length - 1];
  }

  _shift(token, entry) {
    this._stack.push(token.type, Number(entry.slice(1)));
  }

  _reduce(entry) {
    let productionNumber = entry.slice(1);
    let production = this._grammar.getProduction(productionNumber);

    // Pop 2x symbols from the stack (RHS + state number for each)
    let symbolsToPop = production.getRHS().length * 2;
    while (symbolsToPop--) {
      this._stack.pop();
    }

    let previousState = this._peek();
    let symbolToReduceWith = production.getLHS().getSymbol();

    // Then push LHS.
    this._stack.push(symbolToReduceWith);

    let nextState = this._table.get()[previousState][symbolToReduceWith];

    // And push the next state (goto)
    this._stack.push(nextState);
  }
};
