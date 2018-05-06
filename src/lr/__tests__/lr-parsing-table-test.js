/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../../grammar/grammar';
import {MODES as GRAMMAR_MODE} from '../../grammar/grammar-mode';
import LRParsingTable from '../lr-parsing-table';

describe('lr-parsing-table', () => {
  it('lalr1-grammar-1', () => {
    const grammarString = `
      %%

      Start
        : OptPrefix1 SUFFIX1
        | OptPrefix2 SUFFIX2
        ;

      OptPrefix1
        : PREFIX1
        | /* empty */
        ;

      OptPrefix2
        : PREFIX2
        | /* empty */
        ;
    `;

    const expectedTable = {
      '0': {
        Start: 1,
        OptPrefix1: 2,
        OptPrefix2: 3,
        PREFIX1: 's4',
        SUFFIX1: 'r4',
        PREFIX2: 's5',
        SUFFIX2: 'r6',
      },
      '1': {$: 'acc'},
      '2': {SUFFIX1: 's6'},
      '3': {SUFFIX2: 's7'},
      '4': {SUFFIX1: 'r3'},
      '5': {SUFFIX2: 'r5'},
      '6': {$: 'r1'},
      '7': {$: 'r2'},
    };

    const grammarBySLR = Grammar.fromString(grammarString, {
      mode: GRAMMAR_MODE.LALR1_BY_SLR1,
    });
    expect(new LRParsingTable({grammar: grammarBySLR}).get()).toEqual(
      expectedTable
    );

    const grammarByCLR = Grammar.fromString(grammarString, {
      mode: GRAMMAR_MODE.LALR1_BY_CLR1,
    });
    expect(new LRParsingTable({grammar: grammarByCLR}).get()).toEqual(
      expectedTable
    );
  });

  it('lalr1-grammar-2', () => {
    const grammarString = `
      %%

      S
        : A 'a' A 'b'
        | B 'b' B 'a'
        ;

      A : /*epsilon*/ ;
      B : /*epsilon*/ ;
    `;

    const expectedTable = {
      '0': {S: 1, A: 2, B: 3, "'a'": 'r3', "'b'": 'r4'},
      '1': {$: 'acc'},
      '2': {"'a'": 's4'},
      '3': {"'b'": 's7'},
      '4': {A: 5, "'b'": 'r3'},
      '5': {"'b'": 's6'},
      '6': {$: 'r1'},
      '7': {B: 8, "'a'": 'r4'},
      '8': {"'a'": 's9'},
      '9': {$: 'r2'},
    };

    const grammarBySLR = Grammar.fromString(grammarString, {
      mode: GRAMMAR_MODE.LALR1_BY_SLR1,
    });
    expect(new LRParsingTable({grammar: grammarBySLR}).get()).toEqual(
      expectedTable
    );

    const grammarByCLR = Grammar.fromString(grammarString, {
      mode: GRAMMAR_MODE.LALR1_BY_CLR1,
    });
    expect(new LRParsingTable({grammar: grammarByCLR}).get()).toEqual(
      expectedTable
    );
  });

  it('lalr1-grammar-3', () => {
    const grammarString = `
      %%

      Stmt
        : Type ID ';'
        | Expr ';'
        ;

      Type
        : ID
        ;

      Expr
        : ID
        ;
    `;

    const expectedTable = {
      '0': {Stmt: 1, Type: 2, Expr: 3, ID: 's4'},
      '1': {$: 'acc'},
      '2': {ID: 's5'},
      '3': {"';'": 's7'},
      '4': {ID: 'r3', "';'": 'r4'},
      '5': {"';'": 's6'},
      '6': {$: 'r1'},
      '7': {$: 'r2'},
    };

    const grammarBySLR = Grammar.fromString(grammarString, {
      mode: GRAMMAR_MODE.LALR1_BY_SLR1,
    });
    expect(new LRParsingTable({grammar: grammarBySLR}).get()).toEqual(
      expectedTable
    );

    const grammarByCLR = Grammar.fromString(grammarString, {
      mode: GRAMMAR_MODE.LALR1_BY_CLR1,
    });
    expect(new LRParsingTable({grammar: grammarByCLR}).get()).toEqual(
      expectedTable
    );
  });
});
