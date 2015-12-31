/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import LRItem from './lr-item';

/**
 * An abstraction for an items set (kernel plus added),
 * known as a "closure". Recursively closes over
 * all added items, eventually forming an LR-parsing state.
 *
 * Usually there is one kernel item in a state, however there are
 * cases when kernel may contain several items. E.g. being in the state:
 *
 * S' -> • S
 * S  -> • S "a"
 *     | • "b"
 *
 * and having a transition on S, we get both first two items in the
 * kernel of the next state:
 *
 * S' -> S •
 * S  -> S • "a"
 */
export default class Closure {

  /**
   * A closure state may have several kernel items. An initial kernel
   * item can be passed in the constructor, other kernel items can
   * be added later via `add` method.
   */
  constructor({
    initialKernelItem,
    grammar,
    canonicalCollection,
    setsGenerator,
  }) {
    this._kernelItems = [];
    this._items = [];
    this._grammar = grammar;
    this._canonicalCollection = canonicalCollection;
    this._setsGenerator = setsGenerator;
    this._number = null;

    // A map from transition symbol to the next state.
    this._transitionsForSymbol = {};

    // To avoid infinite recursion in case if an added item
    // is for a recursive production, S -> S "a".
    this._handledNonTerminals = {};

    if (initialKernelItem) {
      this.addKernelItem(initialKernelItem);
    }

    // And register the state in the collection.
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
   * Kernel items for which the closure is built.
   */
  getKernelItems() {
    return this._kernelItems;
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
   * Whether the state is accepting.
   */
  isAccept() {
    return this.isFinal() && this.getItems()[0].getProduction().isAugmented();
  }

  hasTransitionOnSymbol(symbol) {
    return this._transitionsForSymbol.hasOwnProperty(symbol);
  }

  getTransitionOnSymbol(symbol) {
    if (!this.hasTransitionOnSymbol(symbol)) {
      return null;
    }
    return this._transitionsForSymbol[symbol];
  }

  addSymbolTransition({item, closure}) {
    let transitionSymbol = item.getCurrentSymbol().getSymbol();

    if (!this.hasTransitionOnSymbol(transitionSymbol)) {
      this._transitionsForSymbol[transitionSymbol] = {
        items: [],
        closure,
      };
    }

    this._transitionsForSymbol[transitionSymbol].items.push(item);
  }

  /**
   * Goto operation from the items set. The item can be used in
   * different closures, but always goes to the same outer closure
   * (the `this` closure is passed as a parameter to the item's goto).
   *
   * Initial item (for the augmented production) builds the whole
   * graph of the canonical collection of LR items.
   *
   */
  goto() {
    // First all items in this state, then go to outer states.
    // This is needed since some kernel items that does transition
    // on the same symbol can go to the same state.
    this._items
      .map(item => item.shouldConnect() && item.goto(this))
      .forEach(outerState => outerState && outerState.goto());
  }

  addKernelItem(kernelItem) {
    this._kernelItems.push(kernelItem);
    this.addItem(kernelItem);
  }

  isKernelItem(item) {
    return this._kernelItems.indexOf(item) !== -1;
  }

  /**
   * Expands items until there is any item (kernel or added)
   * with a non-terminal at the dot position.
   */
  addItem(item) {
    this._items.push(item);

    if (!item.shouldClosure()) {
      return;
    }

    let currentSymbol = item.getCurrentSymbol().getSymbol();

    if (this._handledNonTerminals.hasOwnProperty(currentSymbol)) {
      return;
    }

    this._handledNonTerminals[currentSymbol] = true;

    let productionsForSymbol = this._grammar
      .getProductionsForSymbol(currentSymbol);

    productionsForSymbol.forEach(production => {
      // Recursively closure the added item.
      this.addItem(this._getItemForProduction(
        production,
        this._calculateLookaheadSet(item),
      ));
    });
  }

  /**
   * Calculates a lookahead set for an added item
   * in the closure. The lookahead set is determined from
   * the previous item as First(followPart + previousLookahead).
   *
   * A -> a • B ß, a/b
   * B -> ∂, c/d
   *
   * where c/d is First(ß a b), and is the lookahead set.
   * If ß is ε, then a/b is lookahead set.
   */
  _calculateLookaheadSet(item) {
    if (!this._grammar.getMode().usesLookaheadSet()) {
      return null;
    }

    let lookaheadSet;

    let followPosition = item.getDotPosition() + 1;
    let RHS = item.getProduction().getRHS();

    if (followPosition < RHS.length) {
      let lookaheadPart = RHS.slice(followPosition);
      lookaheadSet = this._setsGenerator.firstOfRHS(lookaheadPart);
    }

    // If no follow part, or we got an empty set, use
    // lookahead of the previous item.
    if (!lookaheadSet || Object.keys(lookaheadSet).length === 0) {
      lookaheadSet = item.getLookaheadSet();
    }

    return lookaheadSet;
  }

  _getItemForProduction(production, lookaheadSet = null) {
    let itemKey = LRItem.keyForItem(production, 0, lookaheadSet);
    let item;

    // Register a new item if it's not calculated yet.
    if (!this._canonicalCollection.isItemRegistered(itemKey)) {
      item = new LRItem({
        production,
        dotPosition: 0,
        grammar: this._grammar,
        canonicalCollection: this._canonicalCollection,
        setsGenerator: this._setsGenerator,
        lookaheadSet,
      });
      this._canonicalCollection.registerItem(item);
    } else {
      // Reuse the same item which was already calculated.
      item = this._canonicalCollection.getItemForKey(itemKey);
    }

    return item;
  }
};
