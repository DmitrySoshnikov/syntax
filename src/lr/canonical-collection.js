/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar/grammar';
import LRItem from './lr-item';
import SetsGenerator from '../sets-generator';

/**
 * Canonical collection of LR items.
 *
 * LR(0) and SLR(1) use collection of LR(0)-items,
 * LALR(1) and CLR(1) use collection of LR(1)-items.
 *
 * The collection is built for a grammar starting from the root
 * item (for the augmented production), which recursively
 * applies "closure" and "goto" operations.
 */
export default class CanonicalCollection {

  constructor({grammar}) {
    this._grammar = grammar;

    // Stores transition from a kernel set to an outer state.
    // This is to reuse the same outer state, if the transition was
    // already calculated. In this case we just connect to the outer state.
    this._kernelSetsTransitions = {};

    // Stores states by their kernel items LR(0) key. This is to merge
    // similar states in case of LALR(1) mode.
    this._lr0ItemSets = {};

    // All the states that form this collection.
    this._states = [];

    // These two sub-collections is only for better table output:
    // we want to have all final states to go as last rows in
    // the parsing table.
    this._itermediateStates = [];
    this._finalStates = [];

    // Root item for the augmented production, "closure" and "goto"
    // operations applied on this item build the entire collection.
    this._rootItem = new LRItem(
      /* production */ this._grammar.getAugmentedProduction(),
      /* dotPosition */ 0,
      /* grammar */ this._grammar,
      /* canonicalCollection */ this,
      /* setsGenerator */ new SetsGenerator({grammar}),
      /*lookaheadSet */ this._grammar.getMode().usesLookaheadSet()
        ? {'$': true}
        : null,
    );

    // Build the entire graph.
    this._rootItem
      .closure()
      .goto();

    this._build();

    if (this._grammar.getMode().isLALR1()) {
      this.compressCLRToLALR();
    }
  }

  /**
   * Basic LALR(1) implementation compressing from CLR(1).
   *
   * TODO: implement more efficient algorithm, e.g.
   * LALR(1) by converting to SLR(1).
   */
  compressCLRToLALR() {
    Object.keys(this._lr0ItemSets).forEach(lr0StateKey => {
      let states = this._lr0ItemSets[lr0StateKey];

      let rootState = states[0];
      rootState.mergeLR0Items();

      while (states.length > 1) {
        let state = states.pop();
        state.mergeLR0Items();
        rootState.mergeWithState(state);
      }

      rootState.getItems().forEach(item => {
        // If the item was already connected, we should recalculate its
        // connection to the first state in the LR(0) states collection,
        // since only this state will be kept after states are merged.
        if (item.isConnected()) {
          let outerStates = this.getLR0ItemsSet(item.goto());
          let outerState = outerStates[0];
          item.connect(outerState);
        }
      });

    });

    // After compression reassign new numbers to states.
    this._remap();
  }

  registerState(state) {
    this._getStateCollection(state).push(state);

    // Collect states by LR(0) items, to reuse and merge the same
    // states in case or LALR(1) mode.

    let lr0KeyForItems = LRItem.lr0KeyForItems(state.getKernelItems());

    if (!this._lr0ItemSets.hasOwnProperty(lr0KeyForItems)) {
      this._lr0ItemSets[lr0KeyForItems] = [];
    }

    this._lr0ItemSets[lr0KeyForItems].push(state);
  }

  unregisterState(state) {
    let collection = this._getStateCollection(state);

    let stateIndex = collection.indexOf(state);
    if (stateIndex === -1) {
      collection.splice(stateIndex, 1);
    }

    stateIndex = this._states.indexOf(state);
    if (stateIndex !== -1) {
      this._states.splice(stateIndex, 1);
    }

    let keyForItems = LRItem.keyForItems(state.getKernelItems());
    delete this._kernelSetsTransitions[keyForItems];

    let lr0KeyForItems = LRItem.lr0KeyForItems(state.getKernelItems());
    let lr0States = this._lr0ItemSets[lr0KeyForItems];
    stateIndex = lr0States.indexOf(state);
    if (stateIndex !== -1) {
      lr0States.splice(stateIndex, 1);
    }
  }

  _getStateCollection(state) {
    return state.isFinal() ? this._finalStates : this._itermediateStates;
  }

  getStates() {
    return this._states;
  }

  hasTranstionOnItems(items) {
    return !!this.getTranstionForItems(items);
  }

  getTranstionForItems(items) {
    return this._kernelSetsTransitions[LRItem.keyForItems(items)];
  }

  registerTranstionForItems(items, outerState) {
    this._kernelSetsTransitions[LRItem.keyForItems(items)] = outerState;
  }

  /**
   * In LALR(1) there could be several states with the same
   * LR(0) items, but which differ only in lookahead symbols.
   * In this case we merge such states extending their lookaheads.
   */
  getLR0ItemsSet(state) {
    return this._lr0ItemSets[LRItem.lr0KeyForItems(state.getKernelItems())];
  }

  print() {
    console.log('\nCanonical collection of LR items:');
    this._grammar.print();

    this._states.forEach(state => {
      let stateTags = [];

      if (state.isFinal()) {
        stateTags.push('final');

        if (state.isAccept()) {
          stateTags.push('accept');
        }
      }

      console.log(
        `\nState ${state.getNumber()}:` +
        (stateTags.length > 0 ? ` (${stateTags.join(', ')})` : '')
      );

      state
        .getItems()
        .forEach(item => this._printItem(item, state));
    });
  }

  _printItem(item, state) {
    let itemTags = [];

    if (state.isKernelItem(item)) {
      itemTags.push('kernel');
    }

    if (item.isShift()) {
      itemTags.push('shift');
    }

    if (item.isReduce()) {
      itemTags.push(
        `reduce by production ${item.getProduction().getNumber()}`
      );
    }

    if (item.isFinal() && !item.isReduce()) {
      itemTags.push('accept');
    }

    if (item.goto()) {
      itemTags.push(`goes to state ${item.goto().getNumber()}`);
    }

    console.log(
      `  - ${item.getKey()}` +
      (itemTags.length > 0 ? ` (${itemTags.join(', ')})` : '')
    );
  }

  getRoot() {
    return this._rootItem;
  }

  getStartingState() {
    return this.getRoot().getState();
  }

  _build() {
    // Build all states form itermediate and final states, and
    // also allocate the state number for each state.
    this._states.push(...this._itermediateStates, ...this._finalStates);
    this._remap();
  }

  _remap() {
    this._states.forEach((state, number) => state.setNumber(number));
  }
};
