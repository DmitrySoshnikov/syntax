/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import fs from 'fs';

/**
 * Python tokenizer template.
 */
const PY_TOKENIZER_TEMPLATE = fs.readFileSync(
`${__dirname}/../templates/python/tokenizer.template.py`,
  'utf-8'
);

/**
 * The trait is used by parser generators (LL/LR) for Python.
 */
const PythonParserGeneratorTrait = {

  /**
   * Since Python's lambdas are one-liners, we use normal `def`
   * functiona declarations, and put a reference it them in the table.
   */
  buildSemanticAction(production) {
    const semanticActionData = this.getSemanticActionData(production);

    if (!semanticActionData) {
      return null;
    }

    // Save the action, they are injected later.
    this._productionHandlers.push(semanticActionData);
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
    let lexRules = this._grammar.getLexRules().map(lexRule => {
      const action = lexRule.getRawHandler();
      this._lexHandlers.push({args: '', action});

      return `['${lexRule.getRawMatcher()}', ` +
        `_lex_rule${this._lexHandlers.length}]`;
    });

    this.writeData('<<LEX_RULES>>', `[${lexRules.join(',\n')}]`);
  },

  /**
   * Python-specific lex rules handler declarations.
   */
  _generateLexHandlers() {
    const handlers = this._generateHandlers(
      this._lexHandlers,
      '_lex_rule',
    );
    this.writeData('<<LEX_RULE_HANDLERS>>', handlers.join('\n\n'));
  },

  /**
   * Python-specific handler declarations.
   */
  _generateProductionHandlers() {
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
    const standardSpaces = ' '.repeat(4);
    return handlers.map(({args, action}, index) => {
      const lines = action.split('\n')
        .filter(line => line.trim() != '');

      // First line defines indentation.
      const spaceMatch = (lines[0] || '').match(/^\s+/);
      const spacesCount = spaceMatch ? spaceMatch[0].length : 0;

      const formatted = lines.map(line => {
        // Replace arbitrary number of spaces with standard Python's 4.
        return standardSpaces + line.substring(spacesCount);
      });

      if (formatted.length === 0) {
        formatted.push(`${standardSpaces}pass`);
      }

      return `def ${name}${index + 1}(${args}):\n` +
        `${standardSpaces}global __, yytext, yyleng\n` + formatted;
    });
  },
};

module.exports = PythonParserGeneratorTrait;