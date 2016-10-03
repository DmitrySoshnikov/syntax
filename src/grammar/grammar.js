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
   * start symbol, otherwise it's inferred from the first production.
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
   *   // Arbitrary code to be included in the generated parser.
   *
   *   "moduleInclude": "const AST = require('./ast');"
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
  constructor({
    lex,
    tokens,
    bnf,
    operators,
    start,
    mode,
    moduleInclude = '',
    onParseBegin = '',
    onParseEnd = '',
  }) {
    this._originalBnf = bnf;
    this._originalLex = null;

    // Hooks to allow injecting user code.
    this._moduleInclude = moduleInclude;
    this._onParseBegin = onParseBegin;
    this._onParseEnd = onParseEnd;

    if (lex) {
      this._originalLex = lex.rules;
      if (lex.macros) {
        this._extractLexMacros(lex.macros, this._originalLex);
      }
    }
    this._startSymbol = start;

    this._mode = new GrammarMode(mode);

    this._operators = this._processOperators(operators);

    this._bnf = this._processBnf(this._originalBnf);
    this._lexRules = this._processLex(this._originalLex);

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
   * Returns module include code.
   */
  getModuleInclude() {
    return this._moduleInclude;
  }

  /**
   * Returns code for parseBegin callback.
   */
  getOnParseBegin() {
    return this._onParseBegin;
  }

  /**
   * Returns code for parseEnd callback.
   */
  getOnParseEnd() {
    return this._onParseEnd;
  }

  /**
   * Returns precedence and associativity of operators.
   */
  getOperators() {
    return this._operators;
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
   * Returns list of non-terminals in this grammar.
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
    console.info('\nGrammar:\n');

    let pad = '    ';
    let productions = this.getProductions();
    let numberPad = productions.length.toString().length;

    productions.forEach(production => {
      let productionOutput =
        `${pad}${this._padLeft(production.getNumber(), numberPad)}. ` +
        production.toString();

      console.info(productionOutput);

      if (production.isAugmented()) {
        let splitter = Array(productionOutput.length - 2).join('-');
        console.info(`${pad}${splitter}`);
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

  _processOperators(operators) {
    let processedOperators = {};

    if (operators) {
      operators.forEach((opData, i) => {
        opData.slice(1).forEach(op => {
          processedOperators[op] = {
            precedence: i + 1,
            assoc: opData[0],
          };
        })
      });
    }

    return processedOperators;
  }

  _processLex(lex) {
    let processedLex = [];

    // If lexical grammar was provided, normalize and return.
    if (lex) {
      processedLex = lex
        .map(([matcher, tokenHandler]) => new LexRule({
          matcher,
          tokenHandler,
        }));
    }

    // Also add all terminals "a" : "a" as a lex rule.
    processedLex = processedLex.concat(this.getTerminals()
      .map(terminal => new LexRule({
        matcher: LexRule.matcherFromTerminal(terminal.getSymbol()),
        tokenHandler: `return ${terminal.quotedTerminal()};`,
      }))
    );

    return processedLex;
  }

  _processBnf(originalBnf) {
    let processedBnf = [];
    let nonTerminals = Object.keys(originalBnf);
    let number = 0;

    if (!this._startSymbol) {
      this._startSymbol = nonTerminals[0];
    }

    if (this._mode.isLR()) {
      // Augmented rule, $accept -> S.
      let augmentedProduction = new Production({
        LHS: '$accept',
        RHS: this._startSymbol,
        number: number++,
        grammar: this,
      });
      processedBnf[0] = augmentedProduction;
    }

    nonTerminals.forEach(LHS => {
      originalBnf[LHS].forEach((RHS, k) => {
        let semanticAction = null;
        let precedence = null;

        if (Array.isArray(RHS)) {
          let precedenceTag = null;

          if (typeof RHS[1] === 'string') {
            semanticAction = RHS[1];
          } else if (RHS[1] && typeof RHS[1] === 'object') {
            precedenceTag = RHS[1].prec;
          } else if (RHS[2]) {
            precedenceTag = RHS[2].prec;
          }

          RHS = RHS[0];

          if (precedenceTag && this._operators) {
            precedence = this._operators[precedenceTag].precedence;
          }
        }

        processedBnf.push(new Production({
          LHS,
          RHS,
          semanticAction,
          precedence,
          number: number++,
          isShort: k > 0,
          grammar: this,
        }));
      });
    });

    return processedBnf;
  }
};
