/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../grammar';
import GrammarMode from '../grammar-mode';
import GrammarSymbol from '../grammar-symbol';
import LexRule from '../lex-rule';
import Production from '../production';
import {MODES as GRAMMAR_MODE} from '../grammar-mode';
import fs from 'fs';

const Grammars = {

  BNF_FORMAT: {
    filename: __dirname + '/calc.bnf',
    mode: GRAMMAR_MODE.SLR1,

    startSymbol: 'E',
    nonTerminalSymbols: ['E'],
    terminalSymbols: [ "'+'", "'*'", "'id'", "'('", "')'"],
    tokenSymbols: [],
    moduleIncludeResult: 'module include code',

    operators: {
      "'*'": {assoc: "left", precedence: 2},
      "'+'": {assoc: "left", precedence: 1},
      "'-'": {assoc: "left", precedence: 1},
      "'/'": {assoc: "left", precedence: 2},
    },

    lexerStartConditions: {INITIAL: 0},

    lexRulesData: [
      ["\\+", `return "'+'";`],
      ["\\*", `return "'*'";`],
      ["id",  `return "'id'";`],
      ["\\(", `return "'('";`],
      ["\\)", `return "')'";`],
    ],

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
      "*": {assoc: "left", precedence: 2},
      "+": {assoc: "left", precedence: 1},
      "-": {assoc: "left", precedence: 1},
      "/": {assoc: "left", precedence: 2},
    },

    lexerStartConditions: {INITIAL: 0, comment: 1},

    lexRulesData: [
      [["*"], "\\s+", "/*skip whitespace*/"],
      ["\\d+", "return 'NUMBER'"],
      ["\\(", "return '('"],
      ["\\)", "return ')'"],
      ["\\+", "return '+'"],
      ["\\*", "return '*'"],
      ["\\/\\*", "this.pushState('comment');"],
      [["comment"], "\\*+\\/", "this.popState();"],
      [["comment"], "\\d+", "return 'NUMBER_IN_COMMENT'"],
    ],

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
};

describe('grammar', () => {

  describe('from BNF format', () => {
    validate(Grammars.BNF_FORMAT);
  });

  describe('from JSON/JS format', () => {
    validate(Grammars.JS_FORMAT);
  });

  function validate(grammarData) {
    let grammar;

    // -------------------------------------------------------------
    // Load grammar from file.

    it('loads grammar', () => {
      grammar = Grammar.fromGrammarFile(
        grammarData.filename,
        grammarData.mode,
      );
      expect(grammar instanceof Grammar).toBe(true);
    });

    // -------------------------------------------------------------
    // Non-terminals.

    it('non-terminals', () => {
      grammar.getNonTerminals().forEach(
        nonTerminal => expect(nonTerminal instanceof GrammarSymbol)
      );

      expect(grammar.getNonTerminalSymbols())
        .toEqual(grammarData.nonTerminalSymbols);
    });

    // -------------------------------------------------------------
    // Terminals (implicit raw strings in production rules).

    it('terminals', () => {
      grammar.getTerminals().forEach(
        terminal => expect(terminal instanceof GrammarSymbol)
      );

      expect(grammar.getTerminalSymbols())
        .toEqual(grammarData.terminalSymbols);
    });

    // -------------------------------------------------------------
    // Tokens (explicit tokens from the lexical grammar).

    it('tokens', () => {
      grammar.getTokens().forEach(
        token => expect(token instanceof GrammarSymbol)
      );

      expect(grammar.getTokenSymbols())
        .toEqual(grammarData.tokenSymbols);
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
      expect(eval(grammar.getModuleInclude()))
        .toBe(grammarData.moduleIncludeResult);
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
        expect(grammar.getAugmentedProduction() instanceof Production)
          .toBe(true);

        expect(grammar.getAugmentedProduction().getLHS().getSymbol())
          .toBe('$accept');
      }
    });

    // -------------------------------------------------------------
    // Lexer start conditions.

    it('lexer start conditions', () => {
      expect(grammar.getLexerStartConditions())
        .toEqual(grammarData.lexerStartConditions);
    });

    // -------------------------------------------------------------
    // Lex rules.

    it('lex rules', () => {
      const lexRulesData = [];

      grammar.getLexRules().forEach(lexRule => {
        expect(lexRule instanceof LexRule);

        const data = [
          lexRule.getOriginalMatcher(),
          lexRule.getRawHandler(),
        ];

        if (lexRule.hasStartConditions()) {
          data.unshift(lexRule.getStartConditions());
        }

        lexRulesData.push(data);
      });

      expect(lexRulesData).toEqual(grammarData.lexRulesData);
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
      expect(grammar.getProductionsForSymbol(productionsFor.symbol).length)
        .toBe(productionsFor.count);

      const productionsWith = grammarData.productionsFor;
      expect(grammar.getProductionsForSymbol(productionsWith.symbol).length)
        .toBe(productionsWith.count);
    });
  }

});
