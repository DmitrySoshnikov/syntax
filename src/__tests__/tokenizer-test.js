/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Tokenizer from '../tokenizer';
import LexGrammar from '../grammar/lex-grammar';
import {EOF} from '../special-symbols';

const lexGrammarData = require(__dirname + '/../grammar/__tests__/calc.lex');
const lexGrammar = new LexGrammar(lexGrammarData);

describe('tokenizer', () => {

  it('all tokens', () => {
    const tokenizer = new Tokenizer({
      string: '(2 + 134) * R',
      lexGrammar,
    });

    expect(tokenizer.getTokens()).toEqual([
      {
        type: '(',
        value: '(',
        startOffset: 0,
        endOffset: 1,
        startLine: 1,
        endLine: 1,
        startColumn: 0,
        endColumn: 1,
      },

      {
        type: 'NUMBER',
        value: '2',
        startOffset: 1,
        endOffset: 2,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 2,
      },

      {
        type: '+',
        value: '+',
        startOffset: 3,
        endOffset: 4,
        startLine: 1,
        endLine: 1,
        startColumn: 3,
        endColumn: 4,
      },

      {
        type: 'NUMBER',
        value: '134',
        startOffset: 5,
        endOffset: 8,
        startLine: 1,
        endLine: 1,
        startColumn: 5,
        endColumn: 8,
      },

      {
        type: ')',
        value: ')',
        startOffset: 8,
        endOffset: 9,
        startLine: 1,
        endLine: 1,
        startColumn: 8,
        endColumn: 9,
      },

      {
        type: '*',
        value: '*',
        startOffset: 10,
        endOffset: 11,
        startLine: 1,
        endLine: 1,
        startColumn: 10,
        endColumn: 11,
      },

      {
        type: 'IDENTIFIER',
        value: 'R',
        startOffset: 12,
        endOffset: 13,
        startLine: 1,
        endLine: 1,
        startColumn: 12,
        endColumn: 13,
      },

      {"type": EOF, "value": EOF}
    ]);
  });

  it('get next token', () => {
    const tokenizer = new Tokenizer({
      string: '(2 + 134) * R',
      lexGrammar,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: '(',
      value: '(',
      startOffset: 0,
      endOffset: 1,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 1,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '2',
      startOffset: 1,
      endOffset: 2,
      startLine: 1,
      endLine: 1,
      startColumn: 1,
      endColumn: 2,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: '+',
      value: '+',
      startOffset: 3,
      endOffset: 4,
      startLine: 1,
      endLine: 1,
      startColumn: 3,
      endColumn: 4,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '134',
      startOffset: 5,
      endOffset: 8,
      startLine: 1,
      endLine: 1,
      startColumn: 5,
      endColumn: 8,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: ')',
      value: ')',
      startOffset: 8,
      endOffset: 9,
      startLine: 1,
      endLine: 1,
      startColumn: 8,
      endColumn: 9,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: '*',
      value: '*',
      startOffset: 10,
      endOffset: 11,
      startLine: 1,
      endLine: 1,
      startColumn: 10,
      endColumn: 11,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: 'IDENTIFIER',
      value: 'R',
      startOffset: 12,
      endOffset: 13,
      startLine: 1,
      endLine: 1,
      startColumn: 12,
      endColumn: 13,
    });

    expect(tokenizer.getNextToken()).toEqual({"type": EOF, "value": EOF});

    // Once tokens exceeded, always EOF is returned.
    expect(tokenizer.getNextToken()).toEqual({"type": EOF, "value": EOF});
    expect(tokenizer.getNextToken()).toEqual({"type": EOF, "value": EOF});
  });

  it('EOF', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      lexGrammar,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '5',
      startOffset: 0,
      endOffset: 1,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 1,
    });

    expect(tokenizer.isEOF()).toBe(true);
  });

  it('has more tokens', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      lexGrammar,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '5',
      startOffset: 0,
      endOffset: 1,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 1,
    });

    expect(tokenizer.hasMoreTokens()).toBe(true);

    expect(tokenizer.getNextToken()).toEqual({type: EOF, value: EOF});
    expect(tokenizer.hasMoreTokens()).toBe(false);
  });

  it('initial state', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      lexGrammar,
    });

    expect(tokenizer.getCurrentState()).toBe('INITIAL');
  });

  it('state transitions', () => {
    const tokenizer = new Tokenizer({
      string: '1 /* 2 */ 3',
      lexGrammar,
    });

    expect(tokenizer.getCurrentState()).toBe('INITIAL');

    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '1',
      startOffset: 0,
      endOffset: 1,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 1,
    });

    // In the "comment" state, different token type for the same regexp.
    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER_IN_COMMENT',
      value: '2',
      startOffset: 5,
      endOffset: 6,
      startLine: 1,
      endLine: 1,
      startColumn: 5,
      endColumn: 6,
    });

    expect(tokenizer.getCurrentState()).toBe('comment');

    // Back to "INITIAL" state.
    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '3',
      startOffset: 10,
      endOffset: 11,
      startLine: 1,
      endLine: 1,
      startColumn: 10,
      endColumn: 11,
    });

    expect(tokenizer.getCurrentState()).toBe('INITIAL');
  });

  it('states stack', () => {
    const tokenizer = new Tokenizer({
      string: '1',
      lexGrammar,
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

  it('multiple tokens', () => {
    const lexGrammar = new LexGrammar({
      rules: [
        [`\\d+`, `return ['NUMBER', 'NL']`], // return 2 tokens
        [`\\s+`, `/*skip whitespace*/`],
      ],
    });

    const tokenizer = new Tokenizer({
      string: '1 2 3',
      lexGrammar,
    });

    expect(tokenizer.getTokens()).toEqual([
      {
        type: 'NUMBER',
        value: '1',
        startOffset: 0,
        endOffset: 1,
        startLine: 1,
        endLine: 1,
        startColumn: 0,
        endColumn: 1,
      },

      {
        type: 'NL',
        value: '',
        startOffset: 0,
        endOffset: 1,
        startLine: 1,
        endLine: 1,
        startColumn: 0,
        endColumn: 1,
      },

      {
        type: 'NUMBER',
        value: '2',
        startOffset: 2,
        endOffset: 3,
        startLine: 1,
        endLine: 1,
        startColumn: 2,
        endColumn: 3,
      },

      {
        type: 'NL',
        value: '',
        startOffset: 2,
        endOffset: 3,
        startLine: 1,
        endLine: 1,
        startColumn: 2,
        endColumn: 3,
      },

      {
        type: 'NUMBER',
        value: '3',
        startOffset: 4,
        endOffset: 5,
        startLine: 1,
        endLine: 1,
        startColumn: 4,
        endColumn: 5,
      },

      {
        type: 'NL',
        value: '',
        startOffset: 4,
        endOffset: 5,
        startLine: 1,
        endLine: 1,
        startColumn: 4,
        endColumn: 5,
      },

      {"type": EOF, "value": EOF},
    ]);
  });

  it('multiline locations', () => {
    const lexGrammar = new LexGrammar({
      rules: [
        [`\\d+`,                  `return 'NUMBER'`],
        [`\\s+`,                  `/*skip whitespace*/`],
        [`\/\\*(.|\\s)*?\\*\/`,   `/* skip comments */`],
      ],
    });

    const tokenizer = new Tokenizer({
      string: `10
        200       30
            /* multiline
                comment */

         45
      `,
      lexGrammar,
    });

    expect(tokenizer.getTokens()).toEqual([
      {
        type: 'NUMBER',
        value: '10',
        startOffset: 0,
        endOffset: 2,
        startLine: 1,
        endLine: 1,
        startColumn: 0,
        endColumn: 2,
      },

      {
        type: 'NUMBER',
        value: '200',
        startOffset: 11,
        endOffset: 14,
        startLine: 2,
        endLine: 2,
        startColumn: 8,
        endColumn: 11,
      },

      {
        type: 'NUMBER',
        value: '30',
        startOffset: 21,
        endOffset: 23,
        startLine: 2,
        endLine: 2,
        startColumn: 18,
        endColumn: 20,
      },

      {
        type: 'NUMBER',
        value: '45',
        startOffset: 86,
        endOffset: 88,
        startLine: 6,
        endLine: 6,
        startColumn: 9,
        endColumn: 11,
      },

      {"type": EOF, "value": EOF},
    ]);
  });

  it('unexpected token message', () => {
    const tokenizer = new Tokenizer({
      string: '1 &',
      lexGrammar,
    });

    expect(tokenizer.getNextToken()).toEqual({
      type: 'NUMBER',
      value: '1',
      startOffset: 0,
      endOffset: 1,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 1,
    });

    expect(() => {
      tokenizer.getNextToken();
    }).toThrow(new SyntaxError('\n\n1 &\n  ^\nUnexpected token: "&" at 1:2.'));
  });

})