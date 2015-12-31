/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Closure from './closure';
import {MODES as GRAMMAR_MODE} from '../grammar/grammar-mode';
import {EPSILON} from '../special-symbols';

/**
 * An LRItem is built for a production at particular
 * dot position. The kernel item (for the augmented production)
 * builds the canonical collection, recursively applying
 * "closure" and "goto" operations.
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
    this._production = production;
    this._dotPosition = dotPosition;
    this._grammar = grammar;
    this._canonicalCollection = canonicalCollection;
    this._setsGenerator = setsGenerator;
    this._closure = null;
    this._gotoPointer = null;
    this._reduceSet = null;

    // LR(1) items maintain lookahead.
    this._lookaheadSet = lookaheadSet;
  }

  getDotPosition() {
    return this._dotPosition;
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
        setsGenerator: this._setsGenerator,
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
          setsGenerator: this._setsGenerator,
        });
        // Register item and state.
        fromClosure.addSymbolTransition({
          item: this,
          closure: this._gotoPointer,
        });
      }
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
    return currentSymbol && currentSymbol.isSymbol(EPSILON);
  }

  /**
   * Returns a reduce set (usually a follow lookahead set)
   * for this item. LR0 mode reduces for every terminal,
   * SLR(1) uses Follow(LHS), and LALR(1)/CLR(1) lookaheads
   * set which is First(RHS) of the current symbol, inlcuding
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
   * Returns serialized representation of an item. This is used
   * as a key in the global registry of all items that participate
   * in closures. E.g. `A -> • a A, c/d/e`.
   */
  getKey() {
    return LRItem.keyForItem(
      this._production,
      this._dotPosition,
      this._lookaheadSet,
    );
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
      setsGenerator: this._setsGenerator,
      // On goto transition lookaheads set doesn't change.
      lookaheadSet: this.getLookaheadSet(),
    });
  }
};
