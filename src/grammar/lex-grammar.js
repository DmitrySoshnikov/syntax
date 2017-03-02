/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import BnfParser from '../generated/bnf-parser.gen';
import GrammarMode from './grammar-mode';
import GrammarSymbol from './grammar-symbol';
import LexRule from './lex-rule';
import Production from './production';

import colors from 'colors';
import fs from 'fs';
import vm from 'vm';

/**
 * Standard macro symbols.
 */
const StandardMacros = {
  /**
   * End of file macro, matches `$` at the end of the parsing string.
   */
  '<<EOF>>': '\\$$',
};

/**
 * Class encapsulates operations with a lexical grammar.
 */
export default class LexGrammar {
  /**
   * A lexical grammar is used for a string tokenization. An example of the
   * lexical grammar data:
   *
   * {
   *   "macros": {
   *     "digit": "[0-9]",
   *   },
   *
   *   "rules": [
   *     ["a", "return 'a';"],
   *     ["\\(", "return '(';"],
   *     ["\\)", "return ')';"],
   *     ["\\+", "return '+';"],
   *     ["{digit}+(\\.{digit}+)?\\b", "return 'NUMBER';"],
   *
   *     // A rule with start conditions. Such rules are matched only
   *     // when a scanner enters these states.
   *     [["string", "code"], '[^"]',  "return 'STRING';"],
   *   ],
   *
   *   // https://gist.github.com/DmitrySoshnikov/f5e2583b37e8f758c789cea9dcdf238a
   *   "startConditions": {
   *     "string": 1, // inclusive condition %s
   *     "code": 0,   // exclusive consition %x
   *   },
   * }
   */
  constructor({
    macros,
    rules,
    startConditions,
    options,
  }) {
    this._macros = macros;
    this._originalRules = rules;
    this._options = options;
    this._extractMacros(macros, this._originalRules);

    this._rules = this._processRules(this._originalRules);
    this._rulesToIndexMap = this._createRulesToIndexMap();

    this._startConditions = Object.assign({INITIAL: 0}, startConditions);
    this._rulesByStartConditions = this._processRulesByStartConditions();
  }

  /**
   * Returns options.
   */
  getOptions() {
    return this._options;
  }

  /**
   * Returns start conditions types for a lexer.
   */
  getStartConditions() {
    return this._startConditions;
  }

  /**
   * Returns lexical rules.
   */
  getRules() {
    return this._rules;
  }

  /**
   * Returns a rule by index.
   */
  getRuleByIndex(index) {
    return this._rules[index];
  }

  /**
   * Returns rule's index.
   */
  getRuleIndex(rule) {
    return this._rulesToIndexMap.get(rule);
  }

  /**
   * Returns original lexical rules data.
   */
  getOriginalRules() {
    return this._originalRules;
  }

  /**
   * Returns macros.
   */
  getMacros() {
    return this._macros;
  }

  /**
   * Returns lexical rules for a specific start condition.
   */
  getRulesForState(state) {
    return this._rulesByStartConditions[state];
  }

  /**
   * Returns rules by start conditions.
   */
  getRulesByStartConditions() {
    return this._rulesByStartConditions;
  }

  /**
   * Creates rules to index map.
   */
  _createRulesToIndexMap() {
    const rulesToIndexMap = new Map();
    this.getRules().forEach((rule, index) => {
      rulesToIndexMap.set(rule, index);
    });
    return rulesToIndexMap;
  }

  /**
   * Processes lexical rules data, creating `LexRule` instances for each.
   */
  _processRules(rules) {
    return rules.map(tokenData => {
      // Lex rules may specify start conditions. Such rules are
      // executed if a tokenizer enters such state.

      let startConditions;
      let matcher;
      let tokenHandler;
      let options = {};

      // Default options of a particular LexRule are initialized to the
      // global options of the whole lexical grammar.
      const defaultOptions = {...this.getOptions()};

      if (tokenData.length === 2) {
        [matcher, tokenHandler] = tokenData;
      } else if (tokenData.length === 3) {

        // Start conditions, no options.
        if (
          Array.isArray(tokenData[0]) &&
          typeof tokenData[2] === 'string'
        ) {
          [startConditions, matcher, tokenHandler] = tokenData;
        }

        // Trailing options, no start conditions.
        else if (
          typeof tokenData[0] === 'string' &&
          typeof tokenData[2] === 'object'
        ) {
          [matcher, tokenHandler, options] = tokenData;
        }
      } else if (tokenData.length === 4) {
        [startConditions, matcher, tokenHandler, options] = tokenData;
      }

      return new LexRule({
        startConditions,
        matcher,
        tokenHandler,
        options: Object.assign(defaultOptions, options),
      });
    });
  }

  /**
   * Builds a map from a start condition to a list of
   * lex rules which should be executed once a lexer
   * enters this state.
   */
  _processRulesByStartConditions() {
    const rulesByConditions = {};

    for (const condition in this._startConditions) {
      const inclusive = this._startConditions[condition] === 0;

      const rules = this._rules.filter(lexRule => {
        // A rule is included if a lexer is in this state,
        // or if a condition is inclusive, and a rule doesn't have
        // any explicit start conditions. Also if the condition is `*`.
        // https://gist.github.com/DmitrySoshnikov/f5e2583b37e8f758c789cea9dcdf238a
        return (inclusive && !lexRule.hasStartConditions()) ||
          (lexRule.hasStartConditions() &&
           (lexRule.getStartConditions().includes(condition) ||
            lexRule.getStartConditions().includes('*')));
      });

      rulesByConditions[condition] = rules;
    }

    return rulesByConditions;
  }

  /**
   * If lexical grammar provides "macros" property, and has e.g entry:
   * "digit": "[0-9]", with later usage of {digit} in the lex rules,
   * this functions expands it to [0-9].
   */
  _extractMacros(macros, rules) {
    if (!macros) {
      return;
    }

    rules.forEach(lexData => {
      const index = lexData.length === 3 ? 1 : 0;

      // Standard macros.
      for (let macro in StandardMacros) {
        if (lexData[index].indexOf(macro) !== -1) {
          lexData[index] = lexData[index].replace(
            new RegExp(macro, 'g'),
            () => StandardMacros[macro],
          );
        }
      }

      for (let macro in macros) {
        // User-level macros.
        if (lexData[index].indexOf(`{${macro}}`) !== -1) {
          lexData[index] = lexData[index].replace(
            new RegExp(`\\{${macro}\\}`, 'g'),
            () => macros[macro],
          );
        }
      }
    });
  }
};