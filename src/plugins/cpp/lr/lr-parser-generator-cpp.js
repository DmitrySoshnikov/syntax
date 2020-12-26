/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;
const CppParserGeneratorTrait = require('../cpp-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic C++ template for all LR parsers.
 */
const CPP_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.h`,
  'utf-8',
);

/**
 * LR parser generator for C++.
 */
export default class LRParserGeneratorCpp extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(CPP_LR_PARSER_TEMPLATE);

    this._lexHandlers = [];
    this._productionHandlers = [];
    this._tokenTypes = [];
    this._terminalsMap = {};
    this._terminalsIndexMap = {};

    this._parserClassName = path.basename(
      outputFile,
      path.extname(outputFile),
    );

    // Trait provides methods for lex and production handlers.
    Object.assign(this, CppParserGeneratorTrait);
  }

  /**
   * Generates parser code.
   */
  generateParserData() {
    this.generateNamespace();
    this.generateModuleInclude();
    this.generateCaptureLocations();
    this.generateBuiltInTokenizer();
    this.generateTokenTypes();
    this.generateTokensTable();
    this.generateLexRules();
    this.generateLexRulesByStartConditions();
    this.generateLexHandlers();
    this.generateProductions();
    this.generateParseTable();
    this.generateProductionHandlers();
    this.generateParserClassName(this._parserClassName);
    this.generateParsedResult();
  }
};
