/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * Ruby tokenizer template.
 */
const RUBY_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.rb`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for Ruby.
 */
const RubyParserGeneratorTrait = {

  /**
   * Generates parser class name.
   */
  generateParserClassName(className) {
    this.writeData('<<PARSER_CLASS_NAME>>', className);
  },

  /**
   * Generates parsing table in Ruby hash format.
   */
  generateParseTable() {
    this.writeData(
      '<<TABLE>>',
      this._toRubyHash(this.generateParseTableData()),
    );
  },

  /**
   * Generates tokens table in Ruby hash format.
   */
  generateTokensTable() {
    this.writeData('<<TOKENS>>', this._toRubyHash(this._tokens));
  },

  /**
   * Production handlers are implemented as private methods
   * on the `YYParse` class.
   */
  buildSemanticAction(production) {
    const semanticActionData = this.getSemanticActionData(production);

    if (!semanticActionData) {
      return null;
    }

    semanticActionData.action =
      this._scopeVars(semanticActionData.action);

    semanticActionData.args = this._scopeVars(semanticActionData.args);

    // Save the action, they are injected later.
    this._productionHandlers.push(semanticActionData);
    return `'_handler${this._productionHandlers.length}'`;
  },

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    this.writeData(
      '<<TOKENIZER>>',
      RUBY_TOKENIZER_TEMPLATE,
    );
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    let lexRules = this._grammar.getLexRules().map(lexRule => {
      const action = this._scopeVars(lexRule.getRawHandler());
      this._lexHandlers.push({args: '', action});

      return `[/${lexRule.getRawMatcher()}/, ` +
        `'_lex_rule${this._lexHandlers.length}']`;
    });

    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `YYParse`.
   */
  _scopeVars(code) {
    return code
      .replace(/yytext/g, 'YYParse.yytext')
      .replace(/yyleng/g, 'YYParse.yyleng')
      .replace(/\b__\b/g, 'YYParse.__');
  },

  /**
   * Converts JS object to Ruby's hash representation.
   */
  _toRubyHash(object) {
    if (typeof object !== 'object') {
      return JSON.stringify(object);
    }
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/'/g, "\\'");
      result.push("'" + key + "' => " + this._toRubyHash(value));
    }
    return `{${result.join(', ')}}`;
  },

  /**
   * Python-specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lex_rule',
    );
    this.writeData('<<LEX_RULE_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Python-specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      '_handler',
    );
    this.writeData('<<PRODUCTION_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Generates Ruby's `def` methods for handlers.
   */
  _generateHandlers(handlers, name) {
    return handlers.map(({args, action}, index) => {
      return `def self.${name}${index + 1}(${args})\n` +
        `${action}\nend`
    });
  },
};

module.exports = RubyParserGeneratorTrait;