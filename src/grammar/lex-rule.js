/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

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
   */
  constructor({startConditions, matcher, tokenHandler}) {
    this._startConditions = startConditions;
    this._rawMatcher = `^${matcher}`;
    this._matcher = new RegExp(this._rawMatcher);
    this._rawHandler = tokenHandler;
    this._handler = this._buildHandler(tokenHandler);
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
   * Returns token data.
   */
  getTokenData(yytext, yy, tokenizer) {
    return this._handler(yytext, yy, tokenizer);
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
   * Builds a wrapper function on top of the handler.
   * This is in order to be able directly modify `yytext`,
   * (which is closured), and return a token.
   */
  _buildHandler(tokenHandler) {
    // Matched text and its length.
    let yytext, yyleng;
    let tokenFn;
    // Global `yy` object shared accross lex rules. Lex rules
    // may track any needed state via it.
    let yy;

    try {
      /* Generate the function handler only for JS language */
      tokenFn = eval(`(function() { ${tokenHandler} })`);
    } catch (e) {
      /* And skip for other languages, which use raw handler in generator */
    }
    return function(_yytext, _yy, _tokenizer) {
      yytext = _yytext;
      yyleng = _yytext.length;
      yy = _yy;
      // The `tokenFn` is called in the context of
      // of tokenizer, in order to access its `pushState`
      // and other methods.
      let token = tokenFn.call(_tokenizer);
      return [yytext, token];
    };
  }

  static matcherFromTerminal(terminal) {
    return terminal
      .slice(1, terminal.length - 1)
      .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
  }
};
