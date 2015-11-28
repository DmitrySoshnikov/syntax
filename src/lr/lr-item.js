/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Closure from './closure';

/**
 * An LRItem is built for a production at particular
 * dot position. The kernel item (for the augmented production)
 * builds the canonical collection, recursively applying
 * "closure" and "goto" operations.
 */
export default class LRItem {
  constructor({production, dotPosition = 0, grammar, canonicalCollection}) {
    this._production = production;
    this._dotPosition = dotPosition;
    this._grammar = grammar;new
    this._canonicalCollection = canonicalCollection;
    this._closure = null;
    this._gotoPointer = null;
  }

  /**
   * Returns productions of this item.
   */
  getProduction() {
    return this._production;
  }

  /**
   * Whether this item should be closured.
   */
  shouldClosure() {
    return !this.isFinal() && this.getCurrentSymbol().isNonTerminal();
  }

  /**
   * Whether transition from this item does "shift" action.
   */
  isShift() {
    return !this.isFinal() && this.getCurrentSymbol().isTerminal();
  }

  /**
   * Whether transition from this item does "reduce" action.
   */
  isReduce() {
    return this.isFinal() && !this.getProduction().isAugmented();
  }

  /**
   * Whether this item is already connected to a closure.
   */
  isConnected() {
    return this._gotoPointer !== null;
  }

  /**
   * Returns the closure object for this item.
   */
  getClosure() {
    return this._closure;
  }

  /**
   * Applies closure operation for this item.
   */
  closure() {
    if (!this.shouldClosure()) {
      return;
    }
    this._closure = new Closure({
      kernelItem: this,
      grammar: this._grammar,
      canonicalCollection: this._canonicalCollection,
    });
    return this._closure;
  }

  /**
   * Goto operation from this item. The item can be used in
   * different closures, but always goes to the same outer closure.
   *
   * Initial item (for the augmented production) builds the whole
   * graph of the canonical collection of LR items.
   */
  goto() {
    if (!this.isFinal() && !this.isConnected()) {
      this._gotoPointer = new Closure({
        kernelItem: this._advance(),
        grammar: this._grammar,
        canonicalCollection: this._canonicalCollection,
      });

      // And recursively go to the next closure state if needed.
      this._gotoPointer.goto();
    }
    return this._gotoPointer;
  }

  /**
   * The symbol at the dot position.
   */
  getCurrentSymbol() {
    return this._production.getRHS()[this._dotPosition];
  }

  /**
   * Whether we have seen the whole production.
   */
  isFinal() {
    return this._dotPosition === this._production.getRHS().length;
  }

  /**
   * Returns serialized representation of an item. This is used
   * as a key in the global registry of all items that participate
   * in closures. E.g. `A -> • a A`.
   */
  serialize() {
    return LRItem.keyForItem(this._production, this._dotPosition);
  }

  static keyForItem(production, dotPosition) {
    let RHS = production.getRHS().map(symbol => symbol.getSymbol());
    RHS.splice(dotPosition, 0, '•');

    return `${production.getLHS().getSymbol()} -> ${RHS.join(' ')}`;
  }

  /**
   * Returns an a new item with an advanced dot position.
   */
  _advance() {
    if (this.isFinal()) {
      throw new Error(`Item for ${this._production.getRaw()} is final.`);
    }
    return new LRItem({
      production: this._production,
      dotPosition: this._dotPosition + 1,
      grammar: this._grammar,
      canonicalCollection: this._canonicalCollection,
    });
  }
};
