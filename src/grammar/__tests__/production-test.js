/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from '../../code-unit';
import GrammarSymbol from '../grammar-symbol';
import Production from '../production';
import {EPSILON} from '../../special-symbols';

const mockGrammar = {
  // Production class uses `getOperators` from grammar.
  getOperators() {
    return {
      '+': {assoc: "left", precedence: 1},
    };
  },

  shouldCaptureLocations() {
    return false;
  },
};

const productionData = {
  LHS: 'E',
  RHS: 'E + F',
  number: 1,
  isShort: false,
  grammar: mockGrammar,
  semanticAction: '$$ = $1 + $3',
};

const defaultLoc = {
  startOffset: 1,
  endOffset: 2,
  startLine: 1,
  endLine: 1,
  startColumn: 1,
  endColumn: 2,
};

describe('production', () => {

  it('LHS', () => {
    const production = new Production(productionData);

    expect(production.getLHS() instanceof GrammarSymbol).toBe(true);
    expect(production.getLHS().getSymbol()).toBe(productionData.LHS);
  });

  it('RHS', () => {
    const production = new Production(productionData);
    const RHS = production.getRHS();

    expect(Array.isArray(RHS)).toBe(true);
    expect(RHS.length).toBe(3);

    RHS.forEach(grammarSymbol => {
      expect(grammarSymbol instanceof GrammarSymbol);
    });

    expect(RHS[0].getSymbol()).toBe('E');
    expect(RHS[1].getSymbol()).toBe('+');
    expect(RHS[2].getSymbol()).toBe('F');
  });

  it('full/short', () => {
    let production = new Production({...productionData, isShort: false});
    expect(production.toString()).toBe('E -> E + F');

    production = new Production({...productionData, isShort: true});
    expect(production.toString()).toBe('   | E + F');
    expect(production.toFullString()).toBe('E -> E + F');
  });

  it('augmented', () => {
    let production = new Production({...productionData, number: 0});
    expect(production.isAugmented()).toBe(true);
    expect(production.getNumber()).toBe(0);

    production = new Production({...productionData, number: 1});
    expect(production.isAugmented()).toBe(false);
    expect(production.getNumber()).toBe(1);
  });

  it('number', () => {
    let production = new Production(productionData);
    expect(production.getNumber()).toBe(1);
  });

  it('semantic action named args', () => {
    const semanticAction = '$$ = $E + $F';

    let production = new Production({
      ...productionData,
      semanticAction,
    });

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getOriginalSemanticAction())
      .toBe(semanticAction);

    expect(production.getRawSemanticAction())
      .toBe('$$ = $1 + $3');
  });

  it('semantic action', () => {
    // Has semantic action.
    let production = new Production(productionData);

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getRawSemanticAction())
      .toBe(productionData.semanticAction);

    const semanticAction = production.getSemanticAction();
    expect(semanticAction instanceof Function).toBe(true);

    const args = [10, '+', 20];
    const result = semanticAction.apply(null, args);

    expect(result).toBe(30);
    expect(CodeUnit.getSandbox().__).toBe(result);
    expect(production.runSemanticAction(args)).toBe(result);

    // No semantic action.
    production = new Production({...productionData, semanticAction: null});

    expect(production.hasSemanticAction()).toBe(false);
    expect(production.runSemanticAction(args)).toBe(undefined);
  });

  it('action with locations', () => {
    // Has semantic action.
    let production = new Production({
      ...productionData,
      grammar: {
        ...mockGrammar,
        shouldCaptureLocations() {
          return true;
        },
      }
    });

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getRawSemanticAction())
      .toBe(productionData.semanticAction);

    const semanticAction = production.getSemanticAction();
    expect(semanticAction instanceof Function).toBe(true);

    const args = [10, '+', 20, defaultLoc, defaultLoc, defaultLoc];
    const result = semanticAction.apply(null, args);

    expect(result).toBe(30);
    expect(CodeUnit.getSandbox().__).toBe(result);
    expect(CodeUnit.getSandbox().__loc).toEqual(defaultLoc);
  });

  it('default location calculation', () => {
    let production = new Production({
      ...productionData,
      grammar: {
        ...mockGrammar,
        shouldCaptureLocations() {
          return true;
        },
      }
    });

    const $1loc = {
      startOffset: 0,
      endOffset: 2,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 2,
    };

    const $3loc = {
      startOffset: 6,
      endOffset: 8,
      startLine: 1,
      endLine: 1,
      startColumn: 6,
      endColumn: 8,
    };

    const $$loc = {
      startOffset: 0,
      endOffset: 8,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 8,
    };

    const args = [10, '+', 20, $1loc, defaultLoc, $3loc];
    const result = production.runSemanticAction(args);

    expect(result).toBe(30);
    expect(CodeUnit.getSandbox().__).toBe(result);
    expect(CodeUnit.getSandbox().__loc).toEqual($$loc);
  });

  it('default propagating action', () => {
    let production = new Production({
      ...productionData,
      RHS: `'foo'`,
      semanticAction: null,
    });

    const defaultAction = '$$ = $1';
    expect(production.getRawSemanticAction()).toBe(defaultAction);
  });

  it('default epsilon action', () => {
    let production = new Production({
      ...productionData,
      RHS: ``,
      semanticAction: null,
    });

    expect(production.getRawSemanticAction()).toBe(null);
  });

  it('epsilon', () => {
    let production = new Production({...productionData, RHS: EPSILON});
    expect(production.isEpsilon()).toBe(true);

    // Empty RHS is treated as Epsilon as well.
    production = new Production({...productionData, RHS: ''});
    expect(production.isEpsilon()).toBe(true);
  });

  it('precedence', () => {
    // Explicit.
    let production = new Production({...productionData, precedence: 3});
    expect(production.getPrecedence()).toBe(3);

    // Inferred from grammar's operators (for '+' in 'E + F').
    production = new Production(productionData);
    expect(production.getPrecedence()).toBe(1);

    // No precedence.
    production = new Production({...productionData, RHS: '( E )'});
    expect(production.getPrecedence()).toBe(0);
  });

});