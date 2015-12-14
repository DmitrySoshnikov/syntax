/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarMode from './grammar-mode';
import GrammarSymbol from './grammar-symbol';
import LexRule from './lex-rule';
import Production from './production';

/**
 * Class encapsulates operations with a grammar.
 */
export default class Grammar {

  /**
   * A grammar may be passed as an object with `lex` and `bnf` properties.
   * The `lex` part is a set of rules for the lexer, and `bnf` is actual
   * context-free grammar. If `start` property is passed, it's used as the
   * start symbol, otherwise it's infered from the first production.
   *
   * const grammar = {
   *
   *   // Lexical grammar
   *   // format: <regexp rule>: token
   *   // The token can either be a raw string value, like "foo",
   *   // or a variable (written in ALL_CAPITALIZED notation), which
   *   // can be used further in the `bnf` grammar.
   *
   *   "lex": {
   *     "rules": {
   *       "a"   : "return 'a';",
   *       "\\(" : "return '(';",
   *       "\\)" : "return ')';",
   *       "\\+" : "return '+';",
   *       "[0-9]+(\\.[0-9]+)?\\b" : "return 'NUMBER';"
   *    }
   *   },
   *
   *   "tokens": "a ( ) + NUMBER",
   *
   *   "start": "S",
   *
   *   // BNF grammar
   *
   *   bnf: {
   *     "S": [ "F",
   *            "( S + F )" ],
   *     "F": [ "a",
   *            "NUMBER" ]
   * };
   *
   * Note: if no `lex` is provided, the lexical grammar is inferred
   * from the list of all terminals in the `bnf` grammar.
   */
  constructor({lex = null, tokens, bnf, start = null, mode}) {
    this._originalBnf = bnf;
    this._originalLex = lex.rules;
    this._startSymbol = start;

    if (!Array.isArray(tokens)) {
      tokens = tokens.split(/\s+/);
    }

    this._tokens = tokens.map(token => new GrammarSymbol(token));

    this._mode = new GrammarMode(mode);

    this._nonTerminals = null;

    this._bnf = this._normalizeBnf(this._originalBnf);
    this._lexRules = this._normalizeLex(this._originalLex);
  }

  /**
   * Returns Start symbol of this grammar (it's initialized
   * during normalization process).
   */
  getStartSymbol() {
    return this._startSymbol;
  }

  /**
   * Returns grammar mode.
   */
  getMode() {
    return this._mode;
  }

  /**
   * Returns list of terminals in this grammar.
   */
  getTerminals() {
    if (!this._terminals) {
      this._terminals = [];

      let terminals = {};

      this._bnf.forEach(production => {
        production.getRHS().forEach(symbol => {
          if (symbol.isTerminal() &&
              !terminals.hasOwnProperty(symbol.getSymbol())) {
            terminals[symbol.getSymbol()] = true;
            this._terminals.push(symbol);
          }
        });
      });
    }

    return this._terminals;
  }

  /**
   * Returns list of terminals in this grammar.
   */
  getNonTerminals() {
    if (!this._nonTerminals) {
      this._nonTerminals = [];

      let nonTerminalsMap = {};

      this._bnf.forEach(production => {
        if (production.isAugmented()) {
          return;
        }
        let nonTerminal = production.getLHS();
        if (!nonTerminalsMap.hasOwnProperty(nonTerminal.getSymbol())) {
          nonTerminalsMap[nonTerminal.getSymbol()] = true;
          this._nonTerminals.push(nonTerminal);
        }
      });
    }

    return this._nonTerminals;
  }

  /**
   * Returns tokens.
   */
  getTokens() {
    return this._tokens;
  }

  /**
   * Returns lexical rules for tokenizer. If they were not provided
   * by a user, calculates automatically from terminals of BNF grammar.
   */
  getLexRules() {
    return this._lexRules;
  }

  /**
   * Returns grammar productions.
   */
  getProductions() {
    return this._bnf;
  }

  /**
   * Returns productions for a specific non-terminal.
   */
  getProductionsForSymbol(symbol) {
    if (symbol instanceof GrammarSymbol) {
      symbol = symbol.getSymbol();
    }

    return this._bnf.filter(production => {
      return production.getLHS().isSymbol(symbol);
    });
  }

  /**
   * Returns productions where a non-terminal is used (appears on RHS).
   */
  getProductionsWithSymbol(symbol) {
    if (symbol instanceof GrammarSymbol) {
      symbol = symbol.getSymbol();
    }

    return this._bnf.filter(production => {
      return production.getRHS().some(s => s.getSymbol() === symbol);
    });
  }

  /**
   * Gets a production by number.
   */
  getProduction(number) {
    return this._bnf[number];
  }

  /**
   * Returns an augmented production (used in LR parsers),
   * which is built during normalization process. The augmented
   * production is always the first one.
   */
  getAugmentedProduction() {
    if (!this._mode.isLR()) {
      throw new TypeError(
        `Augmented production is built only for LR grammars`
      );
    }
    return this._bnf[0];
  }

  /**
   * Tokens are either raw text values like "foo", or
   * one of the variables from the lexical grammar.
   */
  isTokenSymbol(symbol) {
    if (!(symbol instanceof GrammarSymbol)) {
      symbol = new GrammarSymbol(symbol);
    }

    return symbol.isTerminal() ||
      this.getTokens().some(token => {
        return token.getSymbol() === symbol.getSymbol();
      });
  }

  /**
   * Pretty prints the grammar.
   */
  print() {
    console.log('\nGrammar:\n');

    let pad = '    ';
    let productions = this.getProductions();
    let numberPad = productions.length.toString().length;

    productions.forEach(production => {
      let productionOutput =
        `${pad}${this._padLeft(production.getNumber(), numberPad)}. ` +
        production.toString();

      console.log(productionOutput);

      if (production.isAugmented()) {
        let splitter = Array(productionOutput.length - 2).join('-');
        console.log(`${pad}${splitter}`);
      }
    });
  }

  _padLeft(value, times) {
    value = value.toString();
    let spaces = Array(times - value.length + 1).join(' ');
    return spaces + value;
  }

  _normalizeLex(lex) {
    // If lexical grammar was provided, normalize and return.
    if (lex) {
      let normalizedLex = [];
      for (let matcher in lex) {
        normalizedLex.push(new LexRule({matcher, tokenHandler: lex[matcher]}));
      }
      return normalizedLex;
    }

    // Otherwise, calculate from the set of terminals: "a" : "a".
    return this.getTerminals()
      .map(terminal => new LexRule({
        matcher: terminal.getSymbol(),
        tokensHandler: `return ${terminal.getSymbol()}`,
      }));
  }

  _normalizeBnf(originalBnf) {
    let normalizedBnf = [];
    let nonTerminals = Object.keys(originalBnf);
    let currentNonTerminal;
    let number = 0;

    if (!this._startSymbol) {
      this._startSymbol = nonTerminals[0];
    }

    if (this._mode.isLR()) {
      // Augmented rule, S' -> S.
      let augmentedProduction = new Production({
        LHS: `${this._startSymbol}'`,
        RHS: this._startSymbol,
        number: number++,
        grammar: this,
      });
      normalizedBnf[0] = augmentedProduction;
    }

    nonTerminals.forEach(LHS => {
      originalBnf[LHS].forEach((RHS, k) => {
        let handler = null;

        if (Array.isArray(RHS)) {
          handler = RHS[1];
          RHS = RHS[0];
        }

        normalizedBnf.push(new Production({
          LHS,
          RHS,
          handler,
          number: number++,
          isShort: k > 0,
          grammar: this,
        }));
      });
    });

    return normalizedBnf;
  }
};
