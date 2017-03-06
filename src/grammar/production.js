/** * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from '../code-unit';
import GrammarSymbol from './grammar-symbol';
import {EPSILON} from '../special-symbols';

import colors from 'colors';

/**
 * A production in BNF grammar.
 */
export default class Production {
  /**
   * Receives a raw production in a view of:
   *
   * LHS -> RHS or a short alternative
   *      | RHS if the LHS is the same.
   */
  constructor(
    LHS,
    RHS,
    number,
    semanticAction,
    isShort,
    grammar,
    precedence,
  ) {
    this._rawLHS = LHS;
    this._rawRHS = RHS;
    this._number = number;
    this._isAugmented = number === 0;
    this._isShort = !!isShort;
    this._grammar = grammar;
    this._normalize();

    if (semanticAction == null) {
      semanticAction = this._createDefaultSemanticAction()
    }

    this._orginialSemanticAction = semanticAction;
    this._rawSemanticAction = this._rewriteNamedArg(semanticAction);
    this._semanticAction = this._buildSemanticAction(this._rawSemanticAction);
    this._precedence = precedence || this._calculatePrecedence();
  }

  /**
   * Creates default semantic action for simple productions.
   */
  _createDefaultSemanticAction() {
    if (this.getRHS().length !== 1 || this.isEpsilon()) {
      return null;
    }

    return '$$ = $1';
  }

  /**
   * Rewrites named arguments to positioned ones.
   * $foo -> $1, ...
   */
  _rewriteNamedArg(semanticAction) {
    if (!semanticAction) {
      return null;
    }

    const RHS = this.getRHS();
    const idRe = /[a-zA-Z][a-zA-Z0-9]*/;

    for (let i = 0; i < RHS.length; i++) {
      const symbol = RHS[i].getSymbol();

      if (!idRe.test(symbol)) {
        continue;
      }

      const index = i + 1;
      const symbolRe = new RegExp(`(\\$|@)${symbol}\\b`, 'g');

      semanticAction = semanticAction.replace(symbolRe, `$1${index}`);
    }

    return semanticAction;
  }

  /**
   * Returns number of the production
   * in the grammar.
   */
  getNumber() {
    return this._number;
  }

  /**
   * Whether this production is augmented.
   */
  isAugmented() {
    return this._isAugmented;
  }

  /**
   * Returns LHS symbol.
   */
  getLHS() {
    return this._LHS;
  }

  /**
   * Returns an array of symbols on RHS (aka "handle").
   */
  getRHS() {
    return this._RHS;
  }

  /**
   * Same as `getRHS`, but returns raw symbols.
   */
  getRHSSymbols() {
    if (!this._rhsSymbols) {
      this._rhsSymbols = this._RHS.map(symbol => symbol.getSymbol());
    }
    return this._rhsSymbols;
  }

  /**
   * A map for faster searches whether a symbol is used on RHS.
   */
  getRHSSymbolsMap() {
    if (!this._rhsSymbolsMap) {
      this._rhsSymbolsMap = {};
      this._RHS.forEach(
        symbol => this._rhsSymbolsMap[symbol.getSymbol()] = true
      );
    }
    return this._rhsSymbolsMap;
  }

  /**
   * Returns precedence of this production.
   */
  getPrecedence() {
    return this._precedence;
  }

  /**
   * Returns original semantic action.
   */
  getOriginalSemanticAction() {
    return this._orginialSemanticAction;
  }

  /**
   * Returns semantic action string.
   */
  getRawSemanticAction() {
    return this._rawSemanticAction;
  }

  /**
   * Returns semantic action function.
   */
  getSemanticAction() {
    return this._semanticAction;
  }

  /**
   * Whether this production has semantic action.
   */
  hasSemanticAction() {
    return this._semanticAction !== null;
  }

  /**
   * Executes semantic action.
   */
  runSemanticAction(args) {
    if (!this._semanticAction) {
      return;
    }
    return this._semanticAction(...args);
  }

  /**
   * Whether this production is epsilon.
   */
  isEpsilon() {
    let RHS = this.getRHS();
    return RHS.length === 1 && RHS[0].isEpsilon();
  }

  /**
   * String representation.
   */
  toString() {
    return this._toKey(this._isShort);
  }

  /**
   * String representation in full notation.
   */
  toFullString() {
    return this._toKey(false);
  }

  _toKey(isShort = false) {
    let LHS = this._LHS.getSymbol();

    let RHS = this._RHS
      .map(symbol => symbol.getSymbol())
      .join(' ');

    let pad = Array(LHS.length + '->'.length).join(' ');

    return isShort
      ? `${pad} | ${RHS}`
      : `${LHS} -> ${RHS}`
  }

  /**
   * Constructs semantic action based on the RHS length,
   * each stack entry which corresponds to a symbol is available
   * as $1, $2, $3, etc. arguments. The result is $$.
   */
  _buildSemanticAction(semanticAction) {
    if (!semanticAction) {
      return null;
    }

    // Generate the function handler only for JS language.
    try {
      const handler = CodeUnit.createProductionHandler({
        production: this,
        captureLocations: this._grammar.shouldCaptureLocations(),
      });

      return (...args) => {
        // Executing a handler mutates $$ variable, return it.
        try {
          handler(...args);
        } catch (e) {
          console.error(
            colors.red(`\nError in handler for production `) +
            colors.bold(this.toFullString()) + `:\n\n` +
            this.getOriginalSemanticAction() + '\n',
          );
          throw e;
        }
        return CodeUnit.getSandbox().__;
      };
    } catch (e) {
      /* And skip for other languages, which use raw handler in generator */
    }
  }

  _normalize() {
    let LHS = GrammarSymbol.get(this._rawLHS);
    let RHS = [];

    // If no RHS provided, assume it's ε. We support
    // both formats, explicit: F -> ε, and implicit: F ->

    if (!this._rawRHS) {
      RHS.push(GrammarSymbol.get(EPSILON));
    } else {
      let rhsProd = this._rawRHS.split(/\s+/);
      for (let i = 0; i < rhsProd.length; i++) {
        if (rhsProd[i] === '"' && rhsProd[i + 1] === '"') {
          RHS.push(GrammarSymbol.get('" "'));
          i++;
        } else {
          RHS.push(GrammarSymbol.get(rhsProd[i]));
        }
      }
    }

    this._LHS = LHS;
    this._RHS = RHS;
  }

  _calculatePrecedence() {
    let operators = this._grammar.getOperators();

    for (let grammarSymbol of this.getRHS()) {
      let symbol = grammarSymbol.getSymbol();

      if (symbol in operators) {
        return operators[symbol].precedence;
      }
    }

    return 0;
  }
};
