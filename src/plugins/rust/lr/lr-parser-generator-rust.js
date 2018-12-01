/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;
const RustParserGeneratorTrait = require('../rust-parser-generator-trait');

import fs from 'fs';

/**
 * Generic Rust template for all LR parsers.
 */
const RUST_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.rs`,
  'utf-8',
);

/**
 * LR parser generator for Rust.
 */
export default class LRParserGeneratorRust extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(RUST_LR_PARSER_TEMPLATE);

    this._lexHandlers = [];
    this._productionHandlers = [];

    /**
     * Stores all used types of the arguments, and return values.
     * This is used to generate `SV` (stack value) enum.
     * Init to `Token` type which is always stored on the stack.
     *
     * enum SV {
     *     _0(Token),
     *     _1(...),
     * }
     */
    this._allTypes = {
      Token: 0,
    };

    // Autoinc index in SV.
    this._allTypesIndex = 1;

    // Trait provides methods for lex and production handlers.
    Object.assign(this, RustParserGeneratorTrait);
  }

  /**
   * Generates parser code.
   */
  generateParserData() {
    // Lexical grammar.
    this.generateTokenizer();

    // Syntactic grammar.
    this.generateProductions();

    // Tables.
    this.generateTokensTable();
    this.generateParseTable();

    this.generateLexHandlers();
    this.generateProductionHandlers();
    this.generateStackValueEnum();

    // The module include which should include at least
    // result type: type TResult = <...>;
    this.generateModuleInclude();
  }
};
