/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import LRParserGeneratorDefault from '../lr-parser-generator-default';
import LRParsingTable from '../lr-parsing-table';
import PyParserGeneratorTrait from '../../python/py-parser-generator-trait';

import fs from 'fs';

/**
 * Generic Python template for all LR parsers.
 */
const PY_LR_PARSER_TEMPLATE = fs.readFileSync(
`${__dirname}/../../templates/python/lr.template.py`,
  'utf-8'
);

/**
 * LR parser generator for Python.
 */
export default class LRParserGeneratorPy extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    customTokenizer = null,
    resolveConflicts = false,
  }) {
    super({grammar, outputFile, customTokenizer})
      .setTemplate(PY_LR_PARSER_TEMPLATE);

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
    this._generateLexHandlers();
    this._generateProductionHandlers();
  }
};
