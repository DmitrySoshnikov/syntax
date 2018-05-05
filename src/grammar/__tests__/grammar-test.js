/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar';
import GrammarMode from '../grammar-mode';
import GrammarSymbol from '../grammar-symbol';
import Production from '../production';
import {MODES as GRAMMAR_MODE} from '../grammar-mode';

const Grammars = {
  BNF_FORMAT: {
    filename: __dirname + '/calc.bnf',
    mode: GRAMMAR_MODE.SLR1,

    startSymbol: 'E',
    nonTerminalSymbols: ['E'],
    terminalSymbols: ["'+'", "'*'", "'id'", "'('", "')'"],
    tokenSymbols: [],
    moduleIncludeResult: 'module include code',

    operators: {
      "'*'": {assoc: 'left', precedence: 2},
      "'+'": {assoc: 'left', precedence: 1},
      "'-'": {assoc: 'left', precedence: 1},
      "'/'": {assoc: 'left', precedence: 2},
    },

    grammarToString: `
      $accept -> E

      E -> E '+' E
         | E '*' E
         | 'id'
         | '(' E ')'
    `,

    productionsFor: {
      symbol: 'E',
      count: 4,
    },

    productionsWith: {
      symbol: 'E',
      count: 3,
    },
  },

  JS_FORMAT: {
    filename: __dirname + '/calc.g',
    mode: GRAMMAR_MODE.LALR1,

    startSymbol: 'E',
    nonTerminalSymbols: ['E'],
    terminalSymbols: [],
    tokenSymbols: ['+', '*', '-', '/', 'NUMBER', '(', ')'],
    moduleIncludeResult: 'module include code',

    operators: {
      '*': {assoc: 'left', precedence: 2},
      '+': {assoc: 'left', precedence: 1},
      '-': {assoc: 'left', precedence: 1},
      '/': {assoc: 'left', precedence: 2},
    },

    grammarToString: `
      $accept -> E

      E -> E + E
         | E * E
         | E - E
         | E / E
         | NUMBER
         | ( E )
    `,

    productionsFor: {
      symbol: 'E',
      count: 6,
    },

    productionsWith: {
      symbol: 'E',
      count: 5,
    },
  },

  FROM_STRING: {
    string: `
      %{ (() => 'code')(); %}
      %%
      S : A | B;
      A : 'a';
      B : 'b';
    `,
    mode: GRAMMAR_MODE.SLR1,

    startSymbol: 'S',
    nonTerminalSymbols: ['S', 'A', 'B'],
    terminalSymbols: [`'a'`, `'b'`],
    tokenSymbols: [],
    moduleIncludeResult: 'code',

    operators: {},

    grammarToString: `
      $accept -> S

      S -> A
         | B

      A -> 'a'
      B -> 'b'
    `,

    productionsFor: {
      symbol: 'S',
      count: 2,
    },

    productionsWith: {
      symbol: 'A',
      count: 1,
    },
  },
};

