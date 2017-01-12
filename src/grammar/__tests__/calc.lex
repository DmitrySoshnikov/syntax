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
    ["{id}+",     "return 'IDENTIFIER'"],
    ["\\d+",      "return 'NUMBER'"],
    ["\\(",       "return '('"],
    ["\\)",       "return ')'"],
    ["\\+",       "return '+'"],
    ["\\*",       "return '*'"],

    ["\\/\\*",    "this.pushState('comment');"],
    [["comment"], "\\*+\\/", "this.popState();"],
    [["comment"], "\\d+", "return 'NUMBER_IN_COMMENT'"],
  ],
};