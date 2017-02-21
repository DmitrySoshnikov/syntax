/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

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

import LRItem from './lr-item';

export default class State {

  /**
   * A closure state may have several kernel items. An initial kernel
   * item can be passed in the constructor, other kernel items can
   * be added later via `add` method.
   */
  constructor(
    kernelItems,
    grammar,
    canonicalCollection,
  ) {
    this._kernelItems = kernelItems;
    this._items = [];
    this._grammar = grammar;
    this._canonicalCollection = canonicalCollection;
    this._number = null;

    // A map from transition symbol to the next state.
    this._transitionsForSymbol = null;

    // To avoid infinite recursion in case if an added item
    // is for a recursive production, S -> S "a".
    this._itemsMap = {};

    // Also items map, but by LR(0) key.
    this._lr0ItemsMap = {};

    // Add initial items, and closure them if needed.
    this.addItems(this._kernelItems);

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

  /**
   * Returns all reduce items in this set.
   */
  getReduceItems() {
    return this.getItems().filter(item => item.isReduce());
  }

  /**
   * Calculates all the conflicts in the state, marking the
   * state as inadequate in case of "s/r" or "r/r" conflicts.
   *
   * Note: conflicts only possible in states that contain
   * reduce items, plus another reduce or shift item.
   */
  analyzeConflicts() {
    this._conflicts = {sr: [], rr: []};

    let reduceItems = this.getReduceItems();

    // "reduce-reduce" conflicts.
    if (reduceItems.length > 1) {
      reduceSet: for (let reduceItem of reduceItems) {
        for (let reduceItemToCheck of reduceItems) {
          if (reduceItem !== reduceItemToCheck &&
              reduceItem.conflictsWithReduceItem(reduceItemToCheck)) {
            this._conflicts.rr = reduceItems;
            break reduceSet;
          }
        }
      }
    }

    // "shift-reduce" conflicts.
    this.getItems().forEach(item => {
      if (!item.isShift()) {
        return;
      }
      reduceItems.forEach(reduceItem => {
        if (reduceItem.conflictsWithShiftSymbol(item.getCurrentSymbol())) {
          this._conflicts.sr.push([item, reduceItem]);
        }
      });
    });

    return this._conflicts;
  }

  /**
   * Gets conflicts of this set.
   */
  getConflicts() {
    if (!this._conflicts) {
      this._conflicts = this.analyzeConflicts();
    }
    return this._conflicts;
  }

  /**
   * Gets "reduce-reduce" conflicts.
   */
  getRRConflicts() {
    return this.getConflicts().rr;
  }

  /**
   * Gets "shift-reduce" conflicts.
   */
  getSRConflicts() {
    return this.getConflicts().sr;
  }

  /**
   * Whether the state is inadequate, i.e. has conflicts.
   */
  isInadequate() {
    return this.getConflicts().sr.length > 0 ||
      this.getConflicts().rr.length > 0;
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

  setSymbolTransition(item, state) {
    let symbol = item.getCurrentSymbol().getSymbol();

    if (!this.hasTransitionOnSymbol(symbol)) {
      this._transitionsForSymbol[symbol] = {
        items: [],
        itemsMap: {},
        state,
      };
    }

    let transitionsForSymbol = this._transitionsForSymbol[symbol];

    if (!transitionsForSymbol.itemsMap.hasOwnProperty(item.getKey())) {
      transitionsForSymbol.itemsMap[item.getKey()] = item;
      transitionsForSymbol.items.push(item);
    }

    if (state) {
      transitionsForSymbol.state = state;
      item.connect(state);
    }
  }

  getItemTransion(itemKey) {
    return this.getItemTransionInfo(itemKey).state;
  }

  getItemTransionInfo(itemKey) {
    if (!this._itemsMap.hasOwnProperty(itemKey)) {
      throw new Error(`Item ${itemKey} is not in the state ${this._number}.`);
    }

    let item = this._itemsMap[itemKey];

    if (item.isFinal()) {
      throw new Error(`Item ${itemKey} is final.`);
    }

    return this.getTransitionOnSymbol(item.getCurrentSymbol().getSymbol());
  }

  /**
   * `Goto` operation from the items set. If the state has several items with
   * the same transition symbol, they all go to the same outer state. If
   * a transition for this kernel items set was already calculated in some
   * previous state, then a new state is not created, instead the items are
   * connected to the calculated state.
   */
  goto() {
    if (this._visited) {
      return;
    }

    // Init the transition to null, it will be set
    // new state in the `goto` operation.
    if (!this._transitionsForSymbol) {
      this._transitionsForSymbol = {};
      this._items.forEach(item => {
        if (item.isFinal()) {
          return;
        }
        this.setSymbolTransition(
          item,
          /* state */ null,
        )
      });
    }

    // Build the outer states if needed.
    Object.keys(this._transitionsForSymbol).forEach(symbol => {
      let transitionsForSymbol = this.getTransitionOnSymbol(symbol);

      // Already calculated the outer state, exit.
      if (transitionsForSymbol.state) {
        return;
      }

      let items = transitionsForSymbol.items;

      // See if we already calculated transition for this kernel set.
      let outerState = this._canonicalCollection
        .getTranstionForItems(items);

      // If not, create a new outer state with advanced kernel items.
      if (!outerState) {

        outerState = new State(
          /* kernelItems */ items.map(item => item.advance()),
          /* grammar */ this._grammar,
          /* canonicalCollection */ this._canonicalCollection,
        );

        this._canonicalCollection
          .registerTranstionForItems(items, outerState);
      }

      // And connect our items to it.
      items.forEach(item => {
        this.setSymbolTransition(
          item,
          /* state */ outerState
        );
      });

    });

    this._visited = true;

    // Recursively goto further in the graph.
    Object.keys(this._transitionsForSymbol).forEach(symbol => {
      this.getTransitionOnSymbol(symbol).state.goto();
    });

  }

  isKernelItem(item) {
    return this._kernelItems.indexOf(item) !== -1;
  }

  /**
   * Adds items to this state, and closures them if needed.
   */
  addItems(items) {
    items
      .map(item => this.addItem(item))
      .forEach(item => item && item.closure());
  }

  /**
   * Adds an item to this state.
   */
  addItem(item) {
    if (this._itemsMap.hasOwnProperty(item.getKey())) {
      return;
    }

    this._items.push(item);
    this._itemsMap[item.getKey()] = item;

    if (!this._lr0ItemsMap[item.getLR0Key()]) {
      this._lr0ItemsMap[item.getLR0Key()] = [];
    }
    this._lr0ItemsMap[item.getLR0Key()].push(item);

    item.setState(this);

    return item;
  }

  /**
   * Returns an item by key.
   */
  getItemByKey(key) {
    return this._itemsMap[key];
  }

  /**
   * Returns an item by LR(0) key.
   */
  getItemByLR0Key(lr0Key) {
    let lr0ItemsCount = this._lr0ItemsMap[lr0Key].length;

    if (lr0ItemsCount !== 1) {
      throw new Error(
        `Number of LR0 items for ${lr0Key} is not 1 in ${this.getNumber()}. ` +
        `Call mergeLR0Items before accessing this method.`
      );
    }

    return this._lr0ItemsMap[lr0Key][lr0ItemsCount - 1];
  }


  /**
   * Merges items with the same LR(0) parts for LALR(1).
   */
  mergeLR0Items() {
    Object.keys(this._lr0ItemsMap).forEach(lr0Key => {
      let items = this._lr0ItemsMap[lr0Key];
      let rootItem = items[0];

      // Merge the items, keeping only one.
      while (items.length > 1) {
        this.mergeTwoItems(rootItem, items.pop());
      }
    });
  }

  mergeTwoItems(first, second) {
    let transition = !first.isFinal()
      ? this.getItemTransionInfo(first.getKey())
      : null;

    delete this._itemsMap[first.getKey()];

    if (transition) {
      delete transition.itemsMap[first.getKey()];
    }

    let secondKey = second.getKey();

    first.mergeLookaheadSet(second.getLookaheadSet());

    // And remove it from all collections.
    delete this._itemsMap[secondKey];

    let itemIndex = this._items.indexOf(second);
    if (itemIndex !== -1) {
      this._items.splice(itemIndex, 1);
    }

    itemIndex = this._kernelItems.indexOf(second);
    if (itemIndex !== -1) {
      this._kernelItems.splice(itemIndex, 1);
    }

    if (transition) {
      delete transition.itemsMap[secondKey];

      itemIndex = transition.items.indexOf(second);
      if (itemIndex !== -1) {
        transition.items.splice(itemIndex, 1);
      }
    }

    this._itemsMap[first.getKey()] = first;

    if (transition) {
      transition.itemsMap[first.getKey()] = first;
    }
  }

  /**
   * Merges the state with another one, that has the same
   * LR(0) items, but which differs only in lookaheads.
   * This is used in LALR(1) mode when is compressed from CLR(1).
   */
  mergeWithState(state) {
    if (!this._grammar.getMode().isLALR1()) {
      throw new Error(
        `States can be merged only in LALR(1) mode. ` +
        `This mode is ${this._grammar.getMode().toString()}.`
      );
    }

    if (state.getItems().length !== this.getItems().length) {
      throw new Error(
        `LALR(1): State ${state.getNumber()} is not compatible ` +
        `with state ${this.getNumber()}.`
      );
    }

    if (LRItem.keyForItems(this.getKernelItems()) !==
        LRItem.keyForItems(state.getKernelItems())) {

      this.getItems().forEach(item => {
        let thatItem = state.getItemByLR0Key(item.getLR0Key());

        if (!thatItem) {
          throw new Error(
            `Item ${item.toString()} presents in state ${this.getNumber()}, ` +
            `but is absent in the ${state.getNumber()}.`
          );
        }

        this.mergeTwoItems(item, thatItem);
      });
    }

    // After merging lookaheads, we should un-register this new
    // idential state, since it was registered in the constructor.
    this._canonicalCollection.unregisterState(state);

    return this;
  }
};
