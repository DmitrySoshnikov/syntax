/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import LRItem from './lr-item';

/**
 * An abstraction for an items set (kernel plus added),
 * known as a "closure". Recursively closes over
 * all added items, eventually forming an LR-parsing state.
 */
export default class Closure {
  constructor({kernelItem, grammar, canonicalCollection}) {
    this._kernelItem = this._currentItem = kernelItem;
    this._items = [kernelItem];
    this._grammar = grammar;
    this._canonicalCollection = canonicalCollection;
    this._number = null;
    this._build();
    this._canonicalCollection.registerState(this);
  }

  /**
   * State number in the canonical collection.
   */
  getNumber() {
    return this._number;
  }

  /**
   * Canonical collection can assign a specific
   * number to this state.
   */
  setNumber(number) {
    this._number = number;
  }

  /**
   * Kernel item for which the closure is built.
   */
  getKernel() {
    return this._kernelItem;
  }

  /**
   * All items in this closure (kernel plus all expanded).
   */
  getItems() {
    return this._items;
  }

  /**
   * Whether this state is final.
   */
  isFinal() {
    return this.getItems().length === 1 && this.getItems()[0].isFinal();
  }

  /**
   * Executes goto operation for every item.
   */
  goto() {
    this.getItems().forEach(item => item.goto());
  }

  /**
   * Expands items until there is any item (kernel or added)
   * with a non-terminal at the dot position.
   */
  _build() {
    if (!this._currentItem.shouldClosure()) {
      return;
    }

    let productionsForSymbol = this._grammar.getProductionsForSymbol(
      this._currentItem.getCurrentSymbol()
    );

    productionsForSymbol.forEach(production => {
      let itemKey = LRItem.keyForItem(production, 0);
      let addedItem;

      // Register the item, or reuse the same one, it
      // should already be connected to needed closure.
      if (!this._canonicalCollection.isItemRegistered(itemKey)) {
        // All added items are always at position 0.
        addedItem = new LRItem({
          production,
          dotPosition: 0,
          grammar: this._grammar,
          canonicalCollection: this._canonicalCollection,
        });
        this._canonicalCollection.registerItem(addedItem);
      } else {
        addedItem = this._canonicalCollection.getItemForKey(itemKey);
      }

      this._items.push(addedItem);
      this._currentItem = addedItem;

      // Recursively closure the added item.
      this._build();
    });
  }
}
