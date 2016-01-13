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

    // All the states that form this collection.
    this._states = [];

    // These two sub-collections is only for better table output:
    // we want to have all final states to go as last rows in
    // the parsing table.
    this._itermediateStates = [];
    this._finalStates = [];

    // Root item for the augmented production, "closure" and "goto"
    // operations applied on this item build the entire collection.
    this._rootItem = new LRItem({
      production: this._grammar.getAugmentedProduction(),
      grammar: this._grammar,
      canonicalCollection: this,
      setsGenerator: new SetsGenerator({grammar}),
      lookaheadSet: this._grammar.getMode().usesLookaheadSet()
        ? {'$': true}
        : null,
    });

    // Build the entire graph.
    this._rootItem
      .closure()
      .goto();

    this._build();
  }

  registerState(state) {
    let subCollection = state.isFinal()
      ? this._finalStates
      : this._itermediateStates;

    subCollection.push(state);
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
        `\nState ${state.getNumber()}` +
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
    this._states.forEach((state, number) => state.setNumber(number));
  }
};
