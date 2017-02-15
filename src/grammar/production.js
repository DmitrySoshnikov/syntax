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
  constructor({
    LHS,
    RHS,
    number,
    semanticAction = null,
    isShort = false,
    grammar,
    precedence,
  }) {
    this._rawLHS = LHS;
    this._rawRHS = RHS;
    this._number = number;
    this._isAugmented = number === 0;
    this._isShort = isShort;
    this._grammar = grammar;
    this._normalize();

    if (semanticAction === null) {
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
      const symbolRe = new RegExp(`(\\$|@)${symbol}`, 'g');

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

  getLHS() {
    return this._LHS;
  }

  getRHS() {
    return this._RHS;
  }

  getPrecedence() {
    return this._precedence;
  }

  getOriginalSemanticAction() {
    return this._orginialSemanticAction;
  }

  getRawSemanticAction() {
    return this._rawSemanticAction;
  }

  getSemanticAction() {
    return this._semanticAction;
  }

  hasSemanticAction() {
    return this._semanticAction !== null;
  }

  runSemanticAction(args) {
    if (!this._semanticAction) {
      return;
    }
    return this._semanticAction(...args);
  }

  isEpsilon() {
    let RHS = this.getRHS();
    return RHS.length === 1 && RHS[0].isEpsilon();
  }

  toString() {
    return this._toKey(this._isShort);
  }

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
