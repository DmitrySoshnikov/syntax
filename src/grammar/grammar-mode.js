/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

export const MODES = {
  LR0: 'LR0',
  SLR1: 'SLR1',
  LALR1: 'LALR1',
  LL1: 'LL1',
};

/**
 * Grammar/parser mode.
 */
export default class GrammarMode {

  constructor(mode = MODES.LR0) {
    mode = mode.toUpperCase();

    if (!MODES.hasOwnProperty(mode)) {
      throw new TypeError(
        `\n"${mode}" is not a valid parsing mode. ` +
        `Valid modes are: ${Object.keys(MODES).join(', ')}.\n`
      );
    }

    this._mode = mode;
  }

  getRaw() {
    return this._mode;
  }

  isLL() {
    return this._mode === MODES.LL1;
  }

  isLR() {
    return !this.isLL();
  }

  /**
   * Returns string representation of a mode.
   * LR0 -> LR(0)
   */
  toString() {
    return `${this._mode.slice(0, -1)}(${this._mode[this._mode.length - 1]})`;
  }
}