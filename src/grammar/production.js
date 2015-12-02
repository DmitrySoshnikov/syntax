/** * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from './grammar-symbol';
import {EPSILON} from '../special-symbols';

/**
 * A produciton in BNF grammar.
 */
export default class Production {
  /**
   * Receives a raw production in a view of:
   *
   * LHS -> RHS or a short alternative
   *      | RHS if the LHS is the same.
   */
  constructor(production, number) {
    this._raw = production;
    this._number = number;
    this._isAugmented = number === 0;
    this._normalize();
  }

  getRaw() {
    return this._raw;
  }

  /**
   * Returns number of the production
   * in the grammar.
   */
  getNumber() {
    return this._number;
  }

  /**
   * Whether this production is augmented.
   */
  isAugmented() {
    return this._isAugmented;
  }

  /**
   * For cases like:
   *
   *   A -> aA
   *      | b
   *
   * For the second alternative, grammar will call setLHS('A').
   */
  setLHS(LHS) {
    if (!(LHS instanceof GrammarSymbol)) {
      LHS = new GrammarSymbol(LHS);
    }
    this._LHS = LHS;
  }

  getLHS() {
    return this._LHS;
  }

  getRHS() {
    return this._RHS;
  }

  toString() {
    let RHS = this._RHS.map(symbol => symbol.getSymbol());
    return `${this._LHS.getSymbol()} -> ${RHS.join(' ')}`
  }

  _normalize() {
    let splitter = this._raw.indexOf('->') !== -1 ? '->' : '|';
    let splitted = this._raw.split(splitter);
    let LHS = new GrammarSymbol(splitted[0].trim());
    let rhsStr = splitted[1].trim();

    let RHS = [];

    // If no RHS provided, assume it's ε. We support
    // both formats, explicit: F -> ε, and implicit: F ->

    if (!rhsStr) {
      RHS.push(new GrammarSymbol(EPSILON));
    } else {
      let rhsProd = rhsStr.split(/\s+/);
      for (let i = 0; i < rhsProd.length; i++) {
        if (rhsProd[i] === '"' && rhsProd[i + 1] === '"') {
          RHS.push(new GrammarSymbol('" "'));
          i++;
        } else {
          RHS.push(new GrammarSymbol(rhsProd[i]));
        }
      }
    }

    this._LHS = LHS;
    this._RHS = RHS;
  }
};
