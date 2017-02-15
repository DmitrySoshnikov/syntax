/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from './code-unit';
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
  constructor({
    grammar,
    outputFile,
    customTokenizer,
    options = {},
  }) {
    this._grammar = grammar;
    this._outputFile = outputFile;
    this._customTokenizer = customTokenizer;
    this._encodeSymbols();
    this._options = options;
  }

  /**
   * Returns options.
   */
  getOptions() {
    return this._options;
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
    const semanticActionCode = this.getSemanticActionCode(production);

    if (!semanticActionCode) {
      return null;
    }

    const semanticActionArgs = this
      .getSemanticActionParams(production)
      .join(',');

    return `(${semanticActionArgs}) => { ${semanticActionCode} }`;
  }

  /**
   * Creates handler prologue for locations. Use default implementation
   * from CodeUnit, plugins may implement custom logic.
   */
  createLocationPrologue(production) {
    return CodeUnit.createLocationPrologue(production);
  }

  /**
   * Returns a list of semantic action parameters. Plugins
   * can transform it, e.g. adding type information.
   */
  getSemanticActionParams(production) {
    return CodeUnit.createProductionParamsArray({
      production,
      captureLocations: this._grammar.shouldCaptureLocations(),
    });
  }

  /**
   * Returns transformed semantic action code.
   */
  getSemanticActionCode(production) {
    const rawAction = production.getRawSemanticAction();

    if (!rawAction) {
      return null;
    }

    let action = rawAction
      // Replace $1, $2, @1, ... $$ with _1, _2, _1loc, ... __, etc.
      .replace(/\$(\d+)/g, '_$1')
      .replace(/@(\d+)/g, '_$1loc')
      .replace(/\$\$/g, '__')
      .replace(/@\$/g, '__loc');

    if (this._grammar.shouldCaptureLocations()) {
      action = this.createLocationPrologue(production) + action;
    }

    return action || null;
  }

  /**
   * Generates parser code and writes it to disk as a reusable module.
   */
  generate() {
    this.generateParserData();
    fs.writeFileSync(
      this._outputFile,
      this._resultData,
      'utf-8'
    );
    try {
      return require(this._outputFile);
    } catch (e) {
      /* skip for other languages */
    }
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
   * Generates a wrapping namespace.
   */
  generateNamespace() {
    /* no-op, plugins can override */
  }

  /**
   * Generates parser parts.
   */
  generateParserData() {
    // Generate a wrapping namespace.
    this.generateNamespace();

    // Arbitrary code included to the module.
    this.generateModuleInclude();

    // Whether locations should be captured, and propagated.
    this.generateCaptureLocations();

    // Lexical grammar.
    this.generateTokenizer();

    // Syntactic grammar.
    this.generateProductions();

    // Tables.
    this.generateTokensTable();
    this.generateParseTable();

    return this._resultData;
  }

  /**
   * Whether locations should be captured, and propagated.
   */
  generateCaptureLocations() {
    this.writeData(
      '<<CAPTURE_LOCATIONS>>',
      JSON.stringify(this._grammar.shouldCaptureLocations()),
    );
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
      .forEach(symbol => this._nonTerminals[symbol.getSymbol()] = '' + index++);

    this._tokens = {};
    this._grammar
      .getTokens()
      .concat(this._grammar.getTerminals())
      .forEach(symbol => this._tokens[symbol.getSymbol()] = '' + index++);

    this._tokens[EOF] = '' + index;
  }

  /**
   * Generates code for a built-in or a custom tokenizer.
   */
  generateTokenizer() {
    if (!this._customTokenizer) {
      // Built-in tokenizer.
      this.generateBuiltInTokenizer();
      this.generateLexRules();
      this.generateLexRulesByStartConditions();
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
  generateModuleInclude() {
    this.writeData('<<MODULE_INCLUDE>>', this._grammar.getModuleInclude());
  }

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    let tokenizerCode = fs.readFileSync(
      `${__dirname}/./templates/tokenizer.template.js`,
      'utf-8'
    );
    this.writeData('<<TOKENIZER>>', tokenizerCode);
  }

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    let lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      return (
        `[${lexRule.getMatcher()}, ` +
        `function() { ${lexRule.getRawHandler()} }, ` +
        `${
          lexRule.hasStartConditions()
            ? JSON.stringify(lexRule.getStartConditions())
            : ''
        }]`
      );
    });

    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
  }

  /**
   * Generates lex rule table by start conditions.
   * conditionName: [<ruleIndex in the LEX_RULES table>, ...]
   */
  generateLexRulesByStartConditions() {
    const lexGrammar = this._grammar.getLexGrammar();
    const lexRulesByConditions = lexGrammar.getRulesByStartConditions();
    const result = {};

    for (const condition in lexRulesByConditions) {
      result[condition] = lexRulesByConditions[condition].map(lexRule =>
        lexGrammar.getRuleIndex(lexRule)
      );
    }

    this.writeData(
      '<<LEX_RULES_BY_START_CONDITIONS>>',
      `${JSON.stringify(result)}`,
    );
  }

  generateProductions() {
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

  generateTokensTable() {
    this.writeData('<<TOKENS>>', JSON.stringify(this._tokens));
  }

  /**
   * Actual parsing table.
   */
  generateParseTable() {
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
