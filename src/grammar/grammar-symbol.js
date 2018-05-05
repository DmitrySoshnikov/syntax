/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import {EOF, EPSILON} from '../special-symbols';

/**
 * Symbols are stored in the registry, and retrieved from it
 * if the symbol was already created.
 */
const registry = {};

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
    const first = this._symbol[0];
    const last = this._symbol[this._symbol.length - 1];

    return (
      (first === '"' && last === '"') ||
      (first === "'" && last === "'")
    );
  }

  /**
   * Returns original symbol from an extended name. 1X3 => X
   */
  getOrignialSymbol() {
    if (!this._originalSymbol) {
      this._originalSymbol = this._symbol
        .replace(/^\d+\|/, '')
        .replace(/\|(?:\d+|\$)$/, '');
    }
    return this._originalSymbol;
  }

  /**
   * Returns start context (in extended LALR 1X3 => 1)
   */
  getStartContext() {
    if (!this._startContext) {
      this._startContext = Number(this._symbol.match(/^(\d+)\|/)[1]);
    }
    return this._startContext;
  }

  /**
   * Returns start context (in extended LALR 1X3 => 1)
   */
  getEndContext() {
    if (!this._endContext) {
      this._endContext = Number(this._symbol.match(/\|(\d+)$/)[1]);
    }
    return this._endContext;
  }

  /**
   * Returns a symbol from the registry, or creates one.
   */
  static get(symbol) {
    if (!registry.hasOwnProperty(symbol)) {
      registry[symbol] = new GrammarSymbol(symbol);
    }
    return registry[symbol];
  }

  /**
   * Returns raw terminal value (between quotes)
   */
  getTerminalValue() {
    this._checkTerminal();
    return this._symbol.slice(1, this._symbol.length - 1);
  }

  /**
   * Returns a terminal quoted into single or double-quotes,
   * depending on which quotes it's already wrapped itself.
   */
  quotedTerminal() {
    this._checkTerminal();
    let isSingleQuoted = this._symbol[0] === "'";

    let leftQuote = isSingleQuoted ? `"'` : `'"`;
    let rightQuote = isSingleQuoted ? `'"` : `"'`;

    return `${leftQuote}${this.getTerminalValue()}${rightQuote}`;
  }

  /**
   * Checks whether a symbol is a non-terminal.
   */
  isNonTerminal() {
    return !this.isTerminal();
  }

  /**
   * Checks whether a symbol is Epsilon (instance method).
   */
  isEpsilon() {
    return GrammarSymbol.isEpsilon(this._symbol);
  }

  /**
   * Checks whether a symbol is an end of file (instance method).
   */
  isEOF() {
    return this._symbol === EOF;
  }

  /**
   * Checks whether a symbol is Epsilon (static method).
   */
  static isEpsilon(symbol) {
    return symbol.includes(EPSILON);
  }

  /**
   * Checks whether a symbol is EOF (static method).
   */
  static isEOF(symbol) {
    return symbol === EOF;
  }

  /**
   * Returns raw symbol.
   */
  getSymbol() {
    return this._symbol;
  }

  /**
   * Checks whether the symbol equals to the passed one.
   */
  isSymbol(symbol) {
    return this.getSymbol() === symbol;
  }

  _checkTerminal() {
    if (!this.isTerminal()) {
      throw new TypeError(`Symbol ${this._symbol} is not terminal.`);
    }
  }
};
