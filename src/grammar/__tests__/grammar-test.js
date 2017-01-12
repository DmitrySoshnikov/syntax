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

    lexRulesData: [
      ["\\+", `return "'+'";`],
      ["\\*", `return "'*'";`],
      ["id",  `return "'id'";`],
      ["\\(", `return "'('";`],
      ["\\)", `return "')'";`],
    ],

    lexerStartConditions: {INITIAL: 0},

    // Indices from the `lexRulesData`.
    lexRulesByStartConditions: {
      INITIAL: [0, 1, 2, 3, 4],
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
      "*": {assoc: "left", precedence: 2},
      "+": {assoc: "left", precedence: 1},
      "-": {assoc: "left", precedence: 1},
      "/": {assoc: "left", precedence: 2},
    },

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

    lexerStartConditions: {INITIAL: 0, comment: 1},

    // Indices from the `lexRulesData`.
    lexRulesByStartConditions: {
      INITIAL: [0, 1, 2, 3, 4, 5, 6],
      comment: [0, 7, 8],
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
      const lexRulesData = grammar.getLexRules().map(
        lexRule => lexRule.toData()
      );
      expect(lexRulesData).toEqual(grammarData.lexRulesData);
    });

    const rulesToIndices = (lexRules, lexRulesToIndexMap) => {
      // Get index of the rule from the.
      return lexRules.map(lexRule => lexRulesToIndexMap.get(lexRule));
    };

    // -------------------------------------------------------------
    // Lexer rules by start conditions.

    it('lexer rules by start conditions', () => {
      // Indices of the lex rules by rules map.
      const lexRulesToIndexMap = new Map();

      grammar.getLexRules().forEach((rule, index) => {
        lexRulesToIndexMap.set(rule, index);
      });

      const lexRulesByStartConditions = grammar.getLexRulesByStartConditions();
      const rulesByConditionsData = {};

      Object.keys(lexRulesByStartConditions).forEach(startCondition => {
        const lexRules = lexRulesByStartConditions[startCondition];
        rulesByConditionsData[startCondition] = rulesToIndices(
          lexRules,
          lexRulesToIndexMap,
        );
      });

      expect(rulesByConditionsData)
        .toEqual(grammarData.lexRulesByStartConditions);
    });

    // -------------------------------------------------------------
    // Lexer rules for start conditions.

    it('lexer rules for start conditions', () => {
      // Indices of the lex rules by rules map.
      const lexRulesToIndexMap = new Map();

      grammar.getLexRules().forEach((rule, index) => {
        lexRulesToIndexMap.set(rule, index);
      });

      const rulesByConditionsData = grammarData.lexRulesByStartConditions;

      Object.keys(rulesByConditionsData).forEach(startCondition => {
        const expectedLexRules = rulesByConditionsData[startCondition];

        const lexRules = rulesToIndices(
          grammar.getLexRulesForState(startCondition),
          lexRulesToIndexMap,
        );

        expect(lexRules).toEqual(expectedLexRules);
      });
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
