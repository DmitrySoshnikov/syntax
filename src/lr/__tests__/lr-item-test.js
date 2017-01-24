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
    '$': true,
    '/': true,
    '-': true,
    '*': true,
    '+': true,
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

  it('dot position', () => {
    expect(rootItem.getDotPosition()).toBe(0);
    expect(baseItem.getDotPosition()).toBe(0);
    expect(advancedItem.getDotPosition()).toBe(1);
  });

  it('advance', () => {
    expect(advancedItem.getProduction()).toBe(baseItem.getProduction());
    expect(advancedItem.getDotPosition()).toBe(baseItem.getDotPosition() + 1);
    expect(advancedItem.getLookaheadSet()).toEqual(baseItem.getLookaheadSet());
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

  it('key for item', () => {
    const baseKey = LRItem.keyForItem(
      baseItem.getProduction(),
      baseItem.getDotPosition(),
      baseItem.getLookaheadSet(),
    );
    expect(baseKey).toBe(baseItem.getKey());
  });

  it('key for items', () => {
    const baseKey = LRItem.keyForItem(
      baseItem.getProduction(),
      baseItem.getDotPosition(),
      baseItem.getLookaheadSet(),
    );

    const advancedKey = LRItem.keyForItem(
      advancedItem.getProduction(),
      advancedItem.getDotPosition(),
      advancedItem.getLookaheadSet(),
    );

    const items = [
      baseItem,
      advancedItem,
    ];

    const keyForItems = LRItem.keyForItems(items);
    const expectedItemsKey = items.map(item => item.getKey()).sort().join('|');

    expect(keyForItems).toBe(expectedItemsKey);
  });

  it('LR0 key for items', () => {
    // E -> • E + E, {'%': true}
    const otherBaseItem = new LRItem({
      production: baseItem.getProduction(),
      grammar,
      canonicalCollection,
      setsGenerator,
      lookaheadSet: {'%': true}, // Other lookahead set.
    });

    const items = [
      baseItem,
      otherBaseItem,
      advancedItem,
    ];

    const keyForItems = LRItem.lr0KeyForItems(items);

    const expectedItemsKey = [
      baseItem.getLR0Key(), // otherBaseKey has the same LR0 key.
      advancedItem.getLR0Key(),
    ].sort().join('|');

    expect(keyForItems).toBe(expectedItemsKey);
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

  it('is epsilon', () => {
    expect(baseItem.isEpsilonTransition()).toBe(false);

    const epsilonItem = new LRItem({
      production: new Production({LHS: 'S', RHS: /* empty */'', grammar}),
      grammar,
      canonicalCollection,
      setsGenerator,
    });

    expect(epsilonItem.isEpsilonTransition()).toBe(true);
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

    rootItem.goto();
    expect(rootItem.isConnected()).toBe(true);

    const advancedState = baseItem.goto();
    expect(baseItem.isConnected()).toBe(true);

    advancedItem.setState(advancedState);
    expect(advancedItem.getState()).toBe(baseItem.goto());
    expect(advancedItem.getState()).toBe(advancedState);

    const calculatedAdvancedItem = advancedState
      .getItemByKey(advancedItem.getKey());

    advancedItem.connect(calculatedAdvancedItem.goto());
    expect(advancedItem.isConnected()).toBe(true);
  });

  it('lookahead set', () => {
    const baseLookaheadSet = baseItem.getLookaheadSet();

    expect(baseLookaheadSet).toEqual({
      '$': true,
      '/': true,
      '-': true,
      '*': true,
      '+': true,
    });

    expect(baseItem.getKey())
      .toBe('E -> • E + E, #lookaheads= ["$","/","-","*","+"]');

    const newLookaheadSet = {'$': true, '+': true};

    baseItem.setLookaheadSet(newLookaheadSet);
    expect(baseItem.getLookaheadSet()).toEqual(newLookaheadSet);

    expect(baseItem.getKey())
      .toBe('E -> • E + E, #lookaheads= ["$","+"]');

    expect(baseItem.getLookaheadSet()).toEqual(newLookaheadSet);

    const mergeSet = {'*': true};
    baseItem.mergeLookaheadSet(mergeSet);

    expect(baseItem.getLookaheadSet())
      .toEqual({...newLookaheadSet, ...mergeSet});

    baseItem.setLookaheadSet(baseLookaheadSet);
  });
});