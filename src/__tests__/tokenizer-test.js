/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Tokenizer from '../tokenizer';
import Grammar from '../grammar/grammar';
import {EOF} from '../special-symbols';

const grammar = Grammar.fromGrammarFile(
  __dirname + '/../grammar/__tests__/calc.g',
);

describe('tokenizer', () => {

  it('all tokens', () => {
    const tokenizer = new Tokenizer({
      string: '(2 + 134) * 15',
      grammar,
    });

    expect(tokenizer.getTokens()).toEqual([
      {type: '(', value: '('},
      {type: 'NUMBER', value: '2'},
      {type: '+', value: '+'},
      {type: 'NUMBER', value: '134'},
      {type: ')', value: ')'},
      {type: '*', value: '*'},
      {type: 'NUMBER', value: '15'},
      {"type": EOF, "value": EOF}
    ]);
  });

  it('get next token', () => {
    const tokenizer = new Tokenizer({
      string: '(2 + 134) * 15',
      grammar,
    });

    expect(tokenizer.getNextToken()).toEqual({type: '(', value: '('});
    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '2'});
    expect(tokenizer.getNextToken()).toEqual({type: '+', value: '+'});
    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '134'});
    expect(tokenizer.getNextToken()).toEqual({type: ')', value: ')'});
    expect(tokenizer.getNextToken()).toEqual({type: '*', value: '*'});
    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '15'});
    expect(tokenizer.getNextToken()).toEqual({"type": EOF, "value": EOF});

    // Once tokens exceeded, always EOF is returned.
    expect(tokenizer.getNextToken()).toEqual({"type": EOF, "value": EOF});
    expect(tokenizer.getNextToken()).toEqual({"type": EOF, "value": EOF});
  });

  it('EOF', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      grammar,
    });

    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '5'});
    expect(tokenizer.isEOF()).toBe(true);
  });

  it('has more tokens', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      grammar,
    });

    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '5'});
    expect(tokenizer.hasMoreTokens()).toBe(true);

    expect(tokenizer.getNextToken()).toEqual({type: EOF, value: EOF});
    expect(tokenizer.hasMoreTokens()).toBe(false);
  });

  it('initial state', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      grammar,
    });

    expect(tokenizer.getCurrentState()).toBe('INITIAL');
  });

  it('state transitions', () => {
    const tokenizer = new Tokenizer({
      string: '1 /* 2 */ 3',
      grammar,
    });

    expect(tokenizer.getCurrentState()).toBe('INITIAL');

    expect(tokenizer.getNextToken())
      .toEqual({type: 'NUMBER', value: '1'});

    // In the "comment" state, different token type for the same regexp.
    expect(tokenizer.getNextToken())
      .toEqual({type: 'NUMBER_IN_COMMENT', value: '2'});

    expect(tokenizer.getCurrentState()).toBe('comment');

    // Back to "INITIAL" state.
    expect(tokenizer.getNextToken())
      .toEqual({type: 'NUMBER', value: '3'});

    expect(tokenizer.getCurrentState()).toBe('INITIAL');
  });

  it('states stack', () => {
    const tokenizer = new Tokenizer({
      string: '1',
      grammar,
    });

    tokenizer.pushState('first');
    tokenizer.begin('second'); // Alias for `pushState`

    expect(tokenizer.getCurrentState()).toBe('second');
    expect(tokenizer.getStates()).toEqual(['INITIAL', 'first', 'second']);

    tokenizer.popState();
    expect(tokenizer.getCurrentState()).toBe('first');

    tokenizer.begin('INITIAL');
    expect(tokenizer.getStates()).toEqual(['INITIAL', 'first', 'INITIAL']);

    tokenizer.popState();
    tokenizer.popState();

    expect(tokenizer.getCurrentState()).toBe('INITIAL');

    // Further pops just return the only "INITIAL" state.
    tokenizer.popState();
    expect(tokenizer.getCurrentState()).toBe('INITIAL');

    tokenizer.popState();
    expect(tokenizer.getCurrentState()).toBe('INITIAL');
  });

})