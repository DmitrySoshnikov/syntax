/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarMode from '../grammar-mode';
import {MODES} from '../grammar-mode';

describe('grammar-mode', () => {

  it('LR', () => {
    // Default LR0
    let mode = new GrammarMode();
    expect(mode.getRaw()).toBe(MODES.LR0);
    expect(mode.isLR()).toBe(true);
    expect(mode.isLR0()).toBe(true);
    expect(mode.toString()).toBe('LR(0)');

    mode = new GrammarMode(MODES.LR0);
    expect(mode.getRaw()).toBe(MODES.LR0);
    expect(mode.isLR()).toBe(true);
    expect(mode.isLR0()).toBe(true);
    expect(mode.toString()).toBe('LR(0)');

    mode = new GrammarMode(MODES.SLR1);
    expect(mode.getRaw()).toBe(MODES.SLR1);
    expect(mode.isLR()).toBe(true);
    expect(mode.isSLR1()).toBe(true);
    expect(mode.toString()).toBe('SLR(1)');

    mode = new GrammarMode(MODES.LALR1);
    expect(mode.getRaw()).toBe(MODES.LALR1);
    expect(mode.isLR()).toBe(true);
    expect(mode.isLALR1()).toBe(true);
    expect(mode.toString()).toBe('LALR(1)');

    mode = new GrammarMode(MODES.CLR1);
    expect(mode.getRaw()).toBe(MODES.CLR1);
    expect(mode.isLR()).toBe(true);
    expect(mode.isCLR1()).toBe(true);
    expect(mode.toString()).toBe('CLR(1)');
  });

  it('LL', () => {
    const mode = new GrammarMode(MODES.LL1);
    expect(mode.getRaw()).toBe(MODES.LL1);
    expect(mode.isLR()).toBe(false);
    expect(mode.isLL()).toBe(true);
    expect(mode.toString()).toBe('LL(1)');
  });

  it('lookahead set', () => {
    let mode = new GrammarMode(MODES.LL1);
    expect(mode.usesLookaheadSet()).toBe(false);

    mode = new GrammarMode(MODES.LR0);
    expect(mode.usesLookaheadSet()).toBe(false);

    mode = new GrammarMode(MODES.SLR1);
    expect(mode.usesLookaheadSet()).toBe(false);

    mode = new GrammarMode(MODES.LALR1);
    expect(mode.usesLookaheadSet()).toBe(true);

    mode = new GrammarMode(MODES.CLR1);
    expect(mode.usesLookaheadSet()).toBe(true);
  });

});