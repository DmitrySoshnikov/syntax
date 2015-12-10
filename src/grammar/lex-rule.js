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
  constructor(lexRule) {
    this._raw = lexRule;
    this._build();
  }

  getMatcher() {
    return this._matcher;
  }

  getToken() {
    return this._token;
  }

  getRaw() {
    return this._raw;
  }

  _build() {
    let lastColonIdx = this._raw.lastIndexOf('•');

    let matcherString = this._raw.slice(0, lastColonIdx).trim();

    this._token = new GrammarSymbol(
      this._raw.slice(lastColonIdx + 1).trim()
    );

    this._matcher = new RegExp(`^${matcherString}`);
  }
};
