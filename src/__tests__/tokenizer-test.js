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
      {type: '(', value: '('},
      {type: 'NUMBER', value: '2'},
      {type: '+', value: '+'},
      {type: 'NUMBER', value: '134'},
      {type: ')', value: ')'},
      {type: '*', value: '*'},
      {type: 'IDENTIFIER', value: 'R'},
      {"type": EOF, "value": EOF}
    ]);
  });

  it('get next token', () => {
    const tokenizer = new Tokenizer({
      string: '(2 + 134) * 15',
      lexGrammar,
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
      lexGrammar,
    });

    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '5'});
    expect(tokenizer.isEOF()).toBe(true);
  });

  it('has more tokens', () => {
    const tokenizer = new Tokenizer({
      string: '5',
      lexGrammar,
    });

    expect(tokenizer.getNextToken()).toEqual({type: 'NUMBER', value: '5'});
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
      {type: 'NUMBER', value: '1'},
      {type: 'NL', value: ''},
      {type: 'NUMBER', value: '2'},
      {type: 'NL', value: ''},
      {type: 'NUMBER', value: '3'},
      {type: 'NL', value: ''},
      {"type": EOF, "value": EOF},
    ]);
  });

  it('capture locations', () => {
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
      captureLocation: true,
    });

    expect(tokenizer.getTokens()).toEqual([
      {
        type: 'NUMBER',
        value: '10',
        start: 0,
        end: 2,
        loc: {
          start: {
            line: 1,
            column: 0,
          },
          end: {
            line: 1,
            column: 2,
          },
        },
      },

      {
        type: 'NUMBER',
        value: '200',
        start: 11,
        end: 14,
        loc: {
          start: {
            line: 2,
            column: 8,
          },
          end: {
            line: 2,
            column: 11,
          },
        },
      },

      {
        type: 'NUMBER',
        value: '30',
        start: 21,
        end: 23,
        loc: {
          start: {
            line: 2,
            column: 18,
          },
          end: {
            line: 2,
            column: 20,
          },
        },
      },

      {
        type: 'NUMBER',
        value: '45',
        start: 86,
        end: 88,
        loc: {
          start: {
            line: 6,
            column: 9,
          },
          end: {
            line: 6,
            column: 11,
          },
        },
      },

      {"type": EOF, "value": EOF},
    ]);
  });

})