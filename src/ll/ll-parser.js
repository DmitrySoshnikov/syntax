/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar/grammar';
import GrammarSymbol from '../grammar/grammar-symbol';
import LLParsingTable from './ll-parsing-table';
import LLParserGeneratorDefault from './ll-parser-generator-default';
import Tokenizer from '../tokenizer';
import {EOF} from '../special-symbols';

import os from 'os';
import path from 'path';

/**
 * Implements LL(1) parsing algorithm.
 */
export default class LLParser {
  constructor({grammar, parserModule}) {
    this._grammar = grammar;
    this._parserModule = parserModule;

    this._table = new LLParsingTable({
      grammar,
    });

    // If there are conflicts, parsing is not possible.
    this._validateConflicts();

    this._tokenizer = new Tokenizer({
      lexGrammar: grammar.getLexGrammar(),
    });

    // Parsing stack.
    this._stack = [];

    // Stores production numbers used at parsing.
    this._productionNumbers = [];
  }

  /**
   * Returns production numbers used to parse a string.
   */
  getProductionNumbers() {
    return this._productionNumbers;
  }

  static fromParserGenerator({grammar}) {
    // Generate parser in the temp directory.
    const outputFile = path.resolve(os.tmpdir(), '.syntax-parser.js');

    const parserModule = new LLParserGeneratorDefault({
      grammar,
      outputFile,
    }).generate();

    return new LLParser({grammar, parserModule});
  }

  parse(string) {
    // If parser module has been generated, use it.
    if (this._parserModule) {
      return {
        status: 'accept',
        value: this._parserModule.parse(string),
      };
    }

    this._tokenizer.initString(string);

    // Initialize the stack with the `$` at the bottom, and the start symbol.
    this._stack = [
      new GrammarSymbol(EOF),
      new GrammarSymbol(this._grammar.getStartSymbol()),
    ];

    this._productionNumbers = [];

    let token = this._tokenizer.getNextToken();
    let top = null;

    do {
      top = this._stack.pop();

      // Terminal is on the stack, just advance.
      if (this._grammar.isTokenSymbol(top) && top.getSymbol() === token.type) {
        // We already popped the symbol from the stack,
        // so just advance the cursor.
        token = this._tokenizer.getNextToken();
        continue;
      }

      // Else, it's a non-terminal, do derivation (replace it
      // in the stack with corresponding production).
      this._doDerivation(top, token);

    } while (this._tokenizer.hasMoreTokens() || this._stack.length > 1);

    // If the string reached EOF, and we still have non-terminal symbols
    // on the stack, we need to clean them up, they have to derive ε.
    while (this._stack.length !== 1) {
      this._doDerivation(this._stack.pop(), token);
    }

    // At the end the stack should contain only `$`,
    // as well as the last token should be the `$` marker.
    if (!this._stack[0].isEOF() || token.value !== EOF) {
      this._parseError(
        'stack is not empty: ' +
        this._stack.map(s => s.getSymbol()) + `, ${token.value}`
      );
    }

    return {
      status: 'accept',
      semanticValue: true,
    };
  }

  _doDerivation(top, token) {
    let derivedRHS = this._getDerivedRHS(top, token);

    // If we have production like F -> ε, we should just pop
    // the symbol, and don't push its derivation (the ε).
    if (!derivedRHS[0].isEpsilon()) {
      this._stack.push(...derivedRHS);
    }
  }

  _getDerivedRHS(top, token) {
    let nextProductionNumber = this._table.get()[top.getSymbol()][token.type];

    if (!nextProductionNumber) {
      this._unexpectedToken(token);
    }

    let nextProduction = this._grammar.getProduction(nextProductionNumber);

    this._productionNumbers.push(nextProductionNumber);

    // We should return reversed RHS in order to push on the stack.
    return nextProduction
      .getRHS()
      .slice()
      .reverse();
  }

  _validateConflicts() {
    if (!this._table.hasConflicts()) {
      return;
    }

    let messages = [''];
    let conflicts = this._table.getConflicts();

    for (let nonTerminal in conflicts) {
      let conflictMessage = `${nonTerminal}: `;
      let row = conflicts[nonTerminal];

      let rowMessages = [];
      for (let terminal in row) {
        rowMessages.push(`${terminal} -- ${row[terminal]}`);
      }

      conflictMessage += rowMessages.join(', ');
      messages.push(conflictMessage);
    }

    this._parseError(`Grammar has conflicts:\n${messages.join('\n- ')}`);
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
};