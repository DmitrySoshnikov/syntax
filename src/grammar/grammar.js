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
   *     "macros": {
   *       "digit": "[0-9]",
   *     },
   *
   *     "rules": [
   *       ["a", "return 'a';"],
   *       ["\\(", "return '(';"],
   *       ["\\)", "return ')';"],
   *       ["\\+", "return '+';"],
   *       ["{digit}+(\\.{digit}+)?\\b", "return 'NUMBER';"],
   *     ]
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
   *            "NUMBER" ],
   *   }
   * };
   *
   * Note: the "bnf" can also be passed as a string:
   *
   *   bnf: `
   *     S -> F
   *        | ( S + F )
   *
   *     F -> a
   *        | NUMBER
   *   `
   *
   * Note: if no `lex` is provided, the lexical grammar is inferred
   * from the list of all terminals in the `bnf` grammar.
   */
  constructor({lex = null, tokens, bnf, start = null, mode}) {
    // For simple use-cases when it's more convenient to
    // write a grammar directly as a string.
    if (typeof bnf === 'string') {
      bnf = Grammar.bnfFomString(bnf);
    }

    this._originalBnf = bnf;
    this._originalLex = null;

    if (lex) {
      this._originalLex = lex.rules;
      if (lex.macros) {
        this._extractLexMacros(lex.macros, this._originalLex);
      }
    }
    this._startSymbol = start;

    this._mode = new GrammarMode(mode);

    this._bnf = this._normalizeBnf(this._originalBnf);
    this._lexRules = this._normalizeLex(this._originalLex);

    this._nonTerminals = this.getNonTerminals();
    this._terminals = this.getTerminals();

    if (typeof tokens === 'string') {
      tokens = tokens.split(/\s+/);
    }

    this._tokens = Array.isArray(tokens)
      ? tokens.map(token => new GrammarSymbol(token))
      : this.getTokens();
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

      this._nonTerminalsMap = {};

      this._bnf.forEach(production => {
        if (production.isAugmented()) {
          return;
        }
        let nonTerminal = production.getLHS();
        if (!this._nonTerminalsMap.hasOwnProperty(nonTerminal.getSymbol())) {
          this._nonTerminalsMap[nonTerminal.getSymbol()] = true;
          this._nonTerminals.push(nonTerminal);
        }
      });
    }

    return this._nonTerminals;
  }

  /**
   * Returns tokens. Infer tokens from the grammar if
   * they were not passed explicitly.
   */
  getTokens() {
    if (!this._tokens) {
      this._tokens = [];

      let tokensMap = {};

      this._bnf.forEach(production => {
        if (production.isAugmented() || production.isEpsilon()) {
          return;
        }
        production.getRHS().forEach(symbol => {
          let rawSymbol = symbol.getSymbol();
          if (!symbol.isTerminal() &&
              !this._nonTerminalsMap.hasOwnProperty(rawSymbol) &&
              !tokensMap.hasOwnProperty(rawSymbol)) {
            tokensMap[rawSymbol] = true;
            this._tokens.push(symbol);
          }
        });
      });
    }

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

  /**
   * If lexical grammar provides "macros" property, and has e.g entry:
   * "digit": "[0-9]", with later usage of {digit} in the lex rules,
   * this functions expands it to [0-9].
   */
  _extractLexMacros(macros, lex) {
    lex.forEach(lexData => {
      Object.keys(macros).forEach(macro => {
        if (lexData[0].indexOf(`{${macro}}`) !== -1) {
          lexData[0] = lexData[0].replace(
            new RegExp(`\\{${macro}\\}`, 'g'),
            macros[macro],
          );
        }
      })
    });
  }

  _normalizeLex(lex) {
    let normalizedLex = [];

    // If lexical grammar was provided, normalize and return.
    if (lex) {
      normalizedLex = lex
        .map(([matcher, tokenHandler]) => new LexRule({
          matcher,
          tokenHandler,
        }));
    }

    // Also add all terminals "a" : "a" as a lex rule.
    normalizedLex = normalizedLex.concat(this.getTerminals()
      .map(terminal => new LexRule({
        matcher: LexRule.matcherFromTerminal(terminal.getSymbol()),
        tokenHandler: `return ${terminal.quotedTerminal()};`,
      }))
    );

    return normalizedLex;
  }

  static bnfFomString(originalBnf) {
    let objectBnf = {};
    let currentNonTerminal = null;

    originalBnf
      .split('\n')
      .filter(line => !!line)
      .forEach(productionLine => {
        let splitted = productionLine.match(/^\s*([\w\-]*)\s*(?:->|:|\|)\s*(.*)$/);

        if (!splitted) {
          throw new Error(`Invalid production: ${production}.`)
        }

        let LHS = splitted[1].trim();

        if (LHS) {
          currentNonTerminal = LHS;
        } else {
          LHS = currentNonTerminal;
        }

        if (!objectBnf[LHS]) {
          objectBnf[LHS] = [];
        }

        let RHS = splitted[2].trim();

        objectBnf[LHS].push(RHS);
      });

    return objectBnf;
  }

  _normalizeBnf(originalBnf) {
    let normalizedBnf = [];
    let nonTerminals = Object.keys(originalBnf);
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
        let semanticAction = null;

        if (Array.isArray(RHS)) {
          semanticAction = RHS[1];
          RHS = RHS[0];
        }

        normalizedBnf.push(new Production({
          LHS,
          RHS,
          semanticAction,
          number: number++,
          isShort: k > 0,
          grammar: this,
        }));
      });
    });

    return normalizedBnf;
  }
};
