/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import State from './state';
import {MODES as GRAMMAR_MODE} from '../grammar/grammar-mode';
import {EPSILON} from '../special-symbols';

/**
 * An LRItem is built for a production at particular
 * dot position. The kernel item (for the augmented production)
 * builds the canonical collection, recursively applying
 * "closure" and "goto" operations.
 *
 * There are two types of LR items: LR(0) items, which are used by
 * LR(0) and SLR(1) parsers, and LR(1) items, which are used by
 * LALR(1) and CLR(1) parsers. An LR(1) is defined as:
 *
 * LR(1) = LR(0) + lookahead set.
 */
export default class LRItem {
  constructor({
    production,
    dotPosition = 0,
    grammar,
    canonicalCollection,
    setsGenerator,
    lookaheadSet = null,
  }) {
    this._key = LRItem.keyForItem(production, dotPosition, lookaheadSet);

    // For LR(1) item, same as key, but withough lookaheads.
    this._lr0Key = LRItem.keyForItem(production, dotPosition, null);

    this._production = production;
    this._dotPosition = dotPosition;
    this._grammar = grammar;
    this._canonicalCollection = canonicalCollection;
    this._setsGenerator = setsGenerator;

    // The state this item belongs to.
    this._state = null;

    // The state this item goes to.
    this._outerState = null;

    this._reduceSet = null;

    // LR(1) items maintain lookahead.
    this._lookaheadSet = lookaheadSet;
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
    return !this._closured && !this.isFinal() &&
      this.getCurrentSymbol().isNonTerminal();
  }

  /**
   * Whether transition from this item does "shift" action.
   */
  isShift() {
    return !this.isFinal() &&
      this._grammar.isTokenSymbol(this.getCurrentSymbol());
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
    return this._outerState !== null;
  }

  /**
   * Connects this item to the outer closure state.
   */
  connect(state) {
    this._outerState = state;
  }

  /**
   * Returns the closure object for this item.
   */
  getState() {
    return this._state;
  }

  /**
   * Sets the state to which this item belongs to.
   */
  setState(state) {
    return this._state = state;
  }

