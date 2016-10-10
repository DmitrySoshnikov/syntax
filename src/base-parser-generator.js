/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from './grammar/grammar';
import {EOF} from './special-symbols';

import fs from 'fs';

/**
 * Base parser generator for LL and LR.
 */
export default class BaseParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({grammar, outputFile, customTokenizer}) {
    this._grammar = grammar;
    this._outputFile = outputFile;
    this._customTokenizer = customTokenizer;
    this._encodeSymbols();
  }

  /**
   * Initializes result data from the template.
   */
  setTemplate(template) {
    this._resultData = template;
    return this;
  }

  /**
   * Sets the parsing table.
   */
  setTable(table) {
    this._table = table;
    return this;
  }

  /**
   * Returns the parsing table.
   */
  getTable() {
    return this._table;
  }

  /**
   * Returns grammar.
   */
  getGrammar() {
    return this._grammar;
  }

  /**
   * Generates code for semantic action.
   */
  buildSemanticAction(production) {
    let RHSLength = production.isEpsilon() ? 0 : production.getRHS().length;
    let action = production.getRawSemanticAction();

    if (!action) {
      return null;
    }
    // Builds a string of args: '$1, $2, $3...'
    let args = [...Array(RHSLength)]
      .map((_, i) => `$${i + 1}`)
      .join(',');

    return `(${args}) => { ${action} }`;
  }

  /**
   * Generates parser code and writes it to disk as a reusable module.
   */
  generate() {
    fs.writeFileSync(
      this._outputFile,
      this._generateParserData(),
      'utf-8'
    );
    return require(this._outputFile);
  }

  getEncodedToken(token) {
    if (!this._tokens.hasOwnProperty(token)) {
      return -1;
    }
    return this._tokens[token];
  }

  getEncodedNonTerminal(nonTerminal) {
    if (!this._nonTerminals.hasOwnProperty(nonTerminal)) {
      return -1;
    }
    return this._nonTerminals[nonTerminal];
  }

  getEncodedSymbol(symbol) {
    let nonTerminal = this.getEncodedNonTerminal(symbol);

    if (nonTerminal !== -1) {
      return nonTerminal;
    }

    return this.getEncodedToken(symbol);
  }

  /**
   * Writes data for a given template variable.
   */
  writeData(templateVariable, data) {
    this._resultData = this._resultData.replace(
      templateVariable,
      () => data,
    );
    return this;
  }

  /**
   * Generates parser parts.
   */
  _generateParserData() {
    // Arbitrary code included to the module.
    this._generateModuleInclude();

    // Lexical grammar.
    this._generateTokenizer();

    // Syntactic grammar.
    this._generateProductions();

    // Tables.
    this._generateTokensTable();
    this._generateParseTable();

    return this._resultData;
  }


  /**
   * Encodes tokens, and non-terminals as indices (starting with
   * non-terminals in order, then tokens).
   */
  _encodeSymbols() {
    let index = 0;

    this._nonTerminals = {};
    this._grammar
      .getNonTerminals()
      .forEach(symbol => this._nonTerminals[symbol.getSymbol()] = index++);

    this._tokens = {};
    this._grammar
      .getTokens()
      .concat(this._grammar.getTerminals())
      .forEach(symbol => this._tokens[symbol.getSymbol()] = index++);

    this._tokens[EOF] = index;
  }

  /**
   * Generates code for a built-in or a custom tokenizer.
   */
  _generateTokenizer() {
    if (!this._customTokenizer) {
      // Built-in tokenizer.
      this._generateBuiltInTokenizer();
      this._generateLexRules();
    } else {
      // Require custom tokenizer if was provided.
      this.writeData(
        '<<TOKENIZER>>',
        `tokenizer = require('${this._customTokenizer}');`,
      );
    }
  }

  /**
   * Injects the code passed in the module include directive.
   */
  _generateModuleInclude() {
    this.writeData('<<MODULE_INCLUDE>>', this._grammar.getModuleInclude());
  }

  /**
   * Generates built-in tokenizer instance.
   */
  _generateBuiltInTokenizer() {
    let tokenizerCode = fs.readFileSync(
      `${__dirname}/./templates/tokenizer.template`,
      'utf-8'
    );
    this.writeData('<<TOKENIZER>>', tokenizerCode);
  }

  /**
   * Generates rules for tokenizer.
   */
  _generateLexRules() {
    let lexRules = this._grammar.getLexRules().map(lexRule => {
      return `[${lexRule.getMatcher()}, () => { ${lexRule.getRawHandler()} }]`;
    });
    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
  }

  _generateProductions() {
    this.writeData(
      '<<PRODUCTIONS>>',
      `[${this.generateProductionsData().join(',\n')}]`
    );
  }

  /**
   * Abstract method to implement in LL/LR.
   */
  generateProductionsData() {
    throw new Error(
      'Parser generator: `generateProductionsData` is not implemented.'
    );
  }

  _generateTokensTable() {
    this.writeData('<<TOKENS>>', JSON.stringify(this._tokens));
  }

  /**
   * Actual parsing table.
   */
  _generateParseTable() {
    this.writeData(
      '<<TABLE>>',
      JSON.stringify(this.generateParseTableData()),
    );
  }

  /**
   * Abstract method to implement in LL/LR.
   */
  generateParseTableData() {
    throw new Error(
      'Parser generator: `generateParseTableData` is not implemented.'
    );
  }
};