describe('grammar', () => {
  describe('from BNF format', () => {
    validate(Grammars.BNF_FORMAT);
  });

  describe('from JSON/JS format', () => {
    validate(Grammars.JS_FORMAT);
  });

  describe('from string', () => {
    validate(Grammars.FROM_STRING);
  });

  function validate(grammarData) {
    let grammar;

    // -------------------------------------------------------------
    // Load grammar from string/file.

    it('loads grammar', () => {
      if (grammarData.filename) {
        grammar = Grammar.fromGrammarFile(grammarData.filename, {
          mode: grammarData.mode,
        });
      } else if (grammarData.string) {
        grammar = Grammar.fromString(grammarData.string, {
          mode: grammarData.mode,
        });
      }
      expect(grammar instanceof Grammar).toBe(true);
    });

    // -------------------------------------------------------------
    // Non-terminals.

    it('non-terminals', () => {
      grammar
        .getNonTerminals()
        .forEach(nonTerminal => expect(nonTerminal instanceof GrammarSymbol));

      expect(grammar.getNonTerminalSymbols()).toEqual(
        grammarData.nonTerminalSymbols
      );

      expect(grammar.isNonTerminal(grammarData.nonTerminalSymbols[0])).toBe(
        true
      );
    });

    // -------------------------------------------------------------
    // Terminals (implicit raw strings in production rules).

    it('terminals', () => {
      grammar
        .getTerminals()
        .forEach(terminal => expect(terminal instanceof GrammarSymbol));

      expect(grammar.getTerminalSymbols()).toEqual(grammarData.terminalSymbols);

      if (grammarData.terminalSymbols.length > 0) {
        expect(grammar.isTokenSymbol(grammarData.terminalSymbols[0])).toBe(
          true
        );
      }
    });

    // -------------------------------------------------------------
    // Tokens (explicit tokens from the lexical grammar).

    it('tokens', () => {
      grammar
        .getTokens()
        .forEach(token => expect(token instanceof GrammarSymbol));

      expect(grammar.getTokenSymbols()).toEqual(grammarData.tokenSymbols);

      if (grammarData.tokenSymbols.length > 0) {
        expect(grammar.isTokenSymbol(grammarData.tokenSymbols[0])).toBe(true);
      }
    });

    // -------------------------------------------------------------
    // Mode.

    it('mode', () => {
      expect(grammar.getMode() instanceof GrammarMode).toBe(true);
      expect(grammar.getMode().getRaw()).toBe(grammarData.mode);
    });

    // -------------------------------------------------------------
    // Module include code.

    it('module include', () => {
      expect(eval(grammar.getModuleInclude())).toBe(
        grammarData.moduleIncludeResult
      );
    });

    // -------------------------------------------------------------
    // Operators.

    it('operators', () => {
      expect(grammar.getOperators()).toEqual(grammarData.operators);
    });

    // -------------------------------------------------------------
    // Start symbol.

    it('start symbol', () => {
      expect(grammar.getStartSymbol()).toBe(grammarData.startSymbol);
    });

    // -------------------------------------------------------------
    // Augmented production (only for LR parsers).

    it('augmented production', () => {
      if (grammar.getMode().isLR()) {
        expect(grammar.getAugmentedProduction() instanceof Production).toBe(
          true
        );

        expect(
          grammar
            .getAugmentedProduction()
            .getLHS()
            .getSymbol()
        ).toBe('$accept');
      }
    });

    // -------------------------------------------------------------
    // Productions.

    it('productions', () => {
      const grammarOutput = [];

      grammar.getProductions().forEach(production => {
        expect(production instanceof Production).toBe(true);
        grammarOutput.push(production.toString().trim());
      });

      const expectedOuput = grammarData.grammarToString
        .split('\n')
        .map(productionStr => productionStr.trim())
        .filter(productionStr => !!productionStr)
        .join('\n');

      expect(grammarOutput.join('\n')).toEqual(expectedOuput);

      const productionsFor = grammarData.productionsFor;
      expect(
        grammar.getProductionsForSymbol(productionsFor.symbol).length
      ).toBe(productionsFor.count);

      const productionsWith = grammarData.productionsFor;
      expect(
        grammar.getProductionsForSymbol(productionsWith.symbol).length
      ).toBe(productionsWith.count);
    });
  }

  // -------------------------------------------------------------
  // Default semantic action.

  it('default semantic action', () => {
    const defaultAction = `$$ = $1`;
    const customAction = `$$ = 'custom'`;

    const grammar = Grammar.fromString(
      `
      %%
      Program
        : 'one'
        | 'two'
        | 'three' {${customAction}}
        ;
    `,
      {
        mode: GrammarMode.SLR1,
      }
    );

    // 0 - augmented, 1, 2, 3 - Program alternatives.
    expect(grammar.getProductions().length).toBe(4);

    expect(grammar.getProduction(1).getRawSemanticAction()).toBe(defaultAction);

    expect(grammar.getProduction(2).getRawSemanticAction()).toBe(defaultAction);

    expect(grammar.getProduction(3).getRawSemanticAction()).toBe(customAction);
  });
});
