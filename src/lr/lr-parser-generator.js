/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CanonicalCollection from './canonical-collection';
import Grammar from '../grammar/grammar';
import LRParsingTable from './lr-parsing-table';

import fs from 'fs';
import path from 'path';
import vm from 'vm';

const MULTI_LINE_COMMENTS_RE = /\/\*(.|\s)*?\*\//g;
const SINGLE_LINE_COMMENTS_RE = /[^:]\/\/.*?\n/g;

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
 * tokenizer, unless `useTokenizer` is `false` (in which case the parser
 * will expect a custom tokenizer instance, that should implement its
 * interface.
 */
export default class LRParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({grammar, outputFile, useCustomTokenizer = false}) {
    this._grammar = grammar;
    this._outputFile = outputFile;
    this._useCustomTokenizer = useCustomTokenizer;

    if (!grammar.getMode().isLR()) {
      throw new Error(`Only LR parsers are supported at the moment.`);
    }

    this._table = new LRParsingTable({
      canonicalCollection: new CanonicalCollection({
        grammar: this._grammar,
      }),
      grammar: this._grammar,
    });

    // Init the result data to the template, parts of which
    // are further generated (productions, lex-rules, table, etc).
    this._resultData = PARSER_TEMPLATE;
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
    // Lexical grammar.
    if (this._useCustomTokenizer === false) {
      this._generateTokenizer();
      this._generateLexRules();
    } else {
      this._resultData = this._resultData.replace('<<TOKENIZER>>', '');
    }

    // Syntactic grammar.
    this._generateProductions();
    this._generateTable();

    return this._resultData;
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
      tokenizerCode
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
      `[${lexRules.join(',\n')}]`
    );
  }

  /**
   * Format of the production is: [LHS, RHS.length, semanticAction]
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

      return `['${LHS}', ${RHSLength}, ${semanticAction}]`;
    });

    this._resultData = this._resultData.replace(
      '<<PRODUCTIONS>>',
      () => `[${productions.join(',\n')}]`
    );
  }

  /**
   * Actual parsing table.
   */
  _generateTable() {
    this._resultData = this._resultData.replace(
      '<<TABLE>>',
      JSON.stringify(this._table.get())
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
    useCustomTokenizer = false,
  }) {
    return new LRParserGenerator({
      grammar: this.loadGrammar(grammarFile, mode),
      outputFile: outputFile || `${grammarFile}.parser.js`,
      useCustomTokenizer,
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
    let rawGrammarData = fs.readFileSync(grammarFile, 'utf-8')
      .replace(MULTI_LINE_COMMENTS_RE, '')
      .replace(SINGLE_LINE_COMMENTS_RE, '');

    let grammarData;

    try {
      // An object with `lex`, and `bnf`, valid JSON.
      grammarData = JSON.parse(rawGrammarData);
    } catch (e) {
      // JS code.
      try {
        grammarData = vm.runInNewContext(`(${rawGrammarData})`);
      } catch (e) {
        // Just a bnf as a string.
        grammarData = {
          bnf: rawGrammarData,
        };
      }
    }

    return grammarData;
  }

};
