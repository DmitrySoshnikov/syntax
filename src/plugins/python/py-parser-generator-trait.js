/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * Python tokenizer template.
 */
const PY_TOKENIZER_TEMPLATE = fs.readFileSync(
  `${__dirname}/templates/tokenizer.template.py`,
  'utf-8'
);

/**
 * Standard Python's indentation.
 */
const STANDARD_SPACES = ' '.repeat(4);

/**
 * The trait is used by parser generators (LL/LR) for Python.
 */
const PythonParserGeneratorTrait = {

  /**
   * Module include code.
   */
  generateModuleInclude() {
    this.writeData(
      '<<MODULE_INCLUDE>>',
      this._formatIndent(this._grammar.getModuleInclude(), /* no ident */''),
    );
  },

  /**
   * Since Python's lambdas are one-liners, we use normal `def`
   * functiona declarations, and put a reference it them in the table.
   */
  buildSemanticAction(production) {
    const action = this.getSemanticActionCode(production);

    if (!action) {
      return null;
    }

    const args = this
      .getSemanticActionParams(production)
      .join(',');

    // Save the action, they are injected later.
    this._productionHandlers.push({args, action});
    return `_handler${this._productionHandlers.length}`;
  },

  /**
   * Generates built-in tokenizer instance.
   */
  generateBuiltInTokenizer() {
    this.writeData('<<TOKENIZER>>', PY_TOKENIZER_TEMPLATE);
  },

  /**
   * Generates rules for tokenizer.
   */
  generateLexRules() {
    const lexRules = this._grammar.getLexGrammar().getRules().map(lexRule => {
      const action = lexRule.getRawHandler();
      this._lexHandlers.push({args: 'self', action});

      let flags = [];

      if (lexRule.isCaseInsensitive()) {
        flags.push('i');
      }

      if (flags.length > 0) {
        flags = `(?${flags.join('')})`
      } else {
        flags = '';
      }

      return `['${flags}${lexRule.getRawMatcher()}', ` +
        `_lex_rule${this._lexHandlers.length}]`;
    });

    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
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
      '<<LEX_RULES_BY_START_CONDITIONS>>',
      `${JSON.stringify(result)}`,
    );
  },

  /**
   * Python-specific lex rules handler declarations.
   */
  generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lex_rule',
    );
    this.writeData('<<LEX_RULE_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Python-specific handler declarations.
   */
  generateProductionHandlers() {
    const handlers = this._generateHandlers(
      this._productionHandlers,
      '_handler',
    );
    this.writeData('<<PRODUCTION_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Generates Python's `def` function declarations for handlers.
   */
  _generateHandlers(handlers, name) {
    return handlers.map(({args, action}, index) => {
      const formatted = this._formatIndent(action);
      return `def ${name}${index + 1}(${args}):\n` +
        `${STANDARD_SPACES}global __, yytext, yyleng\n` + formatted;
    });
  },

  /**
   * Formats Python's indentation.
   */
  _formatIndent(code, indent = STANDARD_SPACES) {
    const lines = code.split('\n');
    let firstNonEmptyLine;

    for (let line of lines) {
      if (line.trim() !== '') {
        firstNonEmptyLine = line;
        break;
      }
    }

    // First line defines indentation.
    const spaceMatch = (firstNonEmptyLine || '').match(/^\s+/);
    const spacesCount = spaceMatch ? spaceMatch[0].length : 0;

    const formatted = lines.map(line => {
      return indent + line.substring(spacesCount);
    });

    if (formatted.length === 0) {
      formatted.push(`${STANDARD_SPACES}pass`);
    }

    return formatted.join('\n');
  }
};

module.exports = PythonParserGeneratorTrait;