/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LLParserGeneratorDefault = require(ROOT + 'll/ll-parser-generator-default').default;
const RubyParserGeneratorTrait = require('../ruby-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic Ruby template for LL(1) parser.
 */
const RUBY_LL_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/ll.template.rb`,
  'utf-8'
);

/**
 * LL parser generator for Ruby.
 */
export default class LLParserGeneratorRuby extends LLParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(RUBY_LL_PARSER_TEMPLATE);

    this._lexHandlers = [];
    this._productionHandlers = [];

    this._parserClassName = path.basename(
      outputFile,
      path.extname(outputFile),
    );

    // Trait provides methods for lex and production handlers.
    Object.assign(this, RubyParserGeneratorTrait);
  }

  /**
   * Generates parser code.
   */
  generateParserData() {
    super.generateParserData();
    this.generateLexHandlers();
    this.generateProductionHandlers();
    this.generateParserClassName(this._parserClassName);
  }
};
