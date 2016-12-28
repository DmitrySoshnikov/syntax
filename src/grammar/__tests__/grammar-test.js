/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

jest.disableAutomock();

import Grammar from '../grammar';
import GrammarMode from '../grammar-mode';
import GrammarSymbol from '../grammar-symbol';
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
    operators: {
      "'*'": {assoc: "left", precedence: 2},
      "'+'": {assoc: "left", precedence: 1},
      "'-'": {assoc: "left", precedence: 1},
      "'/'": {assoc: "left", precedence: 2},
    }
  },

  JS_FORMAT: {
    filename: __dirname + '/calc.g',
    mode: GRAMMAR_MODE.LALR1,
    startSymbol: 'E',
    nonTerminalSymbols: ['E'],
    terminalSymbols: [],
    tokenSymbols: ['+', '*', '-', '/', 'NUMBER', '(', ')'],
    operators: {
      "*": {assoc: "left", precedence: 2},
      "+": {assoc: "left", precedence: 1},
      "-": {assoc: "left", precedence: 1},
      "/": {assoc: "left", precedence: 2},
    }
  }
};

describe('grammar-test', () => {

  it('validates grammar from BNF format', () => {
    validate(Grammars.BNF_FORMAT);
  });

  it('validates grammar from JSON/JS format', () => {
    validate(Grammars.JS_FORMAT);
  });

  function validate(grammarData) {

    // -------------------------------------------------------------
    // Load grammar from file.

    const grammar = Grammar.fromGrammarFile(
      grammarData.filename,
      grammarData.mode,
    );

    expect(grammar instanceof Grammar).toBe(true);

    // -------------------------------------------------------------
    // Non-terminals.

    grammar.getNonTerminals().forEach(
      nonTerminal => expect(nonTerminal instanceof GrammarSymbol)
    );

    expect(grammar.getNonTerminalSymbols())
      .toEqual(grammarData.nonTerminalSymbols);

    // -------------------------------------------------------------
    // Terminals (implicit raw strings in production rules).

    grammar.getTerminals().forEach(
      terminal => expect(terminal instanceof GrammarSymbol)
    );

    expect(grammar.getTerminalSymbols())
      .toEqual(grammarData.terminalSymbols);

    // -------------------------------------------------------------
    // Tokens (explicit tokens from the lexical grammar).

    grammar.getTokens().forEach(
      token => expect(token instanceof GrammarSymbol)
    );

    expect(grammar.getTokenSymbols())
      .toEqual(grammarData.tokenSymbols);

    // -------------------------------------------------------------
    // Mode.

    expect(grammar.getMode() instanceof GrammarMode).toBe(true);
    expect(grammar.getMode().getRaw()).toBe(grammarData.mode);

    // -------------------------------------------------------------
    // Module include code.

    expect(eval(grammar.getModuleInclude())).toBe('module include code');

    // -------------------------------------------------------------
    // Operators.

    expect(grammar.getOperators()).toEqual(grammarData.operators);

    // -------------------------------------------------------------
    // Start symbol.

    expect(grammar.getStartSymbol()).toBe(grammarData.startSymbol);

    // -------------------------------------------------------------
    // Augmented production (only for LR parsers).

    if (grammar.getMode().isLR()) {
      expect(grammar.getAugmentedProduction() instanceof Production)
        .toBe(true);

      expect(grammar.getAugmentedProduction().getLHS().getSymbol())
        .toBe('$accept');
    }
  }

});
