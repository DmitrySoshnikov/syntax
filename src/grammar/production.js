/** * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from './grammar-symbol';
import {EPSILON} from '../special-symbols';

/**
 * A produciton in BNF grammar.
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
    semanticAction,
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
    this._rawSemanticAction = semanticAction;
    this._semanticAction = this._buildSemanticAction(semanticAction);
    this._precedence = precedence || this._calculatePrecedence();
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
    let LHS = this._LHS.getSymbol();

    let RHS = this._RHS
      .map(symbol => symbol.getSymbol())
      .join(' ');

    let pad = Array(LHS.length + '->'.length).join(' ');

    return this._isShort
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

    // Builds a string of args: '$1, $2, $3...'
    let args = [...Array(this.getRHS().length)]
      .map((_, i) => `$${i + 1}`)
      .join(',');

    return new Function(
      'yytext',
      'yyleng',
      args,
      `var $$; ${semanticAction}; return $$;`
    );
  }

  _normalize() {
    let LHS = new GrammarSymbol(this._rawLHS);
    let RHS = [];

    // If no RHS provided, assume it's ε. We support
    // both formats, explicit: F -> ε, and implicit: F ->

    if (!this._rawRHS) {
      RHS.push(new GrammarSymbol(EPSILON));
    } else {
      let rhsProd = this._rawRHS.split(/\s+/);
      for (let i = 0; i < rhsProd.length; i++) {
        if (rhsProd[i] === '"' && rhsProd[i + 1] === '"') {
          RHS.push(new GrammarSymbol('" "'));
          i++;
        } else {
          RHS.push(new GrammarSymbol(rhsProd[i]));
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
