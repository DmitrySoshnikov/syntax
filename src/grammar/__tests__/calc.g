/**
 * An LR(1) grammar with precedence, and assocs, in JS format.
 */

{
  "lex": {
    "startConditions": {
      "comment": 1, // exclusive
    },

    "rules": [
      [["*"],  "\\s+", "/*skip whitespace*/"],
      ["\\d+", "return 'NUMBER'"],
      ["\\(",  "return '('"],
      ["\\)",  "return ')'"],
      ["\\+",  "return '+'"],
      ["\\*",  "return '*'"],

      ["\\/\\*", "this.pushState('comment');"],
      [["comment"], "\\*+\\/", "this.popState();"],
      [["comment"], "\\d+", "return 'NUMBER_IN_COMMENT'"],
    ],
  },

  "operators": [
    ["left", "+", "-"],
    ["left", "*", "/"],
  ],

  "bnf": {
    "E": [["E + E",  "$$ = $1 + $3"],
          ["E * E",  "$$ = $1 * $3"],
          ["E - E",  "$$ = $1 - $3"],
          ["E / E",  "$$ = $1 / $3"],
          ["NUMBER", "$$ = Number($1)"],
          ["( E )",  "$$ = $2"]],
  },

  "moduleInclude": `
    (() => "module include code")();
  `
}