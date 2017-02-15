/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LLParserGeneratorDefault = require(ROOT + 'll/ll-parser-generator-default').default;
const PyParserGeneratorTrait = require('../py-parser-generator-trait');

import fs from 'fs';

/**
 * Generic Python template for LL(1) parser.
 */
const PY_LL_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/ll.template.py`,
  'utf-8'
);

/**
 * LL parser generator for Python.
 */
export default class LLParserGeneratorPy extends LLParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(PY_LL_PARSER_TEMPLATE);

    this._lexHandlers = [];
    this._productionHandlers = [];

    // Trait provides methods for lex and production handlers.
    Object.assign(this, PyParserGeneratorTrait);
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
