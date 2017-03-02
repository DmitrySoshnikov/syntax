/**
 * An testing lexical grammar.
 */

module.exports = {
  "macros": {
    "id": "[a-zA-Z0-9_]",
  },

  "startConditions": {
    "comment": 1, // exclusive
  },

  "rules": [
    [["*"],       "\\s+", "/*skip whitespace*/"],

    [["*"],       "<<EOF>>", "return 'EOF'"],

    ["\\d+",      "return 'NUMBER'"],
    ["{id}+",     "return 'IDENTIFIER'"],
    ["\\(",       "return '('"],
    ["\\)",       "return ')'"],
    ["\\+",       "return '+'"],
    ["\\*",       "return '*'"],

    ["\\/\\*",    "this.pushState('comment');"],
    [["comment"], "\\*+\\/", "this.popState();"],
    [["comment"], "\\d+", "return 'NUMBER_IN_COMMENT'"],
    [["comment"], "{id}+", "return 'IDENTIFIER_IN_COMMENT'"],
  ],

  "options": {
    "case-insensitive": true,
  },
};