/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * Julia tokenizer template.
 */
const JULIA_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.jl`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for the Julia language.
 *
 * Here we can override any needed method from the `LRParserGeneratorDefault`,
 * or even from the very base `BaseParserGenerator` to generate code in a
 * needed target language format.
 *
 * E.g., overriding `generateParseTable()` we can transform the parsing table,
 * which is received from the `generateParseTableData()`, from the JS format
 * to the format of the target language.
 */
const JuliaParserGeneratorTrait = {

  /**
   * Generates parsing table in Julia language Map format.
   *
   * An array of records, where index - 1 is a state number, and a value is a
   * dictionary from an encoded symbol (number) to a parsing action.
   *
   * The parsing action can be "Shift/s", "Reduce/r", a state
   * transition number, or "Accept/acc".
   *
   */
  generateParseTable() {
    this.writeData(
      'TABLE',
      this._buildJuliaTable(this.generateParseTableData()),
    );
  },

  _buildJuliaTable(table) {
    const entries = [];
    Object.keys(table).forEach(state => {
      entries.push(
        this._toJuliaDictionary(table[state], 'number', 'string')
      );
    });
    return `[ ${entries.join(',\n\n')} ]`;
  },

  /**
   * Generates a string that, when parsed by Julia, will create a Julia dictionary.
   * 
   * Example: Dict(0=>"str1", 5=>"str2") or Dict("str1"=>42, "str2"=>84)
   */
  _toJuliaDictionary(object, keyType, valueType) {
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/"/g, '\\"');
      result.push(`${this._dictKey(key, keyType)}=>${this._dictValue(value, valueType)}`);
    }
    return `Dict(${result.join(', ')})`;
  },

  /**
   * Type-converts a key of a Julia dictionary, e.g. string or number, etc.
   */
  _dictKey(key, keyType) {
    switch (keyType) {
      case 'string': return `raw"${key}"`;
      case 'number': return Number(key);
      default:
        throw new Error('_dictKey: Incorrect type ' + keyType);
    }
  },

  /**
   * Type-converts a value of a Julia dictionary, e.g. string or number, etc.
   * For arrays, produces a Vector (single dimensional array) of the values
   */
  _dictValue(value, valueType) {
    if (Array.isArray(value)) {
      return `[ ${value.join(', ')} ]`;
    }

    switch (valueType) {
      case 'string': return `"${value}"`;
      case 'number': return Number(value);
      default:
        throw new Error('_dictValue: Incorrect value ' + valueType);
    }
  },

  /**
   * Generates tokens table in Julia language Vector and Dictionary format.
   */
  generateTokensTable() {
    this.writeData(
      'TOKENS',
      this._toJuliaDictionary(this._tokens, 'string', 'number'),
    );
  },

  /**
   * Production handlers are implemented as Julia functions
   */
  buildSemanticAction(production) {
    let action = this.getSemanticActionCode(production);

    if (!action) {
      return null;
    }

    const args = this
      .getSemanticActionParams(production)
      .join(',');

    // Save the action, they are injected later.
    // "_handler1", "_handler2", etc.
    this._productionHandlers.push({args, action});
    return `_handler${this._productionHandlers.length}`;
  },

  /**
   * We override this because the standard parser generator
   * uses variable __ as value of $$ in grammar production,
   * but Julia puts special meaning on all-underscore variable
   * names so we need to instead replace with our variable, _res
   * 
   * From Julia manual:
   * A particular class of variable names is one that contains only underscores. These identifiers can only be assigned
   * values but cannot be used to assign values to other variables. More technically, they can only be used as an L-value, 
   * but not as an R-value
   * 
   */
  getSemanticActionCode(production) {
    const rawAction = production.getRawSemanticAction();

    if (!rawAction) {
      return null;
    }

    let action = rawAction
      // Replace $1, $2, @1, ... $$ with _1, _2, _1loc, ... __, etc.
      .replace(/\$(\d+)/g, '_$1')
      .replace(/@(\d+)/g, '_$1loc')
      .replace(/\$\$/g, 'parserdata.__res')
      .replace(/@\$/g, 'parserdata.__loc');

    if (this._grammar.shouldCaptureLocations()) {
      action = this.createLocationPrologue(production) + action;
    }

    return action || null;
  },

  createLocationPrologue(production) {
    // Code that goes within the handler itself to handle the location data
    if (production.isEpsilon()) {
      return 'parserdata.__loc = null\n';
    }

    const start = 1;
    const end = production.getRHS().length;

    return `parserdata.__loc = yyloc(_${start}loc, _${end}loc)\n`;
  },

  /**
   * Default format in the [ ] array notation.
   *
   * The `generateRawProductionsData` from the base class returns
   * an encoded grammar productions table.
   *
   * Format of an array:
   *
   * [ <Non-Terminal Index>, <RHS.Length>, <handler> ]
   *
   * Non-terminal indices are from 0 to Last Non-terminal index.
   * LR-algorithm uses length of RHS to pop symbols from the stack; this
   * length is stored as the second element of a record. The last element is
   * an optional name of the semantic action handler. The first record is always
   * a special marker [-1, -1] entry representing an augmented production.
   *
   * Example:
   *
   * [
   *     [-1, 1],
   *     [0, 3, "_handler1"],
   *     [0, 2, "_handler2"],
   *     ...
   * ]
   */
  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => `[ ${data} ]`);
  },

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    this.writeData('TOKENIZER', JULIA_TOKENIZER_TEMPLATE);
  },

  /**
   * Generates rules for tokenizer.
   *
   * Vector of vectors with the first element being a regular expression,
   * flags at end after double quote:
   *
   * [
   *   [r"^\s+", "_lexRule1"],
   *   [r"^\d+/"i, "_lexRule2"],
   *   ...
   * ]
   *
   */
  generateLexRules() {
    let lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {

      const action = lexRule.getRawHandler();

      this._lexHandlers.push({args: '', action});

      const flags = [];

      if (lexRule.isCaseInsensitive()) {
        flags.push('i');
      }

      // Example: [r"^\s+"i, "_lexRule1"],
      return `[r"${lexRule.getRawMatcher()}"${flags.join('')}, ` +
        `"_lexRule${this._lexHandlers.length}"]`;
    });

    this.writeData('LEX_RULES', `[ ${lexRules.join(',\n')} ]`);
  },

  /**
   * Generates lexical rules grouped by start conditions. A dictionary from state
   * name to the list of lex rule indices from the `LEX_RULES`.
   *
   * Example:
   *
   * Dict([
   *   "INITIAL"=>[0,5,6,7],
   *   "comment"=>[1,2,3,4,6],
   *   ...
   * ])
   */
  generateLexRulesByStartConditions() {
    const lexGrammar = this._grammar.getLexGrammar();
    const lexRulesByConditions = lexGrammar.getRulesByStartConditions();
    const result = {};

    for (const condition in lexRulesByConditions) {
      result[condition] = lexRulesByConditions[condition].map(lexRule =>
        lexGrammar.getRuleIndex(lexRule)
      );
    }

    this.writeData(
      'LEX_RULES_BY_START_CONDITIONS',
      `${this._toJuliaDictionary(result, 'string')}`,
    );
  },

  /**
   * Julia language specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateLexHandlers(
      this._lexHandlers,
      '_lexRule',
    );
    this.writeData('LEX_RULE_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Julia language specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateProductionHandlers(
      this._productionHandlers,
      '_handler',
    );
    this.writeData('PRODUCTION_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Productions array in the Example language format.
   *
   * An Vector of vectors, see `generateProductionsData` for details.
   */
  generateProductions() {
    this.writeData(
      'PRODUCTIONS',
      `[ ${this.generateProductionsData().join(',\n')} ]`
    );
  },

  /**
   * Injects the code passed in the module include directive.
   */
  generateModuleInclude() {
    let moduleInclude = this._grammar.getModuleInclude();

    if (!moduleInclude) {
      moduleInclude = '';
    }

    this.writeData('MODULE_INCLUDE', moduleInclude);
  },

  /**
   * Generates function declarations for production handlers.
   *
   * Example:
   *
   * function _handler1(parserdata, _1, _2)
   *   parserdata._res = _1 + _2;
   * end
   */
  _generateProductionHandlers(handlers, name) {
    return handlers.map(({args, action}, index) => {
      return `function ${name}${index + 1}(parserdata, ${args}) \n${action}\n end`
    });
  },

  /**
   * Generates function declarations for lexical handlers.
   *
   * function _lexRule1()
   *   return "NUMBER";
   * end
   */
  _generateLexHandlers(handlers, name) {
    return handlers.map(({args, action}, index) => {
      return `function ${name}${index + 1}(${args}) \n${action}\n end`
    });
  },
};

module.exports = JuliaParserGeneratorTrait;