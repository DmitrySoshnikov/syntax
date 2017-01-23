/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../../grammar/grammar';
import LRItem from '../lr-item';
import Production from '../../grammar/production';
import SetsGenerator from '../../sets-generator';
import {MODES as GRAMMAR_MODE} from '../../grammar/grammar-mode';

import fs from 'fs';

//const CanonicalCollection = jest.genMockFromModule('../canonical-collection').default;

import CanonicalCollection from '../canonical-collection';

const grammar = Grammar.fromGrammarFile(
  __dirname + '/../../grammar/__tests__/calc.g',
  {
    mode: GRAMMAR_MODE.LALR1,
  }
);

const canonicalCollection = new CanonicalCollection({grammar});
const setsGenerator = new SetsGenerator({grammar});

// $accept -> • E
const rootItem = new LRItem({
  production: grammar.getAugmentedProduction(),
  grammar,
  canonicalCollection,
  setsGenerator,
  lookaheadSet: {$: true},
});

// E -> • E + E
const baseItem = new LRItem({
  production: grammar.getProduction(1),
  grammar,
  canonicalCollection,
  setsGenerator,
  lookaheadSet: {
    "$": true,
    "/": true,
    "-": true,
    "*": true,
    "+": true,
  },
});

// E -> E • + E
const advancedItem = baseItem.advance();

describe('lr-item', () => {

  it('production', () => {
    expect(rootItem.getProduction()).toBe(grammar.getAugmentedProduction());
    expect(baseItem.getProduction()).toBe(grammar.getProduction(1));
    expect(advancedItem.getProduction()).toBe(grammar.getProduction(1));
  });

  it('key', () => {
    expect(rootItem.getKey())
      .toBe('$accept -> • E, #lookaheads= ["$"]');

    expect(baseItem.getKey())
      .toBe('E -> • E + E, #lookaheads= ["$","/","-","*","+"]');

    expect(advancedItem.getKey())
      .toBe('E -> E • + E, #lookaheads= ["$","/","-","*","+"]');
  });

  it('LR0 key', () => {
    expect(rootItem.getLR0Key()).toBe('$accept -> • E');
    expect(baseItem.getLR0Key()).toBe('E -> • E + E');
    expect(advancedItem.getLR0Key()).toBe('E -> E • + E');
  });

  it('current symbol', () => {
    expect(rootItem.getCurrentSymbol().getSymbol()).toBe('E');
    expect(baseItem.getCurrentSymbol().getSymbol()).toBe('E');
    expect(advancedItem.getCurrentSymbol().getSymbol()).toBe('+');
  });

  it('should closure', () => {
    expect(rootItem.shouldClosure()).toBe(true);
    expect(baseItem.shouldClosure()).toBe(true);
    expect(advancedItem.shouldClosure()).toBe(false);
  });

  it('is shift', () => {
    expect(rootItem.isShift()).toBe(false);
    expect(baseItem.isShift()).toBe(false);
    expect(advancedItem.isShift()).toBe(true);
  });

  it('is final', () => {
    expect(rootItem.isFinal()).toBe(false);
    expect(baseItem.isFinal()).toBe(false);
    expect(advancedItem.isFinal()).toBe(false);

    // E -> E + E •
    expect(advancedItem.advance().advance().isFinal()).toBe(true);

    // $accept -> E •
    expect(rootItem.advance().isFinal()).toBe(true);
  });

  it('is reduce', () => {
    expect(rootItem.isReduce()).toBe(false);
    expect(baseItem.isReduce()).toBe(false);
    expect(advancedItem.isReduce()).toBe(false);

    // E -> E + E •
    expect(advancedItem.advance().advance().isReduce()).toBe(true);

    // $accept -> E • (augmented is not reduce, even if final)
    expect(rootItem.advance().isReduce()).toBe(false);
  });

  it('state closure', () => {
    expect(rootItem.getState()).toBe(null);
    expect(baseItem.getState()).toBe(null);
    expect(advancedItem.getState()).toBe(null);

    rootItem.closure();
    expect(rootItem.getState()).not.toBe(null);

    baseItem.closure();
    expect(baseItem.getState()).not.toBe(null);

    // Should not closure.
    advancedItem.closure();
    expect(advancedItem.getState()).toBe(null);
  });

  it('is connected', () => {
    expect(rootItem.isConnected()).toBe(false);
    expect(baseItem.isConnected()).toBe(false);
    expect(advancedItem.isConnected()).toBe(false);

    // todo
  });
});