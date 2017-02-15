/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;
const PHPParserGeneratorTrait = require('../php-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic PHP template for all LR parsers.
 */
const PHP_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.php`,
  'utf-8',
);

/**
 * LR parser generator for PHP.
 */
export default class LRParserGeneratorPHP extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(PHP_LR_PARSER_TEMPLATE);

    this._lexHandlers = [];
    this._productionHandlers = [];

    this._parserClassName = path.basename(
      outputFile,
      path.extname(outputFile),
    );

    // Trait provides methods for lex and production handlers.
    Object.assign(this, PHPParserGeneratorTrait);
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
