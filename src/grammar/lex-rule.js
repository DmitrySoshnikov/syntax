/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from '../code-unit';

/**
 * A lexical grammar rule.
 */
export default class LexRule {
  /**
   * Format of a rule is: `<matcher> : <tokenType>`.
   *
   * In the simplest case a terminal matches itself, and the
   * token is also the value of the terminal:
   *
   *   a : "a"
   *
   * In other regexp cases, the token can be a class of
   * tokens, like `NUMBER`:
   *
   *   [0-9]+(\.[0-9]+)? : NUMBER
   *
   * The `startConditions` allows specifying lexer state, and execute
   * a rule only if a tokenizer is within this state.
   *
   * Available options:
   *
   *   - case-insensitive: boolean
   */
  constructor({
    startConditions,
    matcher,
    tokenHandler,
    options = {},
  }) {
    this._startConditions = startConditions;
    this._options = options;
    this._originalMatcher = matcher;
    this._rawMatcher = `^${matcher}`;
    this._matcher = this._buildMatcher(this._rawMatcher);
    this._rawHandler = tokenHandler;
    this._handler = this._buildHandler(tokenHandler);
  }

  /**
   * Returns options.
   */
  getOptions() {
    return this._options;
  }

  /**
   * Whether the rule is case-insensitive.
   */
  isCaseInsensitive() {
    return !!this._options['case-insensitive'];
  }

  /**
   * Retusn original matcher string.
   */
  getOriginalMatcher() {
    return this._originalMatcher;
  }

  /**
   * Retusn raw matcher string.
   */
  getRawMatcher() {
    return this._rawMatcher;
  }

  /**
   * Returns matcher function.
   */
  getMatcher() {
    return this._matcher;
  }

  /**
   * Returns raw handler.
   */
  getRawHandler() {
    return this._rawHandler;
  }

  /**
   * Returns handler.
   */
  getHandler() {
    return this._handler;
  }

  /**
   * Returns token data.
   */
  getTokenData(matched, tokenizer) {
    return this._handler(matched, tokenizer);
  }

  /**
   * Returns start conditions for this rule.
   */
  getStartConditions() {
    return this._startConditions;
  }

  /**
   * Whether this rule has start conditions.
   */
  hasStartConditions() {
    return !!this._startConditions;
  }

  /**
   * Generates a data array like used in lex grammar files
   * from the LexRule instance.
   */
  toData() {
    const data = [
      this.getOriginalMatcher(),
      this.getRawHandler(),
    ];

    if (this.hasStartConditions()) {
      data.unshift(this.getStartConditions());
    }

    return data;
  }

  /**
   * Creates an actual regexp object from the regexp string (only for JS target
   * langauges, other plugins use rawMatcher instead ad code generation).
   */
  _buildMatcher(rawMatcher) {
    this._matcher = null;
    try {
      const flags = [];

      if (this._options['case-insensitive']) {
        flags.push('i');
      }

      this._matcher = new RegExp(rawMatcher, flags.join(''));
    } catch (e) {
      /* Skip for other languages */
    }
    return this._matcher;
  }

  /**
   * Builds a wrapper function on top of the handler.
   * This is in order to be able directly modify `yytext`,
   * (which is closured), and return a token.
   */
  _buildHandler(tokenHandler) {
    try {
      /* Generate the function handler only for JS language */
      const handler = CodeUnit.createHandler(/* no params */'', tokenHandler);
      return (matched, tokenizer) => {
        CodeUnit.setBindings({
          yytext: matched,
          yyleng: matched.length,
        });

        // Call the handler.
        const token = handler.call(tokenizer);
        const yytext = CodeUnit.getSandbox().yytext;

        // Update the `yyleng` in case `yytext` was modified.
        CodeUnit.setBindings({
          yyleng: yytext.length,
        });

        // The handler may mutate `yytext` during execution,
        // return a possibly updated one, along with the token.
        return [yytext, token];
      };
    } catch (e) {
      /* And skip for other languages, which use raw handler in generator */
    }
  }

  static matcherFromTerminal(terminal) {
    return terminal
      .slice(1, -1)
      .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
  }
};
