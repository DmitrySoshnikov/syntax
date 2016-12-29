/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

jest.disableAutomock();

import Grammar from '../grammar';
import GrammarSymbol from '../grammar-symbol';

describe('grammar-symbol', () => {

  it('terminal', () => {
    expect((new GrammarSymbol(`"a"`)).isTerminal()).toBe(true);
    expect((new GrammarSymbol(`'a'`)).isTerminal()).toBe(true);
    expect((new GrammarSymbol(`A`)).isTerminal()).toBe(false);
  });

  it('terminal value', () => {
    expect((new GrammarSymbol(`"a"`)).getTerminalValue()).toBe("a");
  });

  it('quoted terminal', () => {
    expect((new GrammarSymbol(`"a"`)).quotedTerminal()).toBe(`'"a"'`);
    expect((new GrammarSymbol(`'a'`)).quotedTerminal()).toBe(`"'a'"`);
  });

  it('non-terminal', () => {
    expect((new GrammarSymbol(`A`)).isNonTerminal()).toBe(true);
    expect((new GrammarSymbol(`"a"`)).isNonTerminal()).toBe(false);
    expect((new GrammarSymbol(`'a'`)).isNonTerminal()).toBe(false);
  });

  it('raw symbol', () => {
    expect((new GrammarSymbol(`A`)).getSymbol()).toBe('A');
    expect((new GrammarSymbol(`"a"`)).getSymbol()).toBe(`"a"`);
    expect((new GrammarSymbol(`'a'`)).getSymbol()).toBe(`'a'`);
  });

  it('raw symbol', () => {
    expect((new GrammarSymbol(`A`)).getSymbol()).toBe('A');
    expect((new GrammarSymbol(`"a"`)).getSymbol()).toBe(`"a"`);
    expect((new GrammarSymbol(`'a'`)).getSymbol()).toBe(`'a'`);
  });

  it('compare symbol', () => {
    expect((new GrammarSymbol(`A`)).isSymbol('A')).toBe(true);
    expect((new GrammarSymbol(`A`)).isSymbol('B')).toBe(false);
    expect((new GrammarSymbol(`A`)).isSymbol(`'a'`)).toBe(false);
    expect((new GrammarSymbol(`"a"`)).isSymbol(`"a"`)).toBe(true);
    expect((new GrammarSymbol(`'a'`)).isSymbol(`'a'`)).toBe(true);
    expect((new GrammarSymbol(`'a'`)).isSymbol(`'b'`)).toBe(false);
    expect((new GrammarSymbol(`'a'`)).isSymbol(`"b"`)).toBe(false);
    expect((new GrammarSymbol(`'a'`)).isSymbol('A')).toBe(false);
  });

});