  /**
   * Applies closure operation for this item.
   */
  closure() {
    if (!this.shouldClosure()) {
      return;
    }

    // Main kernel item for the augmented production, that creates a new state.
    if (!this.getState()) {
      this.setState(new State({
        kernelItems: [this],
        grammar: this._grammar,
        canonicalCollection: this._canonicalCollection,
        setsGenerator: this._setsGenerator,
      }));
    }

    let productionsForSymbol = this._grammar
      .getProductionsForSymbol(this.getCurrentSymbol());

    let addedItems = productionsForSymbol.map(production => {
      return new LRItem({
        production,
        dotPosition: 0,
        grammar: this._grammar,
        canonicalCollection: this._canonicalCollection,
        setsGenerator: this._setsGenerator,
        lookaheadSet: this._calculateLookaheadSet(),
      });
    });

    this._closured = true;
    this.getState().addItems(addedItems);

    return this.getState();
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
  _calculateLookaheadSet() {
    if (!this._grammar.getMode().usesLookaheadSet()) {
      return null;
    }

    let lookaheadSet;

    let followPosition = this._dotPosition + 1;
    let RHS = this.getProduction().getRHS();

    if (followPosition < RHS.length) {
      let lookaheadPart = RHS.slice(followPosition);
      lookaheadSet = this._setsGenerator.firstOfRHS(lookaheadPart);
    }

    // If no follow part, or we got an empty set, use
    // lookahead of the previous item.
    if (!lookaheadSet || Object.keys(lookaheadSet).length === 0) {
      lookaheadSet = this.getLookaheadSet();
    }

    return lookaheadSet;
  }

  _getItemForProduction(production, lookaheadSet = null) {
    return new LRItem({
      production,
      dotPosition: 0,
      grammar: this._grammar,
      canonicalCollection: this._canonicalCollection,
      setsGenerator: this._setsGenerator,
      lookaheadSet,
    });
  }

  /**
   * Goto operation from this item.
   */
  goto() {
    if (!this._outerState) {
      this.getState().goto();
    }

    return this._outerState;
  }

  /**
   * The symbol at the dot position.
   */
  getCurrentSymbol() {
    return this._production.getRHS()[this._dotPosition];
  }

  /**
   * Whether we have seen the whole production.
   *
   * The item `S -> • ε` (or its short equivalent `S -> •`) is final as well.
   */
  isFinal() {
    return this._dotPosition === this._production.getRHS().length ||
      this.isEpsilonTransition();
  }

  /**
   * Whether this item does transition on ε.
   */
  isEpsilonTransition() {
    let currentSymbol = this.getCurrentSymbol();
    return !!(currentSymbol && currentSymbol.isSymbol(EPSILON));
  }

  /**
   * Returns a reduce set (usually a follow lookahead set)
   * for this item. LR0 mode reduces for every terminal,
   * SLR(1) uses Follow(LHS), and LALR(1)/CLR(1) lookaheads
   * set which is First(RHS) of the current symbol, including
   * all lookaheads from previous items.
   */
  getReduceSet() {
    if (!this._reduceSet) {
      switch (this._grammar.getMode().getRaw()) {
        case GRAMMAR_MODE.LR0:
          // LR0 reduces for all terminals, special `true` value.
          this._reduceSet = true;
          break;

        case GRAMMAR_MODE.SLR1:
          // SLR(1) reduces in Follow(LHS).
          let LHS = this.getProduction().getLHS();
          this._reduceSet = this._setsGenerator.followOf(LHS);
          break;

        case GRAMMAR_MODE.LALR1:
        case GRAMMAR_MODE.CLR1:
          // LALR(1) and CLR(1) consider lookahead of the LR(1) item.
          this._reduceSet = this._lookaheadSet;
          break;

        default:
          throw new Error(
            `Unexpected grammar mode ${this._grammar.getMode()}.`
          );
      }
    }
    return this._reduceSet;
  }

  /**
   * Returns lookahead set (for LR(1) items).
   */
  getLookaheadSet() {
    return this._lookaheadSet;
  }

  /**
   * In LALR(1) mode we merge the states with the same kernel items, which
   * differ only in lookaheads set. The merging is done by extending the
   * lookaheads of the items.
   */
  mergeLookaheadSet(lookaheadSet) {
    // Extend the set.
    Object.assign(this._lookaheadSet, lookaheadSet);

    // And rebuild the key since lookahead set is changed.
    this._key = LRItem.keyForItem(
      this._production,
      this._dotPosition,
      this._lookaheadSet,
    );
  }

  /**
   * Returns serialized representation of an item.
   * E.g. `A -> • a A, c/d/e`.
   */
  getKey() {
    return this._key;
  }

  /**
   * Same as `getKey`, but don't consider lookaheads of LR(1) item,
   * returning only its LR(0) representation.
   *
   * LR(1): `A -> • a A, c/d/e`
   * LR(0): `A -> • a A`
   */
  getLR0Key() {
    return this._lr0Key;
  }

  toString() {
    return this.getKey();
  }

  static keyForItem(production, dotPosition, lookaheadSet = null) {
    let RHS = production.getRHS().map(symbol => symbol.getSymbol());
    RHS.splice(dotPosition, 0, '•');

    let lookaheads = '';
    if (lookaheadSet) {
      lookaheads = `, ${Object.keys(lookaheadSet).join('/')}`;
    }

    return `${production.getLHS().getSymbol()} -> ` +
      `${RHS.join(' ')}${lookaheads}`;
  }

  /**
   * Returns a key for a set of items.
   */
  static keyForItems(items) {
    return items.map(item => item.getKey()).sort().join('|');
  }

  /**
   * Returns an LR(0) key for a set of items.
   */
  static lr0KeyForItems(items) {
    return items.map(item => item.getLR0Key()).sort().join('|');
  }

  /**
   * Returns an a new item with an advanced dot position.
   */
  advance() {
    if (this.isFinal()) {
      throw new Error(`Item for ${this._production.getRaw()} is final.`);
    }

    return new LRItem({
      production: this._production,
      dotPosition: this._dotPosition + 1,
      grammar: this._grammar,
      canonicalCollection: this._canonicalCollection,
      setsGenerator: this._setsGenerator,
      // On goto transition lookaheads set doesn't change.
      lookaheadSet: this.getLookaheadSet(),
    });
  }
};
