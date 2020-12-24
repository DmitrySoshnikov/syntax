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
    // Forward:
    this.writeData('PARSER_CLASS_NAME', className);

    // Class name:
    this.writeData('PARSER_CLASS_NAME', className);

    // Alias:
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
   *       {0, {TE::Shift, 4}},
   *       {5, {TE::Reduce, 2}},
   *       {3, {TE::Accept, 0}},
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
          row[key] = `{TE::Shift, ${entry.slice(1)}}`;
        } else if (entry[0] === 'r') {
          row[key] = `{TE::Reduce, ${entry.slice(1)}}`;
        } else if (entry === 'acc') {
          row[key] = `{TE::Accept, 0}`;
        } else {
          row[key] = `{TE::Transit, ${entry}}`;
        }
      });

      return this._toCppMap(
        table[state],
        'Row',
        'number',
        'raw',
      );
    });

    this.writeData('ROWS_COUNT', entries.length);

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

    const argsInfo = this._getParamsInfo(production, action);

    action = this._generateHandlerPrologue(action, argsInfo);
    action = this._generateHandlerEpilogue(action, argsInfo);

    // Save the action, they are injected later.
    this._productionHandlers.push({args: ['yyparse& parser'], action});
    return `"_handler${this._productionHandlers.length}"`;
  },

  /**
   * Returns info about params.
   */
  _getParamsInfo(production, action) {
    const info = {};
    if (production.isEpsilon()) {
      return info;
    }
    production.getRHS().forEach((symbol, index) => {
      const name = `_${index + 1}`;
      info[name] = {
        isUsed: action.includes(name),
        isToken: this._grammar.isTokenSymbol(symbol),
      };
    });
    return info;
  },

  /**
   * Generates prologue for fetching arguments from the parsing stack.
   */
  _generateHandlerPrologue(action, argsInfo) {
    const argsPrologue = [];

    Object.keys(argsInfo).reverse().forEach(name => {
      const info = argsInfo[name];
      if (info.isToken) {
        argsPrologue.push(
          info.isUsed
           ? `auto ${name} = POP_T();`
           : `parser.tokensStack.pop_back();`
        );
      } else {
        argsPrologue.push(
          info.isUsed
           ? `auto ${name} = POP_V();`
           : `parser.valuesStack.pop_back();`
        );
      }
    });

    return (
      '// Semantic action prologue.\n' +
      argsPrologue.join('\n') + '\n\n' +
      action
    );
  },

  /**
   * Generates handler epilogue.
   */
  _generateHandlerEpilogue(action, argsInfo) {
    const propagating = /\b__ = (_\d+)\b/.exec(action);
    let pushResult = 'PUSH_VR';
    if (propagating != null) {
      const arg = argsInfo[propagating[1]];
      if (arg != null && arg.isToken) {
        pushResult = 'PUSH_TR';
      }
    }
    return (
      `${action}\n\n // Semantic action epilogue.\n` +
      `CAPTURE_STATE();\n` +
      `${pushResult}();\n`
    );
  },

  /**
   * Productions array in C++ format.
   */
  generateProductions() {
    this.writeData(
      'PRODUCTIONS',
      `{{${this.generateProductionsData().join(',\n')}}}`
    );
  },

  /**
   * Default format in the { } array notation.
   */
  generateProductionsData() {
    this.writeData(
      'PRODUCTIONS_COUNT',
      this._grammar.getProductions().length,
    );
    return this.generateRawProductionsData()
      .map((data, index) => {
        data[2] = index == 0 ? `nullptr` : `&_handler${index}`;
        return `{${data.join(', ')}}`;
      });
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
    if (!/;\s*$/.test(handler)) {
      handler += ';';
    }

    let action = (this._scopeVars(handler) || '').trim();

    if (!action) {
      return 'return nullptr;';
    }

    return action;
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    const lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      let handler = lexRule.getRawHandler();

      if (!handler.includes('return')) {
        handler = `return ${handler}`;
      }

      let action = this._actionFromHandler(handler);

      this._lexHandlers.push({
        args: 'const Tokenizer& tokenizer, const std::string& yytext',
        action,
      });

      return `{std::regex(R"(${lexRule.getRawMatcher()})"), ` +
        `&_lexRule${this._lexHandlers.length}}`;
    });

    this.writeData('LEX_RULES_COUNT', lexRules.length);

    this.writeData('LEX_RULES', `{{\n  ${lexRules.join(',\n  ')}\n}}`);
  },

  /**
   * Lex rules by start condition.
   */
  generateLexRulesByStartConditions() {
    const lexGrammar = this._grammar.getLexGrammar();
    const lexRulesByConditions = lexGrammar.getRulesByStartConditions();
    const result = [];

    const tokenizerStates = Object.keys(lexRulesByConditions);
    this.writeData('TOKENIZER_STATES', tokenizerStates.join(',\n  '));

    for (const condition in lexRulesByConditions) {
      result[`TokenizerState::${condition}`] = lexRulesByConditions[condition].map(lexRule =>
        lexGrammar.getRuleIndex(lexRule)
      );
    }

    this.writeData(
      'LEX_RULES_BY_START_CONDITIONS',
      `${this._toCppMap(result, '', 'raw')}`,
    );
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code) {
    code = code
      .replace(/yytext/g, 'tokenizer.yytext')
      .replace(/\b__\b/g, 'auto __');

    const tokenRe = /return\s+([^;]+?);/g;

    return code.replace(tokenRe, (_match, token) => {
      token = token.replace(/^['"]|['"]$/g, '');
      if (token === '%empty' || token === 'nullptr' || token === 'NULL') {
        return `return TokenType::__EMPTY;`;
      }
      if (this._terminalsMap.hasOwnProperty(token)) {
        return `return TokenType::TOKEN_TYPE_${this._terminalsMap[token]};`;
      }
      return `return TokenType::${token};`;
    });
  },

  _mapKey(key, keyType) {
    switch (keyType) {
      case 'string': return `"${key}"`;
      case 'number': return Number(key);
      case 'raw': return key;
      default:
        throw new Error('_mapKey: Incorrect type ' + keyType);
    }
  },

  _mapValue(value, valueType) {
    if (Array.isArray(value)) {
      // Support only int vectors here for simplicity.
      return `{${value.join(', ')}}`;
    }

    switch (valueType) {
      case 'string': return `"${value}"`;
      case 'number': return Number(value);
      case 'raw': return value;
      default: return value;
    }
  },

  /**
   * Converts JS object to C++ map type representation.
   */
  _toCppMap(object, typeName = '', keyType = 'string', valueType = 'string') {
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/"/g, '\\"');
      result.push(
        `{${this._mapKey(key, keyType)}, ` +
        `${this._mapValue(value, valueType)}}`
      );
    }
    return `${typeName} {${result.join(', ')}}`;
  },


  /**
   * C++ specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lexRule',
      'inline TokenType'
    );
    this.writeData('LEX_RULE_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Creates token names.
   */
  generateTokenTypes() {
    const tokenTypes = [...this._grammar.getTokenSymbols()];
    let index = tokenTypes.length + 2; // + 2 for __EMPTY and __EOF
    this._grammar.getTerminalSymbols().forEach(terminal => {
      tokenTypes.push(`TOKEN_TYPE_${index}`);
      this._terminalsMap[terminal] = index;
      this._terminalsIndexMap[index++] = terminal;
    });
    this.writeData('TOKEN_TYPES', tokenTypes.join(',\n  '));
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

  _generateHandlers(handlers, name, returnType) {
    return handlers.map(({args, action}, index) => {
      return `${returnType} ${name}${index + 1}` +
        `(${args}) {\n${action}\n}`
    });
  },
};

module.exports = CppParserGeneratorTrait;
