/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LLParserGeneratorDefault = require(ROOT + 'll/ll-parser-generator-default').default;
const PHPParserGeneratorTrait = require('../php-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic PHP template for LL(1) parser.
 */
const PHP_LL_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/ll.template.php`,
  'utf-8'
);

/**
 * LL parser generator for PHP.
 */
export default class LLParserGeneratorPHP extends LLParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(PHP_LL_PARSER_TEMPLATE);

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
