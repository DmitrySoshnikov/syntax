/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import BnfParser from '../generated/bnf-parser.gen';
import CanonicalCollection from './canonical-collection';
import Grammar from '../grammar/grammar';
import LRParsingTable from './lr-parsing-table';
import {EOF} from '../special-symbols';

import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Generic template for all LR parsers.
 */
const PARSER_TEMPLATE = fs.readFileSync(
`${__dirname}/../templates/lr.template`,
  'utf-8'
);

/**
 * LR parser generator. Creates a parser module for a given grammar, and
 * saves it to the `outputFile`.
 *
 * By default also generates code for a
 * tokenizer, unless `customTokenizer` is `false` (in which case the parser
 * will expect a custom tokenizer instance, that should implement its
 * interface.
 */
export default class LRParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    customTokenizer = null,
    resolveConflicts = false,
  }) {
    this._grammar = grammar;
    this._outputFile = outputFile;
    this._customTokenizer = customTokenizer;

    if (!grammar.getMode().isLR()) {
      throw new Error(`Only LR parsers are supported at the moment.`);
    }

    this._table = new LRParsingTable({
      canonicalCollection: new CanonicalCollection({
        grammar: this._grammar,
      }),
      grammar: this._grammar,
      resolveConflicts,
    });

    // Init the result data to the template, parts of which
    // are further generated (productions, lex-rules, table, etc).
    this._resultData = PARSER_TEMPLATE;

    this._nonTerminals = this._grammar
      .getNonTerminals()
      .map(symbol => symbol.getSymbol());

    this._tokens = this._grammar
      .getTokens()
      .concat(this._grammar.getTerminals())
      .map(symbol => symbol.getSymbol());

    this._tokens.push(EOF);
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

  /**
   * Generates parser parts. If default tokenizer is used, generates code
   * for it as well, otherwise, users are supposed to provide custom
   * tokenizer.
   */
  _generateParserData() {
    // Arbitrary code included to the module.
    this._generateModuleInclude();

    // Parse begin hook.
    this._generateOnParseBegin();

    // Lexical grammar.
    if (this._customTokenizer === null) {
      // Built-in tokinizer.
      this._generateTokenizer();
      this._generateLexRules();
    } else {
      // Require custom tokenizer if was provided.
      this._resultData = this._resultData.replace(
        '<<TOKENIZER>>',
        () => `tokenizer = require('${this._customTokenizer}');`,
      );
    }

    // Syntactic grammar.
    this._generateProductions();
    this._generateTable();

    // Parse end hook.
    this._generateOnParseEnd();

    return this._resultData;
  }

  /**
   * Injects the code passed in the module include directive.
   */
  _generateModuleInclude() {
    this._resultData = this._resultData.replace(
      '<<MODULE_INCLUDE>>',
      () => this._grammar.getModuleInclude(),
    );
  }

  /**
   * Injects the code executed on parse begin.
   */
  _generateOnParseBegin() {
    this._resultData = this._resultData.replace(
      '<<ON_PARSE_BEGIN>>',
      () => this._grammar.getOnParseBegin(),
    );
  }

  /**
   * Injects the code executed on parse end.
   */
  _generateOnParseEnd() {
    this._resultData = this._resultData.replace(
      '<<ON_PARSE_END>>',
      () => this._grammar.getOnParseEnd(),
    );
  }

  /**
   * Generates built-in tokenizer instance.
   */
  _generateTokenizer() {
    let tokenizerCode = fs.readFileSync(
      `${__dirname}/../templates/tokenizer.template`,
      'utf-8'
    );

    this._resultData = this._resultData.replace(
      '<<TOKENIZER>>',
      () => tokenizerCode,
    );
  }

  /**
   * Generates rules for tokenizer.
   */
  _generateLexRules() {
    let lexRules = this._grammar.getLexRules().map(lexRule => {
      return `[${lexRule.getMatcher()}, () => { ${lexRule.getRawHandler()} }]`;
    });

    this._resultData = this._resultData.replace(
      '<<LEX_RULES>>',
      () => `[${lexRules.join(',\n')}]`,
    );
  }

  /**
   * Format of the production is:
   * [Non-terminal index, RHS.length, semanticAction]
   */
  _generateProductions() {
    let productions = this._grammar.getProductions().map(production => {

      let LHS = production.getLHS().getSymbol().replace(/'/g, "\\'");
      let RHSLength = production.isEpsilon() ? 0 : production.getRHS().length;
      let rawSemanticAction = production.getRawSemanticAction();
      let semanticAction = null;

      if (rawSemanticAction) {
        // Builds a string of args: '$1, $2, $3...'
        let args = [...Array(RHSLength)]
          .map((_, i) => `$${i + 1}`)
          .join(',');

        semanticAction = `(${args}) => { ${rawSemanticAction} }`;
      }

      return `[${this._nonTerminals.indexOf(LHS)}, ${RHSLength}` +
        (semanticAction ? `, ${semanticAction}` : '') + ']';
    });

    this._resultData = this._resultData.replace(
      '<<PRODUCTIONS>>',
      () => `[${productions.join(',\n')}]`,
    );
  }

  /**
   * Actual parsing table.
   */
  _generateTable() {
    let originalTable = this._table.get();
    let table = {};

    // Encode tokens table: token indices start after non-terminal indices.
    let tokens = {};
    for (let k = 0; k < this._tokens.length; k++) {
      tokens[this._tokens[k]] = this._nonTerminals.length + k;
    }
    this._resultData = this._resultData.replace(
      '<<TOKENS>>',
      () => JSON.stringify(tokens),
    );

    for (let state in originalTable) {
      let row = {};
      let originalRow = originalTable[state];

      for (let symbol in originalRow) {
        let entry = originalRow[symbol];
        let nonTerminalIndex = this._nonTerminals.indexOf(symbol);
        let tokenIndex = tokens[symbol];
        // Format of a row: {
        //  <nonTerminalIndex from the production table> |
        //  <tokenIndex> :
        //    table-entry
        // }
        row[
          nonTerminalIndex !== -1
            ? nonTerminalIndex
            : tokenIndex
        ] = entry;
      }

      table[state] = row;
    }

    this._resultData = this._resultData.replace(
      '<<TABLE>>',
      () => JSON.stringify(table),
    );
  }

  /**
   * Creates a generator instance from a grammar file,
   * for the specific parsing mode.
   */
  static fromGrammarFile({
    grammarFile,
    mode,
    outputFile,
    customTokenizer = null,
  }) {
    return new LRParserGenerator({
      grammar: this.loadGrammar(grammarFile, mode),
      outputFile: outputFile || `${grammarFile}.parser.js`,
      customTokenizer,
    });
  }

  /**
   * Loads a grammar object from a grammar file,
   * for the specific parsing mode.
   */
  static loadGrammar(grammarFile, mode) {
    let grammarData = this.loadGrammarData(grammarFile);
    grammarData.mode = mode;
    return new Grammar(grammarData);
  }

  /**
   * Reads grammar file data.
   */
  static loadGrammarData(grammarFile) {
    let rawGrammarData = fs.readFileSync(grammarFile, 'utf-8');
    let grammarData;

    try {
      // An object with `lex`, and `bnf`, valid JSON.
      grammarData = JSON.parse(rawGrammarData);
    } catch (e) {
      // JS code.
      try {
        grammarData = vm.runInNewContext(`
          (function() { return (${rawGrammarData});})()
        `);
      } catch (e) {
        // A grammar in string BNF, parse it.
        grammarData = BnfParser.parse(rawGrammarData);
      }
    }

    return grammarData;
  }

};
