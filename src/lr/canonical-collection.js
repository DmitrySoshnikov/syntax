/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar/grammar';
import {MODES as GRAMMAR_MODES} from '../grammar/grammar-mode';
import LRItem from './lr-item';
import SetsGenerator from '../sets-generator';
import {EOF} from '../special-symbols';

import debug from '../debug';

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
    this._states = new Set();

    debug.time('Building canonical collection');

    // Root item for the augmented production, "closure" and "goto"
    // operations applied on this item build the entire collection.
    this._rootItem = new LRItem(
      /* production */ this._grammar.getAugmentedProduction(),
      /* dotPosition */ 0,
      /* grammar */ this._grammar,
      /* canonicalCollection */ this,
      /* setsGenerator */ new SetsGenerator({grammar}),
      /*lookaheadSet */ this._grammar.getMode().usesLookaheadSet()
        ? {[EOF]: true}
        : null
    );

    // Build the entire graph.
    this._rootItem.closure().goto();

    this._remap();

    debug.timeEnd('Building canonical collection');
    debug.log(`Number of states in the collection: ${this._states.size}`);

    // LALR(1) by converting to SLR(1), default fast LALR(1) mode.
    if (this._grammar.getMode().isLALR1()) {
      this._buildLALRBySLR();
    }

    // LALR(1) by compressing CLR(1): mostly for educational purposes, slow.
    else if (this._grammar.getMode().isLALR1ByCLR1()) {
      debug.time('Compressing CLR to LALR');
      this._compressCLRToLALR();
      debug.timeEnd('Compressing CLR to LALR');
      debug.log(`Number of states after compression: ${this._states.size}`);
    }
  }

  /**
   * Basic LALR(1) implementation compressing from CLR(1).
   *
   * This can be slow on complex grammars, and one can better
   * use LALR(1) by SLR(1) method.
   */
  _compressCLRToLALR() {
    for (let lr0StateKey in this._lr0ItemSets) {
      const states = this._lr0ItemSets[lr0StateKey];

      const rootState = states[0];
      rootState.mergeLR0Items();

      while (states.length > 1) {
        const state = states.pop();
        state.mergeLR0Items();
        rootState.mergeWithState(state);
      }

      rootState.getItems().forEach(item => {
        // If the item was already connected, we should recalculate its
        // connection to the first state in the LR(0) states collection,
        // since only this state will be kept after states are merged.
        if (item.isConnected()) {
          const outerStates = this.getLR0ItemsSet(item.goto());
          const outerState = outerStates[0];
          item.connect(outerState);
        }
      });
    }

    // After compression reassign new numbers to states.
    this._remap();
  }

  /**
   * Builds LALR(1) by SLR(1) grammar, and post-processes LR-items
   * by calculating needed lookahead sets.
   *
   * See good concise explanation of the algorithm here:
   * https://web.cs.dal.ca/~sjackson/lalr1.html
   */
  _buildLALRBySLR() {
    debug.time('Building LALR-by-SLR');
    this._buildExtendedLALR1Grammar();

    this._extendedFollowSets = new SetsGenerator({
      grammar: this._extendedLALRGrammar,
    }).getFollowSets();

    // Mutate the set with extended symbols to reflect the
    // symbols from the original grammar.
    for (const nonTerminal in this._extendedFollowSets) {
      const set = this._extendedFollowSets[nonTerminal];
      for (const symbol in set) {
        if (this._setsAliasMap.hasOwnProperty(symbol)) {
          set[this._setsAliasMap[symbol]] = true;
          delete set[symbol];
        }
      }
    }

    this._groupExtendedLALRByFinalSets();
    this._updateLALRItemReduceSet();
    debug.timeEnd('Building LALR-by-SLR');
  }

  /**
   * Groups extended LALR(1) by final sets.
   *
   * We merge extended rules, if they are from the same original
   * rule, and go to the same final set (has the same state number
   * in the very last symbol of RHS).
   */
  _groupExtendedLALRByFinalSets() {
    debug.time('LALR-by-SLR: Group extended productions by final sets');
    this._groupedFinalSets = {};

    this._extendedLALRGrammar.getProductions().forEach(production => {
      const LHS = production.getLHS();
      const RHS = production.getRHS();
      const lastSymbol = RHS[RHS.length - 1];
      const originalLHS = LHS.getOrignialSymbol();
      const finalSet = lastSymbol.getEndContext();

      if (!this._groupedFinalSets.hasOwnProperty(finalSet)) {
        this._groupedFinalSets[finalSet] = {};
      }

      if (!this._groupedFinalSets[finalSet].hasOwnProperty(originalLHS)) {
        this._groupedFinalSets[finalSet][originalLHS] = {};
      }

      // Merge follow sets.
      Object.assign(
        this._groupedFinalSets[finalSet][originalLHS],
        this._extendedFollowSets[LHS.getSymbol()]
      );
    });

    debug.timeEnd('LALR-by-SLR: Group extended productions by final sets');
  }

  /**
   * Updates the reduce sets for items in the LALR by SLR algorithm.
   */
  _updateLALRItemReduceSet() {
    debug.time('LALR-by-SLR: Updating item reduce sets');
    const states = [...this._states];
    for (const state in this._groupedFinalSets) {
      states[state].getReduceItems().forEach(reduceItem => {
        const LHS = reduceItem
          .getProduction()
          .getLHS()
          .getSymbol();
        reduceItem.setReduceSet(this._groupedFinalSets[state][LHS]);
      });
    }
    debug.timeEnd('LALR-by-SLR: Updating item reduce sets');
  }

  /**
   * We use LALR(1) by SLR(1) algorithm here. Once we have built LR(0)
   * automation, we build the extended grammar, considering the context.
   * This context further results to needed lookahead set for LALR(1) which
   * is obtain as Follow(LHS), i.e. the same as in SLR(1).
   */
  _buildExtendedLALR1Grammar() {
    debug.time('LALR-by-SLR: Building extended grammar for LALR');

    const extendedBnf = {};
    this._setsAliasMap = {};

    for (const state of this._states) {
      const items = state.getItems();
      for (const item of items) {
        // Extended items are built only for beginning items.
        if (!item.isBeginning()) {
          continue;
        }
        // We traverse the full path of the item, in order to
        // to identify components with contexts.
        let current = item;
        const visited = new Set();

        const LHS = item
          .getProduction()
          .getLHS()
          .getSymbol();

        const lhsTransit = state.getTransitionOnSymbol(LHS);
        const lhsToState = lhsTransit ? lhsTransit.state.getNumber() : EOF;

        const extendedLHSSymbol = `${state.getNumber()}|${LHS}|${lhsToState}`;

        // Init the rules for the new LHS.
        if (!extendedBnf.hasOwnProperty(extendedLHSSymbol)) {
          extendedBnf[extendedLHSSymbol] = [];
        }

        const extendedRHS = [];

        while (current !== null && !visited.has(current)) {
          visited.add(visited);
          const transitionSymbol = current.getCurrentSymbol();

          if (transitionSymbol) {
            const rawSymbol = transitionSymbol.getSymbol();
            const fromState = current.getState().getNumber();
            let toState;

            // Epsilon reduces in this state.
            if (transitionSymbol.isEpsilon()) {
              toState = fromState;
            } else if (current.getNext()) {
              toState = current
                .getNext()
                .getState()
                .getNumber();
            }

            if (toState != null) {
              const extendedRHSSymbol = `${fromState}|${rawSymbol}|${toState}`;
              extendedRHS.push(extendedRHSSymbol);

              // Collect extended token/terminal symbols as aliases of the
              // original terminal symbols: this is needed to compute
              // First/Follow sets as original symbols.
              if (this._grammar.isTokenSymbol(rawSymbol)) {
                this._setsAliasMap[extendedRHSSymbol] = rawSymbol;
              }
            }
          }

          current = current.getNext();
        }

        // Append the new RHS alternative.
        extendedBnf[extendedLHSSymbol].push(extendedRHS.join(' '));
      }
    }

    this._extendedLALRGrammar = new Grammar({
      bnf: extendedBnf,
      mode: GRAMMAR_MODES.LALR1_EXTENDED,
    });

    debug.timeEnd('LALR-by-SLR: Building extended grammar for LALR');
  }

  registerState(state) {
    this._states.add(state);

    // Collect states by LR(0) items, to reuse and merge the same
    // states in case or LALR(1) mode.

    const lr0KeyForItems = LRItem.lr0KeyForItems(state.getKernelItems());

    if (!this._lr0ItemSets.hasOwnProperty(lr0KeyForItems)) {
      this._lr0ItemSets[lr0KeyForItems] = [];
    }

    this._lr0ItemSets[lr0KeyForItems].push(state);
  }

  unregisterState(state) {
    this._states.delete(state);

    let keyForItems = LRItem.keyForItems(state.getKernelItems());
    delete this._kernelSetsTransitions[keyForItems];

    let lr0KeyForItems = LRItem.lr0KeyForItems(state.getKernelItems());
    let lr0States = this._lr0ItemSets[lr0KeyForItems];
    let stateIndex = lr0States.indexOf(state);
    if (stateIndex !== -1) {
      lr0States.splice(stateIndex, 1);
    }
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
    console.info('\nCanonical collection of LR items:');
    this._grammar.print();

    this._states.forEach(state => {
      let stateTags = [];

      if (state.isFinal()) {
        stateTags.push('final');

        if (state.isAccept()) {
          stateTags.push('accept');
        }
      }

      console.info(
        `\nState ${state.getNumber()}:` +
          (stateTags.length > 0 ? ` (${stateTags.join(', ')})` : '')
      );

      state.getItems().forEach(item => this._printItem(item, state));
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
      itemTags.push(`reduce by production ${item.getProduction().getNumber()}`);
    }

    if (item.isFinal() && !item.isReduce()) {
      itemTags.push('accept');
    }

    if (item.goto()) {
      itemTags.push(`goes to state ${item.goto().getNumber()}`);
    }

    console.info(
      `  - ${item.toString()}` +
        (itemTags.length > 0 ? ` (${itemTags.join(', ')})` : '')
    );
  }

  getRoot() {
    return this._rootItem;
  }

  getStartingState() {
    return this.getRoot().getState();
  }

  _remap() {
    let number = 0;
    for (const state of this._states) {
      state.setNumber(number++);
    }
  }
}
