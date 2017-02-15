/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * Python tokenizer template.
 */
const PHP_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.php`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for PHP.
 */
const PHPParserGeneratorTrait = {

  /**
   * Generates parser class name.
   */
  generateParserClassName(className) {
    this.writeData('<<PARSER_CLASS_NAME>>', className);
  },

  /**
   * Generates namespace.
   */
  generateNamespace() {
    const ns = this.getOptions().namespace;
    let nsString = '';

    if (ns && ns !==  '') {
      nsString = `namespace ${ns};`;
    }

    this.writeData('<<NAMESPACE>>', nsString);
  },

  /**
   * Generates parsing table in PHP arrays format.
   */
  generateParseTable() {
    this.writeData(
      '<<TABLE>>',
      this._toPHPArray(this.generateParseTableData()),
    );
  },

  /**
   * Generates tokens table in PHP arrays format.
   */
  generateTokensTable() {
    this.writeData('<<TOKENS>>', this._toPHPArray(this._tokens));
  },

  /**
   * Production handlers are implemented as private methods
   * on the `yyparse` class.
   */
  buildSemanticAction(production) {
    let action = this.getSemanticActionCode(production);

    if (!action) {
      return null;
    }

    action = this._scopeVars(action) + ';';

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
      PHP_TOKENIZER_TEMPLATE.replace(/<\?php/g, ''),
    );
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    const lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      const action = this._scopeVars(lexRule.getRawHandler()) + ';';
      this._lexHandlers.push({args: '', action});

      const flags = [];

      if (lexRule.isCaseInsensitive()) {
        flags.push('i');
      }

      return `['/${lexRule.getRawMatcher()}/${flags.join('')}', ` +
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
      `${this._toPHPArray(result)}`,
    );
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code) {
    return code
      .replace(/\$?yytext/g, 'yyparse::$yytext')
      .replace(/\$?yyleng/g, 'yyparse::$yyleng')
      .replace(/\b__\b/g, 'yyparse::$__')
      .replace(/\b__loc\b/g, 'yyparse::$__loc')
      .replace(/yyloc/g, 'yyparse::yyloc')
      .replace(/\b_(\d+)/g, '$_$1');
  },

  /**
   * Converts JS object to PHP's array representation.
   */
  _toPHPArray(object) {
    if (typeof object !== 'object') {
      return JSON.stringify(object);
    }
    let result = [];
    for (let k in object) {
      let value = object[k];

      if (Array.isArray(object)) {
        result.push(this._toPHPArray(value));
      } else {
        let key = k.replace(/'/g, "\\'");
        result.push("'" + key + "' => " + this._toPHPArray(value));
      }
    }
    return `array(${result.join(', ')})`;
  },

  /**
   * Python-specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lex_rule',
      false
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
      true
    );
    this.writeData('<<PRODUCTION_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Generates Python's `def` function declarations for handlers.
   */
  _generateHandlers(handlers, name, isStatic) {
    return handlers.map(({args, action}, index) => {
      return `private ${isStatic ? 'static ': ''}function ${name}${index + 1}` +
        `(${args}) {\n${action}\n}`
    });
  },
};

module.exports = PHPParserGeneratorTrait;