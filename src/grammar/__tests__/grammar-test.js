/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

jest.disableAutomock();

import Grammar from '../grammar';
import GrammarSymbol from '../grammar-symbol';
import {MODES as GRAMMAR_MODE} from '../grammar-mode';
import fs from 'fs';

const Grammars = {
  BNF_FORMAT: {
    filename: __dirname + '/calc.bnf',
    nonTerminalSymbols: ['E'],
    terminalSymbols: [ "'+'", "'*'", "'id'", "'('", "')'"],
    tokenSymbols: [],
  },
  JS_FORMAT: {
    filename: __dirname + '/calc.g',
    nonTerminalSymbols: ['E'],
    terminalSymbols: [],
    tokenSymbols: ['+', '*', '-', '/', 'NUMBER', '(', ')'],
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
      GRAMMAR_MODE.SLR1,
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
  }


});
