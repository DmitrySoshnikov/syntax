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
   * Basic grammar example:
   *
   * const grammar = `
   *   S -> F
   *      | "(" S "+" F ")"
   *   F -> "a"
   * `;
   *
   * In addition, the grammar may be passed as an object with
   * `lex` and `bnf` properties. The `lex` part is a set of rules
   * for the lexer, and `bnf` is actual context-free grammar.
   *
   * const grammar = {
   *
   *   // Lexical grammar
   *   // format: <regexp rule>: token
   *   // The token can either be a raw string value, like "foo",
   *   // or a variable (written in ALL_CAPITALIZED notation), which
   *   // can be used further in the `bnf` grammar.
   *
   *   lex: `
   *     "a" : "a"
   *     "(" : "("
   *     ")" : ")"
   *     "+" : "+"
   *     [0-9]+("."[0-9]+)?\b : NUMBER
   *   `,
   *
   *   // BNF grammar
   *
   *   bnf: `
   *     S -> F
   *        | "(" S "+" F ")"
   *     F -> "a"
   *        | NUMBER
   *   `
   * };
   *
   * Note: if no `lex` is provided, the lexical grammar is inferred
   * from the list of all terminals in the `bnf` grammar.
   */
  constructor(grammar, mode) {
    this._originalBnf = grammar;
    this._originalLex = null;
    this._mode = new GrammarMode(mode);

    // Case when both `lex` and `bnf` are passed.
    if (Object.prototype.toString.call(grammar) === '[object Object]') {
      this._originalBnf = grammar.bnf;
      this._originalLex = grammar.lex;
      this._startSymbol = grammar.start;
    }

    this._terminals = null;
    this._nonTerminals = null;
    this._lexVars = null;

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
   * Returns token variables.
   */
  getLexVars() {
    if (!this._lexVars) {
      this._lexVars = this.getLexRules()
        .filter(lexRule => lexRule.getToken().isNonTerminal())
        .map(lexRule => lexRule.getToken());
    }
    return this._lexVars;
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
      this.getLexVars().some(lexVar => {
        return lexVar.getSymbol() === symbol.getSymbol();
      });
  }

  /**
   * Pretty prints the grammar.
   */
  print() {
    console.log('\nGrammar:\n');

    let productions = this._toArray(this._originalBnf);

    if (this._mode.isLR()) {
      // How many spaces to print for the augmented production
      // based on the first production in the grammar.
      let spacesMatch = productions[0].match(/^\s+/);
      let spaces = Array(spacesMatch ? spacesMatch[0].length + 1 : 0).join(' ');

      // Augmented production.
      console.log(`    0. ${spaces}${this.getAugmentedProduction().getRaw()}`);
      console.log(`    --------------`);
    }

    // Original productions.
    this._toArray(this._originalBnf).forEach((production, i) => {
      console.log(`    ${i + 1}. ${production}`);
    });
  }

  _normalizeLex(lex) {
    // If lexical grammar was provided, normalize and return.
    if (lex) {
      return this._toArray(lex)
        .map(lexRule => new LexRule(lexRule));
    }

    // Otherwise, calculate from the set of terminals: "a" : "a".
    return this.getTerminals()
      .map(terminal => new LexRule(
        `${terminal.getSymbol()} : ${terminal.getSymbol()}`
      ));
  }

  _normalizeBnf(originalBnf) {
    let normalizedBnf = [];
    let currentNonTerminal;

    this._toArray(originalBnf).forEach((rawProduction, k) => {
      let productionNumber = k + 1;

      let production = new Production(rawProduction, productionNumber);

      // For a shorthand production that doesn't use explicit LHS,
      // take it from previous rule.
      if (!production.getLHS().getSymbol()) {
        production.setLHS(currentNonTerminal);
      }

      currentNonTerminal = production.getLHS().getSymbol();

      // LHS of the first rule is considered as "Start symbol", unless
      // it's passed as the `start` property in the grammar.
      if (k === 0) {
        if (!this._startSymbol) {
          this._startSymbol = production.getLHS().getSymbol();
        }

        if (this._mode.isLR()) {
          // Augmented rule, S' -> S.
          let augmentedProduction = new Production(
            `${this._startSymbol}' -> ${this._startSymbol}`, 0
          );
          normalizedBnf[0] = augmentedProduction;
        }
      }

      normalizedBnf.push(production);
    });

    return normalizedBnf;
  }

  _toArray(grammar) {
    if (Array.isArray(grammar)) {
      return grammar;
    }

    return grammar
      .split('\n')
      .filter(production => !!production.trim());
  }
};
