/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from './grammar/grammar-symbol';
import TablePrinter from './table-printer';
import {EPSILON, EOF} from './special-symbols';

import debug from './debug';

// Default exclude set on merging.
const EXCLUDE_EPSILON = {[EPSILON]: true};

/**
 * Pasrsing sets generator.
 */
export default class SetsGenerator {

  /**
   * Constructs First, Follow, and Predict sets
   * for a given grammar.
   */
  constructor({grammar}) {
    this._grammar = grammar;
    this._firstSets = {};
    this._followSets = {};
    this._predictSets = {};
  }

  /**
   * Rules for First Sets
   *
   * - If X is a terminal then First(X) is just X!
   * - If there is a Production X → ε then add ε to first(X)
   * - If there is a Production X → Y1Y2..Yk then add first(Y1Y2..Yk) to First(X)
   * - First(Y1Y2..Yk) is either
   *     - First(Y1) (if First(Y1) doesn't contain ε)
   *     - OR (if First(Y1) does contain ε) then First(Y1Y2..Yk) is everything
   *       in First(Y1) <except for ε > as well as everything in First(Y2..Yk)
   *     - If First(Y1) First(Y2)..First(Yk) all contain ε then add ε
   *       to First(Y1Y2..Yk) as well.
   */
  getFirstSets() {
    debug.time('Building First sets');
    this._buildSet(this.firstOf);
    debug.timeEnd('Building First sets');
    return this._firstSets;
  }

  /**
   * Returns First set for a particular symbol.
   *
   * If we have alternative productions for `S` as:
   *
   *   1. S -> "a" B
   *   2. S -> Y X
   *   3. Y -> "b"
   *
   * then the firstOf(S) is {"a": true, "b": true}, where "a" is gotten
   * directly, and "b" by following Y non-terminal.
   */
  firstOf(symbol) {
    if (symbol instanceof GrammarSymbol) {
      symbol = symbol.getSymbol();
    }

    // A set may already be built from some previous analysis
    // of a RHS, so check whether it's already there and don't rebuild.
    if (this._firstSets[symbol]) {
      return this._firstSets[symbol];
    }

    let firstSet = this._firstSets[symbol] = {};

    // If it's a terminal, its First set contains just itself.
    if (this._grammar.isTokenSymbol(symbol) ||
        GrammarSymbol.isEpsilon(symbol) ||
        GrammarSymbol.isEOF(symbol)) {
      firstSet[symbol] = true;
      return this._firstSets[symbol];
    }

    let productionsForSymbol = this._grammar.getProductionsForSymbol(symbol);

    productionsForSymbol.forEach(production => {
      let RHS = production.getRHS();
      this._mergeSets(firstSet, this.firstOfRHS(RHS));
    });

    return firstSet;
  }

  /**
   * Returns First set of the whole RHS, excluding derived epsilons.
   */
  firstOfRHS(RHS) {
    let firstSet = {};

    for (let i = 0; i < RHS.length; i++) {
      let productionSymbol = RHS[i];

      // Direct epsilon goes to the First set.
      if (productionSymbol.isEpsilon()) {
        firstSet[EPSILON] = true;
        break;
      }

      // Calculate First of current symbol on RHS.
      let firstOfCurrent = this.firstOf(productionSymbol);

      // Put the First set of this non-terminal in our set,
      // excluding the EPSILON.
      this._mergeSets(firstSet, firstOfCurrent, EXCLUDE_EPSILON);

      // And if there was no EPSILON, we're done (otherwise, we
      // don't break the loop, and proceed to the next symbol of the RHS.
      if (!firstOfCurrent.hasOwnProperty(EPSILON)) {
        break;
      }

      // If all symbols on RHS are eliminated, or the last
      // symbol contains EPSILON, add it to the set.
      else if (i === RHS.length - 1) {
        firstSet[EPSILON] = true;
      }
    }

    return firstSet;
  }

  /**
   * Rules for Follow Sets
   *
   * - First put $ (the end of input marker) in Follow(S) (S is the start symbol)
   * - If there is a production A → aBb, (where a can be a whole string)
   *   then everything in FIRST(b) except for ε is placed in FOLLOW(B).
   * - If there is a production A → aB, then everything in
   *   FOLLOW(A) is in FOLLOW(B)
   * - If there is a production A → aBb, where FIRST(b) contains ε,
   *   then everything in FOLLOW(A) is in FOLLOW(B)
   */
  getFollowSets() {
    debug.time('Building Follow sets');
    this._buildSet(this.followOf);
    debug.timeEnd('Building Follow sets');
    return this._followSets;
  }

