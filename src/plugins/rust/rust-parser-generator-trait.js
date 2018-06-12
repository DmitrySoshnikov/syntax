/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

import colors from 'colors';

/**
 * Rust tokenizer template.
 */
const RUST_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.rs`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for Rust.
 */
const RustParserGeneratorTrait = {

  /**
   * Generates parsing table in Rust vector format.
   */
  generateParseTable() {
    this.writeData(
      'TABLE',
      this._buildTable(this.generateParseTableData()),
    );
  },

  /**
   * Converts JS object into Rust HashMap.
   *
   * In Rust we represent a table as a vector, where index is a state number,
   * and a value is a hashmap of LR entries (shift/reduce/etc).
   *
   * Example:
   *
   * vec![
   *     hashmap! { 1 => TE::Shift(4), 3 => TE::Reduce(1), ... },
   * ]
   */
  _buildTable(table) {
    const entries = Object.keys(table).map(state => {
      const row = table[state];

      // Transform to Rust enum format: "s3" => TE::Shift(3), etc
      Object.keys(row).forEach(key => {
        const entry = row[key];
        if (entry[0] === 's') {
          row[key] = `TE::Shift(${entry.slice(1)})`;
        } else if (entry[0] === 'r') {
          row[key] = `TE::Reduce(${entry.slice(1)})`;
        } else if (entry === 'acc') {
          row[key] = `TE::Accept`;
        } else {
          row[key] = `TE::Transit(${entry})`;
        }
      });

      return this._toRustHashMap(table[state], 'number')
    });

    return `vec![\n    ${entries.join(',\n    ')}\n]`;
  },

  /**
   * Generates tokens table in Rust hashmap format.
   */
  generateTokensTable() {
    this.writeData(
      'TOKENS',
      this._toRustHashMap(this._tokens, 'string', 'number'),
    );
  },

  /**
   * Production handlers are implemented as methods on the parser class.
   */
  buildSemanticAction(production) {
    let originalAction = this.getSemanticActionCode(production);

    let {action, types} = this._extractDataTypes(originalAction);

    action = this._actionFromHandler(action, '.tokenizer');

    action = this._generateArgsPrologue(
      action,
      types,
      // Total number of args.
      production.isEpsilon() ? 0 : production.getRHS().length
    );

    // Append return value.
    const returnValue = types.hasOwnProperty('__')
      ? `SV::_${this._allTypes[types.__]}(__)`
      : `__`;

    action = action + `\n${returnValue}`;

    // Save the action, they are injected later.
    this._productionHandlers.push({args: '&mut self', action});
    return null;
  },

  /**
   * Builds SV (stack value) enum from all the used types in handlers.
   */
  generateStackValueEnum() {
    const svEnum = Object.keys(this._allTypes).map(
      (typeName, idx) => `_${idx}(${typeName})`
    );
    this.writeData('SV_ENUM', svEnum.join(',\n    '));
  },

  /**
   * Generates prologue for fetching arguments from the parsing stack.
   */
  _generateArgsPrologue(action, types, totalArgsCount) {
    const argsPrologue = [];

    for (let i = totalArgsCount; i > 0; i--) {
      const arg = '_' + i;

      if (!types.hasOwnProperty(arg)) {
        // Just pop if arg is not used in the handler.
        argsPrologue.push(`self.values_stack.pop();`);
      } else {
        const typeInfo = types[arg];

        if (typeInfo) {
          argsPrologue.push(
            `let mut ${arg} = pop!(self.values_stack, ` +
            `_${this._allTypes[typeInfo]});`
          );
        } else {
          argsPrologue.push(
            `let mut ${arg} = self.values_stack.pop().unwrap();`
          );
        }
      }
    }

    return (
      '// Semantic values prologue.\n' +
      argsPrologue.join('\n') + '\n\n' +
      action
    );
  },

  /**
   * Extracts types of the used arguments, and return types.
   * If a type is defined, a popped stack value is casted,
   * otherwise, it's just popped (if doesn't participate in an operation
   * and just propagated).
   */
  _extractDataTypes(action) {
    const types = {};

    if (!action) {
      return {action: '', types};
    }

    const typesRe = /\s*\|([^|]*)\|\s*->\s*(\w+);/g;
    const typesData = typesRe.exec(action);

    if (typesData) {
      // '$1:i32, $3:i32'
      if (typesData[1].trim().length > 0) {
        const argTypes = typesData[1].trim().split(/\s*[,;]\s*/);
        argTypes.forEach(argData => {
          const data = argData.split(/\s*:\s*/);
          // types[$1] = 'i32';
          types[data[0]] = data[1];

          // Save the type to all types data to generate enum.
          if (!this._allTypes.hasOwnProperty(data[1])) {
            this._allTypes[data[1]] = this._allTypesIndex++;
          }
        });
      }

      // Result type.
      if (typesData[2]) {
        types.__ = typesData[2];

        if (!this._allTypes.hasOwnProperty(typesData[2])) {
          this._allTypes[typesData[2]] = this._allTypesIndex++;
        }
      }
    }

    // Strip the types info.
    action = action.replace(typesRe, '');

    // Extract other args, which do not use types.
    const argsRe = /_\d+/g;

    const usedArgs = action.match(argsRe);
    if (usedArgs) {
      usedArgs.forEach(usedArg => {
        if (!types.hasOwnProperty(usedArg)) {
          // Arg is used, but without a type.
          types[usedArg] = null;
        }
      });
    }

    return {types, action};
  },

  /**
   * Default format in the [ ] array notation.
   */
  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => {
        // Remove the semantic action handler, since in Rust
        // we use a different structure to hold it.
        delete data[2];
        return `[${data.join(', ')}]`;
      });
  },

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    this.writeData('TOKENIZER', RUST_TOKENIZER_TEMPLATE);
  },

  /**
   * Creates an action from raw handler.
   */
  _actionFromHandler(handler, context = '') {
    let action = (this._scopeVars(handler, context) || '').trim();

    if (!action) {
      return 'let __ = SV::Undefined;';
    }

    // From parser hooks, append ; at the end.
    if (context === '.tokenizer' && !/;\s*$/.test(action)) {
      action += ';';
    }

    return action;
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    const lexRulesArray = [];

    const lexRules = this._grammar.getLexGrammar().getRules().map((rule, i) => {
      let action = this._actionFromHandler(rule.getRawHandler());

      this._lexHandlers.push({args: '&mut self', action});

      let flags = [];

      if (rule.isCaseInsensitive()) {
        flags.push('i');
      }

      if (flags.length > 0) {
        flags = `(?${flags.join('')})`
      } else {
        flags = '';
      }

      lexRulesArray.push(`Tokenizer::_lex_rule${i}`);

      // Example: r"\d+",
      return `r"${flags}${rule.getRawMatcher()}"`;
    });

    this.writeData('LEX_RULE_HANDLERS_COUNT', lexRules.length);
    this.writeData(
      'LEX_RULE_HANDLERS_ARRAY',
      `[\n    ${lexRulesArray.join(',\n    ')}\n],`
    );

    this.writeData(
      'LEX_RULES',
      `[&'static str; ${lexRules.length}] = ` +
      `[\n    ${lexRules.join(',\n    ')}\n]`
    );
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
      `${this._toRustHashMap(result, 'string')}`,
    );
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code, context = '') {
    return code
      .replace(/yytext/g, `self${context}.yytext`)
      .replace(/yyleng/g, `self${context}.yyleng`)
      .replace(/__\s*=/g, `let __ =`)
      .replace(/yyloc/g, 'Loc::from_tokens_range');
  },

  /**
   * Type-converts a key of a Rust HashMap, e.g. string or number, etc.
   */
  _hashKey(key, keyType) {
    switch (keyType) {
      case 'string': return `"${key}"`;
      case 'number': return Number(key);
      default:
        throw new Error('_hashKey: Incorrect type ' + keyType);
    }
  },

  /**
   * Type-converts a value of a Rust hashmap, e.g. string or number, etc.
   */
  _hashValue(value, valueType) {
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
   * Converts JS object to Rust HashMap representation.
   */
  _toRustHashMap(object, keyType, valueType) {
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/"/g, '\\"');
      result.push(
        `${this._hashKey(key, keyType)} => ` +
        `${this._hashValue(value, valueType)}`
      );
    }
    return `hashmap! { ${result.join(', ')} }`;
  },

  /**
   * Rust-specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lex_rule',
      "&'static str"
    );
    this.writeData('LEX_RULE_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Rust-specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      '_handler',
      'SV'
    );

    this.writeData('PRODUCTION_HANDLERS_COUNT', handlers.length);

    const handlersArray = [];
    for (let i = 0; i < handlers.length; i++) {
      handlersArray.push(`Parser::_handler${i}`);
    }

    this.writeData(
      'PRODUCTION_HANDLERS_ARRAY',
      `[\n    ${handlersArray.join(',\n    ')}\n],`
    );

    this.writeData('PRODUCTION_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Productions array in Rust format.
   */
  generateProductions() {
    const productionsData = this.generateProductionsData();
    const productionsCount = productionsData.length;
    this.writeData(
      'PRODUCTIONS',
      `[[i32; 2]; ${productionsCount}] = ` +
      `[\n    ${productionsData.join(',\n    ')}\n]`
    );
  },

  /**
   * Module include.
   */
  generateModuleInclude() {
    const moduleInclude = this._grammar.getModuleInclude();

    const resultTypeData = /type\s+TResult\s*=\s*([^;]+);/.exec(moduleInclude);

    if (!resultTypeData) {
      throw new Error(
        `\n\nRust plugin should provide module include, and define at least ` +
        `result type:\n\n  ${colors.bold('type TResult = <...>;\n')}`
      );
    }

    // Result type.
    const resultType = resultTypeData[1];

    if (!this._allTypes.hasOwnProperty(resultType)) {
      throw new Error(
        `Result type ${colors.bold(resultType)} is not found in ` +
        `handled types. Make sure your productions return it.\n`
      );
    }

    this.writeData('RESULT_TYPE', `_${this._allTypes[resultType]}`);

    // Parser hooks.
    const onParseBegin = moduleInclude.indexOf('fn on_parse_begin') !== -1
      ? 'on_parse_begin(self, string);'
      : '';

    const hasOnParseEnd = moduleInclude.indexOf('fn on_parse_end') !== -1
      ? 'on_parse_end(self, &result);'
      : '';

    this.writeData('ON_PARSE_BEGIN_CALL', onParseBegin);
    this.writeData('ON_PARSE_END_CALL', hasOnParseEnd);

    this.writeData('MODULE_INCLUDE', moduleInclude);
  },

  /**
   * Generates Rust function declarations for handlers.
   */
  _generateHandlers(handlers, name, returnType) {
    return handlers.map(({args, action}, index) => {
      return `fn ${name}${index}` +
        `(${args}) -> ${returnType} {\n${action}\n}`
    });
  },
};

module.exports = RustParserGeneratorTrait;