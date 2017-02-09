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
    let action = this.getSemanticActionCode(production);

    if (!action) {
      return null;
    }

    action = this._scopeVars(action);

    const args = this._scopeVars(
      this.getSemanticActionParams(production).join(',')
    );

    // Save the action, they are injected later.
    this._productionHandlers.push({args, action});
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
    const lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      const action = this._scopeVars(lexRule.getRawHandler());
      this._lexHandlers.push({args: '', action});

      // NOTE: Ruby's beginning of a string `^` symbol matches beginning of
      // every line, so use `\A` instead for it.

      return `[/\\A${lexRule.getOriginalMatcher()}/, ` +
        `'_lex_rule${this._lexHandlers.length}']`;
    });

    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
  },

  generateLexRulesByStartConditions() {
    const lexGrammar = this._grammar.getLexGrammar();
    const lexRulesByConditions = lexGrammar.getRulesByStartConditions();
    const result = {};

    for (const condition in lexRulesByConditions) {
      result[condition] = lexRulesByConditions[condition].map(lexRule =>
        lexGrammar.getRuleIndex(lexRule)
      );
    }

    this.writeData(
      '<<LEX_RULES_BY_START_CONDITIONS>>',
      `${this._toRubyHash(result)}`,
    );
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

      if (Array.isArray(object)) {
        result.push(this._toRubyHash(value));
      } else {
        let key = k.replace(/'/g, "\\'");
        result.push("'" + key + "' => " + this._toRubyHash(value));
      }
    }
    return Array.isArray(object)
      ? `[${result.join(', ')}]`
      : `{${result.join(', ')}}`;
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
      /* isStatic */ true,
    );
    this.writeData('<<PRODUCTION_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Generates Ruby's `def` methods for handlers.
   */
  _generateHandlers(handlers, name, isStatic = false) {
    return handlers.map(({args, action}, index) => {
      return `def ${isStatic ? 'self.' : ''}${name}${index + 1}(${args})\n` +
        `${action}\nend`
    });
  },
};

module.exports = RubyParserGeneratorTrait;