  /**
   * Returns Follow set for a particular symbol.
   */
  followOf(symbol) {
    if (symbol instanceof GrammarSymbol) {
      symbol = symbol.getSymbol();
    }

    // If was already calculated from some previous run.
    if (this._followSets[symbol]) {
      return this._followSets[symbol];
    }

    // Else init and calculate.
    let followSet = this._followSets[symbol] = {};

    // Start symbol always contain `$` in its follow set.
    if (symbol === this._grammar.getStartSymbol()) {
      followSet[EOF] = true;
    }

    // We need to analyze all productions where our
    // symbol is used (i.e. where it appears on RHS).
    let productionsWithSymbol = this._grammar
      .getProductionsWithSymbol(symbol);

    productionsWithSymbol.forEach(production => {
      let RHS = production.getRHSSymbols();
      let symbolIndex;

      // Get the follow symbol of our symbol. A symbol can appear
      // several times on the RHS, e.g. S -> AaAb, so Follow set should
      // be {a, b}. Also a symbol may appear as the last symbol, in
      // which case it should be Follow(LHS).
      while ((symbolIndex = RHS.indexOf(symbol)) !== -1) {
        let followPart = RHS.slice(symbolIndex + 1);

        // followOf(symbol) is firstOf(followSymbol),
        // excluding epsilon.
        if (followPart.length > 0) {
          while (followPart.length > 0) {
            let productionSymbol = followPart[0];
            let firstOfFollow = this.firstOf(productionSymbol);
            this._mergeSets(followSet, firstOfFollow, EXCLUDE_EPSILON);
            // If no epsilon in the First of follow, we're done.
            if (!firstOfFollow.hasOwnProperty(EPSILON)) {
              break;
            }
            // Else, move to the next symbol, eliminating this one.
            followPart.shift();
          }
        }

        // If nothing following our symbol, or all following symbols
        // were eliminated (i.e. they all contained only epsilons)
        // we should merge followOf(LHS) to the Follow set of our symbol.
        if (followPart.length === 0) {
          let LHS = production.getLHS();
          if (!LHS.isSymbol(symbol)) { // To avoid cases like: B -> aB
            this._mergeSets(followSet, this.followOf(LHS));
          }
        }

        // Search in the next part.
        RHS = followPart;
      }
    });

    return followSet;
  }

  /**
   * The Predict set for a production is the First set of this production,
   * plus, if the First set contains ε, the Follow set.
   *
   * Predict(A -> α) = First(α) ∪ (if α =>* ε) then Follow(A) else ∅
   */
  getPredictSets() {
    this._predictSets = {};
    debug.time('Building Predict sets');

    this._grammar.getProductions().forEach(production => {
      let LHS = production.getLHS();
      let RHS = production.getRHS();

      if (RHS.length == 0 || RHS[0].isEpsilon()) {
        return;
      }

      let setKey = `${production.getNumber()}. ${production.toString()}`;

      // Predict set for this production.
      let predictSet = this._predictSets[setKey] = {};

      // Consists of the First set.
      let firstSet = this.firstOfRHS(RHS);
      this._mergeSets(predictSet, firstSet);

      // Plus, the Follow set if First set contains epsilon.
      if (firstSet.hasOwnProperty(EPSILON)) {
        this._mergeSets(predictSet, this.followOf(LHS));
      }
    });

    debug.timeEnd('Building Predict sets');

    return this._predictSets;
  }


  /**
   * Outputs a set with the label in readable format.
   */
  printSet(set) {
    let lhsHeader;
    let rhsHeader;

    switch (set) {
      case this._firstSets:
        lhsHeader = 'Symbol';
        rhsHeader = 'First set';
        break;
      case this._followSets:
        lhsHeader = 'Symbol';
        rhsHeader = 'Follow set';
        break;
      case this._predictSets:
        lhsHeader = 'Production';
        rhsHeader = 'Predict set';
        break;
      default:
        throw new Error('Unknow set');
    }

    console.info('\n' + rhsHeader + ':\n');

    let printer = new TablePrinter({
      head: [lhsHeader, rhsHeader],
    });

    for (let symbol in set) {
      printer.push([symbol, Object.keys(set[symbol]).join(', ')]);
    }

    console.info(printer.toString());
    console.info('');
  }

  /**
   * Builds a set based on the `builder` function.
   */
  _buildSet(builder) {
    this._grammar.getProductions().forEach(production => {
      builder.call(this, production.getLHS());
    });
  }

  _mergeSets(to, from, exclude) {
    exclude || (exclude = []);
    for (let k in from) {
      if (from.hasOwnProperty(k) && !exclude.hasOwnProperty(k)) {
        to[k] = from[k];
      }
    }
  }
};