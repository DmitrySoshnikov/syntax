/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * C++ tokenizer template.
 */
const CPP_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.h`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for C++.
 */
const CppParserGeneratorTrait = {

  /**
   * Generates parser class name.
   */
  generateParserClassName(className) {
    this.writeData('PARSER_CLASS_NAME', className);
  },

  /**
   * Generates parsing table in C++ map format.
   */
  generateParseTable() {
    this.writeData(
      'TABLE',
      this._buildTable(this.generateParseTableData()),
    );
  },

  /**
   * Converts JS object into C++ array.
   *
   * In C++ we represent a table as an std::array, where index is a state number,
   * and a value is a struct of LR entries (shift/reduce/etc).
   *
   * Example:
   *
   *   std::vector<Row> table {
   *     Row {
   *       {0, {Action::Shift, 4}},
   *       {5, {Action::Reduce, 2}},
   *       {3, {Action::Accept, 0}},
   *     }
   *    };
   */
  _buildTable(table) {
    const entries = Object.keys(table).map(state => {
      const row = table[state];

      // Transform to C++ enum format: "s3" => {A::Shift, 3}, etc
      Object.keys(row).forEach(key => {
        const entry = row[key];
        if (entry[0] === 's') {
          row[key] = `{A::Shift, ${entry.slice(1)}}`;
        } else if (entry[0] === 'r') {
          row[key] = `{A::Reduce, ${entry.slice(1)}}`;
        } else if (entry === 'acc') {
          row[key] = `{A::Accept, 0}`;
        } else {
          row[key] = `{A::Transit, ${entry}}`;
        }
      });

      return this._toCppMap(
        table[state],
        'Row',
        'number',
        'string',
      );
    });

    return `{\n    ${entries.join(',\n    ')}\n}`;
  },

  /**
   * Generates tokens table in C++ map format.
   */
  generateTokensTable() {
    this.writeData(
      'TOKENS',
      this._toCppMap(this._tokens, 'string', 'number'),
    );
  },

  /**
   * Production handlers are implemented as methods on the `yyparse` class.
   */
  buildSemanticAction(production) {
    let action = this.getSemanticActionCode(production);

    if (!action) {
      return null;
    }

    action = this._actionFromHandler(action);

    const args = this
      .getSemanticActionParams(production)
      // Append type information for C++.
      .map(arg => `Value ${arg}`)
      .join(',');

    // Save the action, they are injected later.
    this._productionHandlers.push({args, action});
    return `"_handler${this._productionHandlers.length}"`;
  },

  /**
   * Default format in the [ ] array notation.
   */
  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => `new object[] { ${data} }`);
  },

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    this.writeData('TOKENIZER', CPP_TOKENIZER_TEMPLATE);
  },

  /**
   * Creates an action from raw handler.
   */
  _actionFromHandler(handler) {
    let action = (this._scopeVars(handler) || '').trim();

    if (!action) {
      return 'return nullptr;';
    }

    if (!/;\s*$/.test(action)) {
      action += ';';
    }

    return action;
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    const lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      let action = this._actionFromHandler(lexRule.getRawHandler());

      this._extractTokenNames(action);

      this._lexHandlers.push({args: '', action});

      let flags = [];

      if (lexRule.isCaseInsensitive()) {
        flags.push('i');
      }

      if (flags.length > 0) {
        flags = `(?${flags.join('')})`
      } else {
        flags = '';
      }

      // Example: new string[] {@"^\s+", "_lexRule1"},
      return `new string[] { @"${flags}${lexRule.getRawMatcher()}", ` +
        `"_lexRule${this._lexHandlers.length}" }`;
    });

    this.writeData('LEX_RULES', `{ ${lexRules.join(',\n')} }`);
  },

  generateLexRulesByStartConditions() {
    const lexGrammar = this._grammar.getLexGrammar();
    const lexRulesByConditions = lexGrammar.getRulesByStartConditions();
    const result = [];

    for (const condition in lexRulesByConditions) {
      result[condition] = lexRulesByConditions[condition].map(lexRule =>
        lexGrammar.getRuleIndex(lexRule)
      );
    }

    this.writeData(
      'LEX_RULES_BY_START_CONDITIONS',
      `${this._toCppMap(result, 'string')}`,
    );
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code) {
    return code
      .replace(/yytext/g, 'yyparse.yytext')
      .replace(/yyleng/g, 'yyparse.yyleng')
      .replace(/yyloc/g, 'YyLoc.yyloc');
  },

  _mapKey(key, keyType) {
    switch (keyType) {
      case 'string': return `"${key}"`;
      case 'number': return Number(key);
      default:
        throw new Error('_mapKey: Incorrect type ' + keyType);
    }
  },

  _mapValue(value, valueType) {
    if (Array.isArray(value)) {
      // Support only int arrays here for simplicity.
      return `vec! [ ${value.join(', ')} ]`;
    }

    switch (valueType) {
      case 'string': return `"${value}"`;
      case 'number': return Number(value);
      default: return value;
    }
  },

  /**
   * Converts JS object to C++ map type representation.
   */
  _toCppMap(object, typeName, keyType = 'string', valueType = 'string') {
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/"/g, '\\"');
      result.push(
        `${this._mapKey(key, keyType)} => ` +
        `${this._mapValue(value, valueType)}`
      );
    }
    return `${typeName} { ${result.join(', ')} }`;
  },


  /**
   * C++ specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lexRule',
      'object'
    );
    this.writeData('LEX_RULE_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Creates token names.
   */
  generateTokenNames() {
    const tokenNames = this._tokenNames.map((tokenName, index) => {
      return `constexpr static int ${tokenName} = ${index};`;
    });
    this.writeData('TOKEN_NAMES', tokenNames.join('\n  '));
  },

  /**
   * Extracts Token.NUMBER, etc.
   */
  _extractTokenNames(action) {
    const tokenRe = /Token::(\w+)/g;

    let tokenMatch;
    while ((tokenMatch = tokenRe.exec(action)) != null) {
      this._tokenNames.push(tokenMatch[1]);
    }
  },

  /**
   * C++ specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      '_handler',
      'void'
    );
    this.writeData('PRODUCTION_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Productions array in C++ format.
   */
  generateProductions() {
    this.writeData(
      'PRODUCTIONS',
      `{ ${this.generateProductionsData().join(',\n')} }`
    );
  },

  _generateHandlers(handlers, name, returnType) {
    return handlers.map(({args, action}, index) => {
      return `public ${returnType} ${name}${index + 1}` +
        `(${args}) {\n${action}\n}`
    });
  },
};

module.exports = CppParserGeneratorTrait;