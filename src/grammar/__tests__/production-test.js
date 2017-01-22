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
};

const productionData = {
  LHS: 'E',
  RHS: 'E + E',
  number: 1,
  isShort: false,
  grammar: mockGrammar,
  semanticAction: '$$ = $1 + $2',
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
    expect(RHS[2].getSymbol()).toBe('E');
  });

  it('full/short', () => {
    let production = new Production({...productionData, isShort: false});
    expect(production.toString()).toBe('E -> E + E');

    production = new Production({...productionData, isShort: true});
    expect(production.toString()).toBe('   | E + E');
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

  it('semantic action', () => {
    // Has semantic action.
    let production = new Production(productionData);

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getRawSemanticAction())
      .toBe(productionData.semanticAction);

    const semanticAction = production.getSemanticAction();
    expect(semanticAction instanceof Function).toBe(true);

    const args = [10, 20];
    const result = semanticAction.apply(null, args);

    expect(result).toBe(30);
    expect(CodeUnit.getSandbox().$$).toBe(result);
    expect(production.runSemanticAction(args)).toBe(result);

    // No semantic action.
    production = new Production({...productionData, semanticAction: null});

    expect(production.hasSemanticAction()).toBe(false);
    expect(production.runSemanticAction(args)).toBe(undefined);
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

    const defaultEpsilonAction = '$$ = null';
    expect(production.getRawSemanticAction()).toBe(defaultEpsilonAction);
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

    // Inferred from grammar's operators (for '+' in 'E + E').
    production = new Production(productionData);
    expect(production.getPrecedence()).toBe(1);

    // No precedence.
    production = new Production({...productionData, RHS: '( E )'});
    expect(production.getPrecedence()).toBe(0);
  });

});