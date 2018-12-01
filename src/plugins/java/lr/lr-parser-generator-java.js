/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;
const JavaParserGeneratorTrait = require('../java-parser-generator-trait');

import fs from 'fs';
import path from 'path';

/**
 * Generic Java template for all LR parsers.
 */
const JAVA_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.java`,
  'utf-8',
);

/**
 * LR parser generator for Java.
 */
export default class LRParserGeneratorJava extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(JAVA_LR_PARSER_TEMPLATE);

    this._lexHandlers = [];
    this._productionHandlers = [];

    this._parserClassName = path.basename(
      outputFile,
      path.extname(outputFile),
    );

    // Trait provides methods for lex and production handlers.
    Object.assign(this, JavaParserGeneratorTrait);
  }

  /**
   * Generates parser code.
   */
  generateParserData() {
    this.generateParserClassName(this._parserClassName);

    // Lexical grammar.
    this.generateTokenizer();

    // Syntactic grammar.
    this.generateProductions();

    // Tables.
    this.generateTokensTable();
    this.generateParseTable();

    this.generateLexHandlers();
    this.generateProductionHandlers();

    this.generateModuleInclude();
  }
};
