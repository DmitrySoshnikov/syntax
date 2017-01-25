/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../../grammar/grammar';
import LRItem from '../lr-item';
import Production from '../../grammar/production';
import SetsGenerator from '../../sets-generator';
import State from '../state';
import {MODES as GRAMMAR_MODE} from '../../grammar/grammar-mode';

import fs from 'fs';

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

const defaultLookaheadSet = {
  '$': true,
  '/': true,
  '-': true,
  '*': true,
  '+': true,
};

// E -> • E + E
const kernelItem1 = new LRItem({
  production: grammar.getProduction(1),
  dotPosition: 1,
  grammar,
  canonicalCollection,
  setsGenerator,
  lookaheadSet: defaultLookaheadSet,
});

// E -> • E * E
const kernelItem2 = new LRItem({
  production: grammar.getProduction(2),
  dotPosition: 1,
  grammar,
  canonicalCollection,
  setsGenerator,
  lookaheadSet: defaultLookaheadSet,
});

const kernelItems = [
  kernelItem1,
  kernelItem2,
];

const state = new State({
  kernelItems,
  grammar,
  canonicalCollection,
});

const otherItem = new LRItem({
  production: grammar.getProduction(3),
  dotPosition: 1,
  grammar,
  canonicalCollection,
  setsGenerator,
  lookaheadSet: defaultLookaheadSet,
});

state.addItem(otherItem);

// $accept -> E •
const acceptItem = new LRItem({
  production: grammar.getAugmentedProduction(),
  dotPosition: 1,
  grammar,
  canonicalCollection,
  setsGenerator,
  lookaheadSet: {$: true},
});

const acceptItems = [
  acceptItem,
];

const acceptState = new State({
  kernelItems: acceptItems,
  grammar,
  canonicalCollection,
});

describe('state', () => {

  it('kernal items', () => {
    expect(state.getKernelItems()).toBe(kernelItems);
    expect(acceptState.getKernelItems()).toBe(acceptItems);
  });

  it('is kernel item', () => {
    expect(state.isKernelItem(kernelItem1)).toBe(true);
    expect(state.isKernelItem(kernelItem2)).toBe(true);

    const otherItem = new LRItem({
      production: grammar.getProduction(2),
      dotPosition: 1,
      grammar,
      canonicalCollection,
      setsGenerator,
      lookaheadSet: defaultLookaheadSet,
    });

    expect(state.isKernelItem(otherItem)).toBe(false);

    expect(acceptState.isKernelItem(acceptItem)).toBe(true);
  });

});