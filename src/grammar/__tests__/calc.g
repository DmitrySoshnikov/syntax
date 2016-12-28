/**
 * An LR(1) grammar with precedence, and assocs, in JS format.
 */

{
  "lex": [
    ["\\d+", "return 'NUMBER'"],
    ["\\(", "return '('"],
    ["\\)", "return ')'"],
    ["\\+", "return '+'"],
    ["\\*", "return '*'"],
  ],

  "operators": [
    ["left", "+", "-"],
    ["left", "*", "/"],
  ],

  "bnf": {
    "E": [["E + E",  "$$ = $1 + $3"],
          ["E * E",  "$$ = $1 * $3"],
          ["E - E",  "$$ = $1 - $3"],
          ["E / E",  "$$ = $1 / $3"],
          ["NUMBER", "$$ = $1"],
          ["( E )",  "$$ = $2"]],
  },

  "moduleInclude": `
    (() => "module include code")();
  `
}