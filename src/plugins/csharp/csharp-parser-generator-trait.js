/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * C# tokenizer template.
 */
const CSHARP_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.cs`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for C#.
 */
const CSharpParserGeneratorTrait = {

  /**
   * Generates parser class name.
   */
  generateParserClassName(className) {
    this.writeData('<<PARSER_CLASS_NAME>>', className);
  },

  /**
   * Generates parsing table in C# Dictionary format.
   */
  generateParseTable() {
    this.writeData(
      '<<TABLE>>',
      this._buildTable(this.generateParseTableData()),
    );
  },

  /**
   * Converts JS object into C# Dictionary.
   *
   * In C# we represent a table as an array, where index is a state number,
   * and a value is a record of LR entries (shift/reduce/etc).
   *
   * Example:
   * {
   *     new Dictionary<int, string>()
   *     {
   *         {0, "1"},
   *         {3, "s8"},
   *         {4, "s2"},
   *     },
   * }
   */
  _buildTable(table) {
    const entries = [];
    Object.keys(table).forEach(state => {
      entries.push(
        'new Dictionary<int, string>() ' +
        this._toCSharpDictionary(table[state], 'number', 'string')
      );
    });
    return `{ ${entries.join(',\n\n')} }`;
  },

  /**
   * Generates tokens table in C# Dictionary format.
   */
  generateTokensTable() {
    this.writeData(
      '<<TOKENS>>',
      this._toCSharpDictionary(this._tokens, 'string', 'number'),
    );
  },

  /**
   * Production handlers are implemented as methods on the `yyparse` class.
   */
  buildSemanticAction(production) {
    const semanticActionData = this.getSemanticActionData(
      production,
      /*arg type*/ 'dynamic',
    );

    if (!semanticActionData) {
      return null;
    }

    semanticActionData.action =
      this._scopeVars(semanticActionData.action) + ';';

    // Save the action, they are injected later.
    this._productionHandlers.push(semanticActionData);
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
    this.writeData('<<TOKENIZER>>', CSHARP_TOKENIZER_TEMPLATE);
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    const lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      const action = this._scopeVars(lexRule.getRawHandler()) + ';';
      this._lexHandlers.push({args: '', action});

      // Example: new string[] {@"^\s+", "_lexRule1"},
      return `new string[] { @"${lexRule.getRawMatcher()}", ` +
        `"_lexRule${this._lexHandlers.length}" }`;
    });

    this.writeData('<<LEX_RULES>>', `{ ${lexRules.join(',\n')} }`);
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
      '<<LEX_RULES_BY_START_CONDITIONS>>',
      `${this._toCSharpDictionary(result, 'string')}`,
    );
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code) {
    return code
      .replace(/yytext/g, 'yyparse.yytext')
      .replace(/yyleng/g, 'yyparse.yyleng');
  },

  /**
   * Type-converts a key of a C# dictionary, e.g. string or number, etc.
   */
  _dictKey(key, keyType) {
    switch (keyType) {
      case 'string': return `"${key}"`;
      case 'number': return Number(key);
      default:
        throw new Exception('_dictKey: Incorrect type ' + keyType);
    }
  },

  /**
   * Type-converts a value of a C# dictionary, e.g. string or number, etc.
   */
  _dictValue(value, valueType) {
    if (Array.isArray(value)) {
      // Support only int arrays here for simplicity.
      return `new int[] { ${value.join(', ')} }`;
    }

    switch (valueType) {
      case 'string': return `"${value}"`;
      case 'number': return Number(value);
      default:
        throw new Exception('_dictValue: Incorrect value ' + valueType);
    }
  },

  /**
   * Converts JS object to C#'s Dictionary representation.
   *
   * {x: 10, y: 20} -> {{"x", 10}, {"y", 20}}
   *
   * The `keyTransform`, and `valueTransform` are used to put
   * the data in needed types, e.g. strings, numbers, arrays, etc.
   */
  _toCSharpDictionary(object, keyType, valueType) {
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/"/g, '\\"');
      result.push(
        `{ ${this._dictKey(key, keyType)}, ` +
        `${this._dictValue(value, valueType)} }`
      );
    }
    return `{ ${result.join(', ')} }`;
  },

  /**
   * C#-specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lexRule',
      'object'
    );
    this.writeData('<<LEX_RULE_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * C#-specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      '_handler',
      'void'
    );
    this.writeData('<<PRODUCTION_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Productions array in C# format.
   */
  generateProductions() {
    this.writeData(
      '<<PRODUCTIONS>>',
      `{ ${this.generateProductionsData().join(',\n')} }`
    );
  },

  /**
   * Injects the code passed in the module include directive.
   * Default is class Init { public void run() { ... }}
   * which is used to setup parsing hooks, etc.
   */
  generateModuleInclude() {
    let moduleInclude = this._grammar.getModuleInclude();

    const defaultModuleInclude = `
      namespace SyntaxParser
      {
          public class Init
          {
              public static void run()
              {
                  // Put init code here.
                  // E.g. yyparse.onParseBegin = (string code) => { ... };
              }
          }
      }
    `;

    if (!moduleInclude) {
      moduleInclude = defaultModuleInclude;
    } else if (!/class Init\s+{/.test(moduleInclude)) {
      moduleInclude += defaultModuleInclude;
    }

    this.writeData('<<MODULE_INCLUDE>>', moduleInclude);
  },

  /**
   * Generates C#'s void function declarations for handlers.
   *
   * Example:
   *
   * public void _handler1(dynamic _1, dynamic _2)
   * {
   *     __ = _1 + _2;
   * }
   */
  _generateHandlers(handlers, name, returnType) {
    return handlers.map(({args, action}, index) => {
      return `public ${returnType} ${name}${index + 1}` +
        `(${args}) {\n${action}\n}`
    });
  },
};

module.exports = CSharpParserGeneratorTrait;