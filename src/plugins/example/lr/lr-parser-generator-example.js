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

/**
 * Base class to extend.
 */
const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;

/**
 * A trait file usually implements some very specific to a target language
 * constructs, and transformations.
 */
const ExampleParserGeneratorTrait = require('../example-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic template for all LR parsers in the Example language.
 */
const EXAMPLE_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.example`,
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
      .setTemplate(EXAMPLE_LR_PARSER_TEMPLATE);

    /**
     * Contains the lexical rule handlers: _lexRule1, _lexRule2, etc.
     * It's populated by the trait file.
     */
    this._lexHandlers = [];

    /**
     * Contains production handlers: _handler1, _handler2, etc.
     * It's populated by the trait file.
     */
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
    Object.assign(this, ExampleParserGeneratorTrait);
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
