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
    const semanticActionData = this.getSemanticActionData(production);

    if (!semanticActionData) {
      return null;
    }

    semanticActionData.action =
      this._scopeVars(semanticActionData.action) + ';';

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
      PHP_TOKENIZER_TEMPLATE.replace(/<\?php/g, ''),
    );
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    let lexRules = this._grammar.getLexRules().map(lexRule => {
      const action = this._scopeVars(lexRule.getRawHandler()) + ';';
      this._lexHandlers.push({args: '', action});

      return `['/${lexRule.getRawMatcher()}/', ` +
        `'_lex_rule${this._lexHandlers.length}']`;
    });

    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code) {
    return code
      .replace(/yytext/g, 'yyparse::$yytext')
      .replace(/yyleng/g, 'yyparse::$yyleng')
      .replace(/\b__\b/g, 'yyparse::$__')
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
      let key = k.replace(/'/g, "\\'");
      result.push("'" + key + "' => " + this._toPHPArray(value));
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
   * Generates Python's `def` function declarations for handlers.
   */
  _generateHandlers(handlers, name) {
    return handlers.map(({args, action}, index) => {
      return `private static function ${name}${index + 1}(${args}) {\n` +
        `${action}\n}`
    });
  },
};

module.exports = PHPParserGeneratorTrait;