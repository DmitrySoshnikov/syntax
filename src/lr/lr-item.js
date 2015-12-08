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
    this._grammar = grammar;
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
   * Whether this item should go to an outer closure state.
   */
  shouldConnect() {
    return !this.isFinal() && !this.isConnected();
  }

  /**
   * Whether this item is already connected to a closure.
   */
  isConnected() {
    return this._gotoPointer !== null;
  }

  /**
   * Connects this item to the outer closure state.
   */
  connect(closure) {
    this._gotoPointer = closure;
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
    if (!this._closure) {
      this._closure = new Closure({
        initialKernelItem: this,
        grammar: this._grammar,
        canonicalCollection: this._canonicalCollection,
      });
    }
    return this._closure;
  }

  /**
   * Goto operation from this item. The item can be used in
   * different closures, but always goes to the same outer closure.
   * The state closure from which item goes to an outer one, is passed
   * as a parameter.
   *
   * Initial item (for the augmented production) builds the whole
   * graph of the canonical collection of LR items.
   *
   * Several different items can also go to the same closure if
   * they do transition on the same symbol from current state.
   */
  goto(fromClosure) {
    // Final items don't go anywhere, and an item can already be connected
    // from previous calculaion when it was used in other state.
    if (this.shouldConnect()) {

      let transitionSymbol = this.getCurrentSymbol().getSymbol();
      let advancedItem = this._advance();

      // If some previous kernel item already created the
      // transition closure, just connect our item to it.
      if (fromClosure.hasTransitionOnSymbol(transitionSymbol)) {

        let toClosure = fromClosure
          .getTransitionOnSymbol(transitionSymbol)
          .closure;

        // Append another item to the transition.
        fromClosure.addSymbolTransition({item: this});

        // Connect the item to the outer closure.
        this.connect(toClosure);

        // And register our item as an additional kernel.
        toClosure.addKernelItem(advancedItem);
      } else {
        this._gotoPointer = new Closure({
          initialKernelItem: advancedItem,
          grammar: this._grammar,
          canonicalCollection: this._canonicalCollection,
        });
        // Register item and state.
        fromClosure.addSymbolTransition({
          item: this,
          closure: this._gotoPointer,
        });
      }

      // And recursively go to the next closure state if needed.
      //this._gotoPointer.goto();
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
  getKey() {
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
