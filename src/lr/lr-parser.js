/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from '../code-unit';
import Grammar from '../grammar/grammar';
import CanonicalCollection from './canonical-collection';
import LRParsingTable from './lr-parsing-table';
import LRParserGeneratorDefault from './lr-parser-generator-default';
import Tokenizer from '../tokenizer';
import {EOF} from '../special-symbols';

import os from 'os';
import path from 'path';

const EntryType = LRParsingTable.EntryType;

export default class LRParser {
  constructor({grammar, parserModule}) {
    this._grammar = grammar;
    this._parserModule = parserModule;

    this._canonicalCollection = new CanonicalCollection({
      grammar: this._grammar,
    });

    this._table = new LRParsingTable({
      canonicalCollection: this._canonicalCollection,
      grammar: this._grammar,
    });

    this._tokenizer = new Tokenizer({
      lexGrammar: this._grammar.getLexGrammar(),
    });

    // Parsing stack.
    this._stack = [];

    // Execute module include code which may attach
    // handlers for some events, and define needed data.
    CodeUnit.eval(this._grammar.getModuleInclude());

    // Parse object which may define handlers for parse events.
    this._yyparse = CodeUnit.getSandbox().yyparse;

    // Global storage accessible from semantic actions.
    this._yy = CodeUnit.getSandbox().yy;

    // Parser may access tokenizer, and affect its state.
    this._yy.tokenizer = this._tokenizer;

    // Alias for tokenizer.
    this._yy.lexer = this._tokenizer;
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

  static fromParserGenerator({grammar}) {
    // Generate parser in the temp directory.
    const outputFile = path.resolve(os.tmpdir(), '.syntax-parser.js');

    const parserModule = new LRParserGeneratorDefault({
      grammar,
      outputFile,
      resolveConflicts: true,
    }).generate();

    return new LRParser({grammar, parserModule});
  }

  parse(string) {
    // If parser module has been generated, use it.
    if (this._parserModule) {
      return {
        status: 'accept',
        value: this._parserModule.parse(string),
      };
    }

    if (this._yyparse.onParseBegin) {
      this._yyparse.onParseBegin(string);
    }

    this._tokenizer.initString(string);

    this._stack = [];

    let startingState = this._canonicalCollection
      .getStartingState()
      .getNumber();

    // Start from the initial state.
    this._stack.push(startingState);

    let token = this._tokenizer.getNextToken();
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
          token = this._tokenizer.getNextToken();
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
              this._tokenizer.hasMoreTokens()) {
            this._unexpectedToken(token);
          }

          let result = {status: 'accept'};

          if (parsed.hasOwnProperty('semanticValue')) {
            result.value = parsed.semanticValue;
          }

          if (this._yyparse.onParseEnd) {
            this._yyparse.onParseEnd(result.value);
          }

          return result;
        }
      }

    } while (this._tokenizer.hasMoreTokens() || this._stack.length > 1);
  }

  _unexpectedEndOfInput() {
    this._parseError(`Unexpected end of input.`);
  }

  _unexpectedToken(token) {
    if (token.value === EOF) {
      this._unexpectedEndOfInput();
    }

    this._tokenizer.throwUnexpectedToken(
      token.value,
      token.startLine,
      token.startColumn,
    );
  }

  _parseError(message) {
    throw new SyntaxError(message);
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
    let loc = null;

    if (this._grammar.shouldCaptureLocations()) {
      loc = {
        startOffset: token.startOffset,
        endOffset: token.endOffset,
        startLine: token.startLine,
        endLine: token.endLine,
        startColumn: token.startColumn,
        endColumn: token.endColumn,
      };
    }

    this._stack.push(
      {
        symbol: token.type,
        semanticValue: token.value,
        loc,
      },
      Number(entry.slice(1))
    );
  }

  _reduce(entry, token) {
    const productionNumber = entry.slice(1);
    const production = this._grammar.getProduction(productionNumber);
    const hasSemanticAction = production.hasSemanticAction();
    const semanticValueArgs = hasSemanticAction ? [] : null;

    const locationArgs = (
      hasSemanticAction && this._grammar.shouldCaptureLocations()
        ? []
        : null
    );

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
          semanticValueArgs.unshift(stackEntry.semanticValue);

          if (locationArgs) {
            locationArgs.unshift(stackEntry.loc);
          }
        }
      }
    }

    let previousState = this._peek();
    let symbolToReduceWith = production.getLHS().getSymbol();

    let reduceStackEntry = {symbol: symbolToReduceWith};

    if (hasSemanticAction) {
      CodeUnit.setBindings({
        yytext: token ? token.value : '',
        yyleng: token ? token.value.length : 0,
      });

      const semanticActionArgs = (
        locationArgs !== null
          ? semanticValueArgs.concat(locationArgs)
          : semanticValueArgs
      );

      // Run corresponding semantic action, result is in $$ (__).
      production.runSemanticAction(semanticActionArgs);

      reduceStackEntry.semanticValue = CodeUnit.getSandbox().__;

      if (locationArgs) {
        reduceStackEntry.loc = CodeUnit.getSandbox().__loc;
      }
    }

    // Then push LHS.
    this._stack.push(reduceStackEntry);

    let nextState = this._table.get()[previousState][symbolToReduceWith];

    // And push the next state (goto)
    this._stack.push(nextState);
  }
};
