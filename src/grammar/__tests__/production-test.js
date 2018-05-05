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
      '+': {assoc: 'left', precedence: 1},
    };
  },

  shouldCaptureLocations() {
    return false;
  },
};

const defaultProductionData = [
  /* LHS */ 'E',
  /* RHS */ 'E + F',
  /* number */ 1,
  /* semanticAction */ '$$ = $1 + $3',
  /* isShort */ false,
  /* grammar */ mockGrammar,
];

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
    const production = new Production(...defaultProductionData);

    expect(production.getLHS() instanceof GrammarSymbol).toBe(true);
    expect(production.getLHS().getSymbol()).toBe(defaultProductionData[0]);
  });

  it('RHS', () => {
    const production = new Production(...defaultProductionData);
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

  it('RHS symbols', () => {
    const production = new Production(...defaultProductionData);
    const RHS = production.getRHSSymbols();

    expect(Array.isArray(RHS)).toBe(true);
    expect(RHS.length).toBe(3);

    RHS.forEach(symbol => {
      expect(typeof symbol).toBe('string');
    });

    expect(RHS[0]).toBe('E');
    expect(RHS[1]).toBe('+');
    expect(RHS[2]).toBe('F');
  });

  it('RHS symbols map', () => {
    const production = new Production(...defaultProductionData);
    const rhsSymbolsMap = production.getRHSSymbolsMap();

    expect(Object.keys(rhsSymbolsMap).length).toBe(3);

    expect(rhsSymbolsMap.hasOwnProperty('E')).toBe(true);
    expect(rhsSymbolsMap.hasOwnProperty('+')).toBe(true);
    expect(rhsSymbolsMap.hasOwnProperty('F')).toBe(true);
  });

  it('full/short', () => {
    const productionData = [...defaultProductionData];
    productionData[/* isShort */ 4] = false;
    let production = new Production(...productionData);
    expect(production.toString()).toBe('E -> E + F');

    productionData[/* isShort */ 4] = true;
    production = new Production(...productionData);
    expect(production.toString()).toBe('   | E + F');
    expect(production.toFullString()).toBe('E -> E + F');
  });

  it('augmented', () => {
    const productionData = [...defaultProductionData];
    productionData[/* number */ 2] = 0;
    let production = new Production(...productionData);
    expect(production.isAugmented()).toBe(true);
    expect(production.getNumber()).toBe(0);

    productionData[/* number */ 2] = 1;
    production = new Production(...productionData);
    expect(production.isAugmented()).toBe(false);
    expect(production.getNumber()).toBe(1);
  });

  it('number', () => {
    let production = new Production(...defaultProductionData);
    expect(production.getNumber()).toBe(1);
  });

  it('semantic action named args', () => {
    const semanticAction = '$$ = $E + $F';
    const productionData = [...defaultProductionData];
    productionData[/* semanticAction */ 3] = semanticAction;

    let production = new Production(...productionData);

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getOriginalSemanticAction()).toBe(semanticAction);

    expect(production.getRawSemanticAction()).toBe('$$ = $1 + $3');
  });

  it('semantic action', () => {
    // Has semantic action.
    let production = new Production(...defaultProductionData);

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getRawSemanticAction()).toBe(
      defaultProductionData[/* semanticAction */ 3]
    );

    const semanticAction = production.getSemanticAction();
    expect(semanticAction instanceof Function).toBe(true);

    const args = [10, '+', 20];
    const result = semanticAction.apply(null, args);

    expect(result).toBe(30);
    expect(CodeUnit.getSandbox().__).toBe(result);
    expect(production.runSemanticAction(args)).toBe(result);

    // No semantic action.
    const productionData = [...defaultProductionData];
    productionData[/* semanticAction */ 3] = null;

    production = new Production(...productionData);

    expect(production.hasSemanticAction()).toBe(false);
    expect(production.runSemanticAction(args)).toBe(undefined);
  });

  it('action with locations', () => {
    const productionData = [...defaultProductionData];
    productionData[/* grammar */ 5] = Object.assign({}, mockGrammar, {
      shouldCaptureLocations() {
        return true;
      },
    });

    // Has semantic action.
    let production = new Production(...productionData);

    expect(production.hasSemanticAction()).toBe(true);

    expect(production.getRawSemanticAction()).toBe(
      defaultProductionData[/* semanticAction */ 3]
    );

    const semanticAction = production.getSemanticAction();
    expect(semanticAction instanceof Function).toBe(true);

    const args = [10, '+', 20, defaultLoc, defaultLoc, defaultLoc];
    const result = semanticAction.apply(null, args);

    expect(result).toBe(30);
    expect(CodeUnit.getSandbox().__).toBe(result);
    expect(CodeUnit.getSandbox().__loc).toEqual(defaultLoc);
  });

  it('default location calculation', () => {
    const productionData = [...defaultProductionData];
    productionData[/* grammar */ 5] = Object.assign({}, mockGrammar, {
      shouldCaptureLocations() {
        return true;
      },
    });

    const production = new Production(...productionData);

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
    const productionData = [...defaultProductionData];
    productionData[/* RHS */ 1] = `'foo'`;
    productionData[/* semanticAction */ 3] = null;

    const production = new Production(...productionData);

    const defaultAction = '$$ = $1';
    expect(production.getRawSemanticAction()).toBe(defaultAction);
  });

  it('default epsilon action', () => {
    const productionData = [...defaultProductionData];
    productionData[/* RHS */ 1] = ``;
    productionData[/* semanticAction */ 3] = null;

    const production = new Production(...productionData);

    expect(production.getRawSemanticAction()).toBe(null);
  });

  it('epsilon', () => {
    const productionData = [...defaultProductionData];
    productionData[/* RHS */ 1] = EPSILON;

    let production = new Production(...productionData);

    expect(production.isEpsilon()).toBe(true);

    // Empty RHS is treated as Epsilon as well.
    productionData[/* RHS */ 1] = '';
    production = new Production(...productionData);
    expect(production.isEpsilon()).toBe(true);
  });

  it('precedence', () => {
    const productionData = [...defaultProductionData];
    productionData[/* precedence */ 6] = 3;

    // Explicit.
    let production = new Production(...productionData);
    expect(production.getPrecedence()).toBe(3);

    // Inferred from grammar's operators (for '+' in 'E + F').
    delete productionData[/* precedence */ 6];
    production = new Production(...productionData);
    expect(production.getPrecedence()).toBe(1);

    // No precedence.
    productionData[/* RHS */ 1] = '( E )';
    production = new Production(...productionData);
    expect(production.getPrecedence()).toBe(0);
  });
});
