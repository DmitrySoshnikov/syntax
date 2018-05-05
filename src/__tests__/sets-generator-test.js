/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import SetsGenerator from '../sets-generator';
import Grammar from '../grammar/grammar';
import GrammarSymbol from '../grammar/grammar-symbol';

describe('sets-generator', () => {
  describe('frist', () => {
    it('direct', () => {
      const setsGenerator = new SetsGenerator({
        grammar: Grammar.fromString(`
          %%
          S : 'a' | 'b';
        `),
      });

      expect(setsGenerator.firstOf(new GrammarSymbol('S'))).toEqual({
        "'a'": true,
        "'b'": true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`'a'`))).toEqual({
        "'a'": true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`'b'`))).toEqual({
        "'b'": true,
      });
    });

    it('indirect', () => {
      const setsGenerator = new SetsGenerator({
        grammar: Grammar.fromString(`
          %%
          S : 'a' | B;
          B : 'b';
        `),
      });

      expect(setsGenerator.firstOf(new GrammarSymbol('S'))).toEqual({
        "'a'": true,
        "'b'": true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`B`))).toEqual({
        "'b'": true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`'a'`))).toEqual({
        "'a'": true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`'b'`))).toEqual({
        "'b'": true,
      });
    });

    it('epsilon', () => {
      const setsGenerator = new SetsGenerator({
        grammar: Grammar.fromString(`
          %%
          S : 'a' | B 'c';
          B : 'b' | /* empty */;
        `),
      });

      expect(setsGenerator.firstOf(new GrammarSymbol('S')))
        // No ε from B, since 'c' stops the sets.
        .toEqual({"'a'": true, "'b'": true, "'c'": true});

      expect(setsGenerator.firstOf(new GrammarSymbol(`B`))).toEqual({
        "'b'": true,
        ε: true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`'a'`))).toEqual({
        "'a'": true,
      });

      expect(setsGenerator.firstOf(new GrammarSymbol(`'b'`))).toEqual({
        "'b'": true,
      });
    });

    it('RHS', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B 'c' | D;
        A : 'a' | /* empty */;
        B : 'b' | /* empty */;
        D : 'd' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      // S -> A B 'c'
      let RHS = grammar.getProduction(1).getRHS();
      expect(setsGenerator.firstOfRHS(RHS)).toEqual({
        "'a'": true,
        "'b'": true,
        "'c'": true,
      });

      // S -> D
      RHS = grammar.getProduction(2).getRHS();
      expect(setsGenerator.firstOfRHS(RHS)).toEqual({"'d'": true, ε: true});
    });

    it('all first', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B 'c' | D;
        A : 'a' | /* empty */;
        B : 'b' | /* empty */;
        D : 'd' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.getFirstSets()).toEqual({
        // ε is from D.
        $accept: {"'a'": true, "'b'": true, "'c'": true, "'d'": true, ε: true},
        S: {"'a'": true, "'b'": true, "'c'": true, "'d'": true, ε: true},
        A: {"'a'": true, ε: true},
        B: {"'b'": true, ε: true},
        D: {"'d'": true, ε: true},
        "'a'": {"'a'": true},
        "'b'": {"'b'": true},
        "'c'": {"'c'": true},
        "'d'": {"'d'": true},
      });
    });
  });

  describe('follow', () => {
    it('start symbol has $', () => {
      const setsGenerator = new SetsGenerator({
        grammar: Grammar.fromString(`
          %%
          S : 'a';
        `),
      });

      expect(setsGenerator.followOf(new GrammarSymbol('S'))).toEqual({$: true});
    });

    it('single symbol', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B 'c';
        A : B 'a';
        B : 'b' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.followOf(new GrammarSymbol('S'))).toEqual({$: true});

      // Follow(A) = FirstOfRHS(B 'c')
      expect(setsGenerator.followOf(new GrammarSymbol('A'))).toEqual({
        "'b'": true,
        "'c'": true,
      });

      let RHS = grammar.getProduction(1).getRHS();
      expect(setsGenerator.followOf(new GrammarSymbol('A'))).toEqual(
        setsGenerator.firstOfRHS(RHS.slice(1))
      );
    });

    it('several symbols', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B A 'c';
        A : 'a';
        B : 'b' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.followOf(new GrammarSymbol('S'))).toEqual({$: true});

      // Follow(A) = FirstOfRHS(B A 'c') + FirstOfRHS('c')
      expect(setsGenerator.followOf(new GrammarSymbol('A')))
        // 'a' since B can be ε, 'c' from the second A
        .toEqual({"'b'": true, "'a'": true, "'c'": true});

      let RHS = grammar.getProduction(1).getRHS();
      expect(setsGenerator.followOf(new GrammarSymbol('A'))).toEqual(
        Object.assign(
          setsGenerator.firstOfRHS(RHS.slice(1)),
          setsGenerator.firstOfRHS(RHS.slice(3))
        )
      );
    });

    it('RHS eliminated, follow LHS', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B C;
        A : 'a';
        B : /* empty */;
        C : /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.followOf(new GrammarSymbol('S'))).toEqual({$: true});

      // Follow(A) = FirstOfRHS(B C) which is eliminated
      expect(setsGenerator.followOf(new GrammarSymbol('A')))
        // $ from Follow(LHS = S) since follow part is eliminated.
        .toEqual({$: true});
    });

    it('RHS captured and eliminated', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B C;
        A : 'a';
        B : 'b' | /* empty */;
        C : 'c' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.followOf(new GrammarSymbol('S'))).toEqual({$: true});

      // Follow(A) = FirstOfRHS(B C) which is eliminated
      expect(setsGenerator.followOf(new GrammarSymbol('A')))
        // $ from Follow(LHS = S) since follow part is eliminated.
        .toEqual({"'b'": true, "'c'": true, $: true});
    });

    it('all follow', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B C;
        A : 'a';
        B : 'b' | /* empty */;
        C : 'c' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.getFollowSets()).toEqual({
        // ε is from D.
        $accept: {},
        S: {$: true},
        A: {"'b'": true, "'c'": true, $: true},
        B: {"'c'": true, $: true},
        C: {$: true},
      });
    });
  });

  describe('predict', () => {
    it('all predict', () => {
      const grammar = Grammar.fromString(`
        %%
        S : A B C;
        A : 'a';
        B : 'b' | /* empty */;
        C : 'c' | /* empty */;
      `);

      const setsGenerator = new SetsGenerator({grammar});

      expect(setsGenerator.getPredictSets()).toEqual({
        '0. $accept -> S': {"'a'": true},
        '1. S -> A B C': {"'a'": true},
        "2. A -> 'a'": {"'a'": true},
        "3. B -> 'b'": {"'b'": true},
        "5. C -> 'c'": {"'c'": true},
      });
    });
  });
});
