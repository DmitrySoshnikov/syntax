/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * Java tokenizer template.
 */
const JAVA_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.java`,
  'utf-8'
);

/**
 * Default parser events.
 */
const DEFAULT_PARSER_EVENTS_CLASS = `
  class ParserEvents {
    public static void init() {
      // Parser is created.
    }

    public static void onParseBegin(String _string) {
      // Parsing is started.
    }

    public static void onParseEnd(Object _result) {
      // Parsing is completed.
    }
  }
`;

/**
 * The trait is used by parser generators (LL/LR) for Java.
 */
const JavaParserGeneratorTrait = {

  /**
   * Generates parser class name.
   */
  generateParserClassName(className) {
    // Class name.
    this.writeData('PARSER_NAME', className);
    // Constructor.
    this.writeData('PARSER_NAME', className);
  },

  /**
   * Generates parsing table in Java vector format.
   */
  generateParseTable() {
    this.writeData(
      'TABLE',
      this._buildTable(this.generateParseTableData()),
    );
  },

  /**
   * Converts JS object into Java HashMap.
   *
   * In Java we represent a table as a List<Map<Integer, String>> mTable.
   *
   * Example:
   *
   *   mTable.add(
   *     new HashMap<Integer, String>() {{
   *       put(0, "1");
   *       put(3, "s2");
   *       put(4, "s3");
   *     }}
   *   );
   *  ...
   */
  _buildTable(table) {
    const entries = Object.keys(table).map(state => {
      return 'mTable.add(new HashMap<Integer, String>() {{ ' +
        this._toJavaHashMap(table[state], 'Integer', 'String') + ' }});';
    });

    return entries.join('\n    ');
  },

  /**
   * Generates tokens table in Java hashmap format.
   */
  generateTokensTable() {
    this.writeData(
      'TOKENS',
      this._toJavaHashMap(this._tokens, 'String', 'Integer'),
    );
  },

  /**
   * Production handlers are implemented as methods on the parser class.
   */
  buildSemanticAction(production) {
    const originalAction = this.getSemanticActionCode(production);

    let action = this._actionFromHandler(originalAction, '.tokenizer');

    action = this._generateArgsPrologue(
      action,
      // Total number of args.
      production.isEpsilon() ? 0 : production.getRHS().length
    );

    // Save the action, they are injected later.
    this._productionHandlers.push(action);
    return null;
  },

  /**
   * Generates prologue for fetching arguments from the parsing stack.
   */
  _generateArgsPrologue(action, totalArgsCount) {
    const argsPrologue = [];

    for (let i = totalArgsCount; i > 0; i--) {
      const arg = '_' + i;
      argsPrologue.push(
        action.indexOf(arg) === -1
          ? `mValueStack.pop();`
          : `StackEntry _${i} = mValueStack.pop();`
      );
    }

    return (
      '// Semantic values prologue.\n' +
      argsPrologue.join('\n') + '\n\n' +
      action.replace(/(_\d+)/g, '($1.semanticValue)')
    );
  },

  /**
   * Default format in the [ ] array notation.
   */
  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => {
        // Remove the semantic action handler, since in Java
        // we use a different structure to hold it.
        delete data[2];
        return `{${data.join(', ')}}`;
      });
  },

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    this.writeData('TOKENIZER', JAVA_TOKENIZER_TEMPLATE);
  },

  /**
   * Creates an action from raw handler.
   */
  _actionFromHandler(handler, context = '') {
    let action = (this._scopeVars(handler, context) || '').trim();

    if (!action) {
      return '__.semanticValue = null;';
    }

    // Append ; at the end if there is no one.
    if (!/;\s*$/.test(action)) {
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

      this._lexHandlers.push(action);

      let flags = [];

      if (rule.isCaseInsensitive()) {
        flags.push('i');
      }

      if (flags.length > 0) {
        flags = `(?${flags.join('')})`
      } else {
        flags = '';
      }

      lexRulesArray.push(
        `mLexHandlerMethods[${i}] = `+
        `Tokenizer.class.getDeclaredMethod("_lexRule${i}");`
      );

      const re = encodeRE(`${flags}${rule.getRawMatcher()}`);
      return `Pattern.compile("${re}")`;
    });

    this.writeData('LEX_RULE_METHODS_COUNT', lexRules.length);
    this.writeData('LEX_RULE_HANDLER_METHODS', lexRulesArray.join('\n      '));
    this.writeData('LEX_RULES', lexRules.join(',\n    '));
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
      `${this._toJavaHashMap(result, 'String', 'Integer[]')}`,
    );
  },

  /**
   * Replaces global vars like `yytext`, `$$`, etc. to be
   * referred from `yyparse`.
   */
  _scopeVars(code, context = '') {
    return code
      .replace(/yytext/g, `this${context}.yytext`)
      .replace(/yyleng/g, `this${context}.yyleng`)
      .replace(/__\s*=/g, `__.semanticValue =`);
  },

  /**
   * Type-converts a key of a Java HashMap, e.g. string or number, etc.
   */
  _hashKey(key, keyType) {
    switch (keyType) {
      case 'String': return `"${key}"`;
      case 'Integer': return Number(key);
      default:
        throw new Error('_hashKey: Incorrect type ' + keyType);
    }
  },

  /**
   * Type-converts a value of a Java hashmap, e.g. string or number, etc.
   */
  _hashValue(value, valueType) {
    if (Array.isArray(value)) {
      // Support only Integer arrays here for simplicity.
      return `new Integer[] { ${value.join(', ')} }`;
    }

    switch (valueType) {
      case 'String': return `"${value}"`;
      case 'Integer': return Number(value);
      default: return value;
    }
  },

  /**
   * Converts JS object to Java HashMap representation.
   */
  _toJavaHashMap(object, keyType, valueType) {
    let result = [];
    for (let k in object) {
      let value = object[k];
      let key = k.replace(/"/g, '\\"');
      result.push(
        `put(${this._hashKey(key, keyType)}, ` +
        `${this._hashValue(value, valueType)});`
      );
    }
    return result.join(' ');
  },

  /**
   * Java-specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lexRule',
      'String'
    );
    this.writeData('LEX_RULE_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Java-specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      '_handler',
      'void'
    );

    this.writeData('PRODUCTION_METHODS_COUNT', handlers.length);

    const handlersArray = [];
    for (let i = 0; i < handlers.length; i++) {
      handlersArray.push(
        `mProductionHandlerMethods[${i}] = ` +
        `${this._parserClassName}.class.getDeclaredMethod("_handler${i}");`
      );
    }

    this.writeData(
      'PRODUCTION_HANDLER_METHODS',
      handlersArray.join('\n      ')
    );

    this.writeData('PRODUCTION_HANDLERS', handlers.join('\n\n'));
  },

  /**
   * Productions array in Java format.
   */
  generateProductions() {
    this.writeData(
      'PRODUCTIONS',
      this.generateProductionsData().join(',\n    ')
    );
  },

  /**
   * Module include.
   */
  generateModuleInclude() {
    const moduleInclude = this._grammar.getModuleInclude();

    // Parser events.
    this.writeData(
      'PARSER_EVENTS_CLASS',
      moduleInclude.indexOf('class ParserEvents') === -1
        ? DEFAULT_PARSER_EVENTS_CLASS
        : ''
    );

    this.writeData('MODULE_INCLUDE', moduleInclude);
  },

  /**
   * Generates Java function declarations for handlers.
   */
  _generateHandlers(handlers, name, returnType) {
    return handlers.map((action, index) => {
      return `  ${returnType} ${name}${index}() {\n    ${action}\n  }`
    });
  },
};

function encodeRE(string) {
  return string.replace(/\\/g, '\\\\');
}

module.exports = JavaParserGeneratorTrait;
