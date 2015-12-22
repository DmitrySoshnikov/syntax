/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import {EPSILON} from '../special-symbols';

/**
 * Class encapsulates operations with one
 * grammar symbol (terminal or non-terminal)
 */
export default class GrammarSymbol {
  constructor(symbol) {
    this._symbol = symbol;
  }

  /**
   * Terminals in our grammar are quoted,
   * "a", " ", "var", etc.
   */
  isTerminal() {
    const quoteRe = /'|"/;

    return quoteRe.test(this._symbol[0]) &&
      quoteRe.test(this._symbol[this._symbol.length - 1]);
  }

  /**
   * Returns raw terminal value (between quotes)
   */
  getTerminalValue() {
    if (!this.isTerminal()) {
      throw new TypeError(`Symbol ${this._symbol} is not terminal.`);
    }
    return this._symbol.slice(1, this._symbol.length - 1);
  }

  isNonTerminal() {
    return !this.isTerminal();
  }

  isEpsilon() {
    return this._symbol === EPSILON;
  }

  getSymbol() {
    return this._symbol;
  }

  isSymbol(symbol) {
    return this.getSymbol() === symbol;
  }
};
