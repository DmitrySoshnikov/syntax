/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from './grammar-symbol';

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
   */
  constructor({matcher, tokenHandler}) {
    this._matcher = new RegExp(`^${matcher}`);
    this._handler = new Function(tokenHandler);
  }

  getMatcher() {
    return this._matcher;
  }

  getToken() {
    return this._handler();
  }
};
