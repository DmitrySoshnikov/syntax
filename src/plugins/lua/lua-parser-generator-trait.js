/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

const LUA_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.lua`,
  'utf-8'
);

const LuaParserGeneratorTrait = {

  /**
   * Generates parser class name.
   */
  generateParserClassName(className) {
    this.writeData('PARSER_CLASS_NAME', className);
  },

  generateParseTable() {
    this.writeData(
      'TABLE',
      this._toLuaMap(this.generateParseTableData()),
    );
  },

  /**
   * Generates tokens table in Lua Map format.
   */
  generateTokensTable() {
    this.writeData(
      'TOKENS',
      this._toLuaMap(this._tokens),
    );
  },

  buildSemanticAction(production) {
    let action = this.getSemanticActionCode(production);

    if (!action) {
      return null;
    }

    action += ';';

    const args = this
      .getSemanticActionParams(production)
      .join(',');

    this._productionHandlers.push({args, action});
    return `_handler${this._productionHandlers.length}`;
  },

  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => {
        return `{ ${data.map((item, index) => {
          // quote 
          if (index >= 2) {
            return `"${item}"`;
          }
          return item;
        }).join(',')} }`;
      });
  },

  generateBuiltInTokenizer() {
    this.writeData('TOKENIZER', LUA_TOKENIZER_TEMPLATE);
  },

  generateLexRules() {
    let lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {

      const action = lexRule.getRawHandler() + ';';

      this._lexHandlers.push({args: '', action});

      const flags = [];

      if (lexRule.isCaseInsensitive()) {
        flags.push('i');
      }

      // Example: ["^\s+", "_lexRule1"],
      return `{[[${lexRule.getRawMatcher()}${flags.join('')}]], ` +
        `"_lexRule${this._lexHandlers.length}"}`;
    });

    this.writeData('LEX_RULES', `{ ${lexRules.join(',\n')} }`);
  },

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
      `${this._toLuaMap(result)}`,
    );
  },

  /**
   * Converts JS object to Lua's table representation.
   * E.g. converts {foo: 10, bar: 20} into {foo = 10, bar = 20}
   */
  _toLuaMap(value) {
    function _toLuaMapInner(value) {
      if (value === null) return "nil";
      if (typeof value === "number" || typeof value === "boolean") return value.toString();
      if (typeof value === "string") {
        // 如果字符串完全由数字组成，就不加引号
        if (/^[0-9]+$/.test(value)) {
          return value;
        }
        return `"${value.replace(/"/g, '\\"')}"`;
      }

      if (Array.isArray(value)) {
          const items = value.map(_toLuaMapInner).join(", ");
          return `{${items}}`;
      }

      if (typeof value === "object") {
          const entries = Object.entries(value).map(([k, v]) => {
              const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `[${_toLuaMapInner(k)}]`;
              return `${key} = ${_toLuaMapInner(v)}`;
          }).join(", ");
          return `{${entries}}`;
      }

      return "nil"; // fallback
    }

    return _toLuaMapInner(value);
  },

  /**
   * Lua lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      'Tokenizer:',
      '_lexRule',
      '' /* return type, you can use e.g. 'string' */
    );
    this.writeData('LEX_RULE_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Lua parser handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      'parser:',
      '_handler',
      '',  /* return type */
    );
    this.writeData('PRODUCTION_HANDLERS', handlers.join('\n'));
  },

  /**
   * Productions array in the Lua format.
   *
   * An array of arrays, see `generateProductionsData` for details.
   */
  generateProductions() {
    this.writeData(
      'PRODUCTIONS',
      `{ ${this.generateProductionsData().join(',\n')} }`
    );
  },

  /**
   * Injects the code passed in the module include directive.
   */
  generateModuleInclude() {
    let moduleInclude = this._grammar.getModuleInclude();

    if (!moduleInclude) {
      // Example: add some default module include if needed.
      moduleInclude = `
        let foo = 'Example module include';
      `;
    }

    this.writeData('MODULE_INCLUDE', moduleInclude);
  },

  _generateHandlers(handlers, class_prefix, name, returnType = '') {
    return handlers.map(({args, action}, index) => {
      return `\nfunction ${class_prefix}${name}${index + 1}` +
        `(${args})\n\t\t${action}\nend`
    });
  },
};

module.exports = LuaParserGeneratorTrait;