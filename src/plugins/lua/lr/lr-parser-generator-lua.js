/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

const LRParserGeneratorDefault = require(ROOT + 'lr/lr-parser-generator-default').default;
const LuaParserGeneratorTrait = require('../lua-parser-generator-trait');

import fs from 'fs';
import path from 'path';

const LUA_LR_PARSER_TEMPLATE = fs.readFileSync(
  `${__dirname}/../templates/lr.template.lua`,
  'utf-8',
);

/**
 * LR parser generator for Lua.
 */
export default class LRParserGeneratorLua extends LRParserGeneratorDefault {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    super({grammar, outputFile, options})
      .setTemplate(LUA_LR_PARSER_TEMPLATE);

    /**
     * Contains the lexical rule handlers: _lexRule1, _lexRule2, etc.
     * It's populated by the trait file.
     */
    this._lexHandlers = [];
    this._productionHandlers = [];

    /**
     * Actual class name of your parser. Here we infer from the output filename.
     */
    this._parserClassName = path.basename(
      outputFile,
      path.extname(outputFile),
    );

    Object.assign(this, LuaParserGeneratorTrait);
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
