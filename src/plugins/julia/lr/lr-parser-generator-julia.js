/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

/**
 * Implementation notes.
 *
 * 1. Extend `LRParserGeneratorDefault`
 * 2. Implement `generateParserData()`
 * 3. Implement all specific to the target language
 *    functionality in the trait file.
 */

const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;
const JuliaParserGeneratorTrait = require('../julia-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic template for all LR parsers in the Example language.
 */
const JL_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.jl`,
  'utf-8',
);

/**
 * LR parser generator for Example language.
 */
export default class LRParserGeneratorExample extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(JL_LR_PARSER_TEMPLATE);
    this._lexHandlers = [];
    this._productionHandlers = [];

    /**
     * Actual class name of your parser. Here we infer from the output filename.
     */
    this._parserClassName = path.basename(
      outputFile,
      path.extname(outputFile),
    );

    /**
     * The trait provides methods for lex and production handlers, as well
     * as some very specific code generation for the target language.
     */
    Object.assign(this, JuliaParserGeneratorTrait);
  }

  /**
   * Generates parser code.
   */
  generateParserData() {
    super.generateParserData();
    this.generateLexHandlers();
    this.generateProductionHandlers();
  }
};
