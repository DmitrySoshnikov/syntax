/**
 * Generated parser in Example language (actual JS, used in plugins example).
 *
 * ./bin/syntax -g examples/calc.example.g -m lalr1 -o CalcParser.example
 *
 * const CalcParser = require('CalcParser.example');
 *
 * const parser = new CalcParser();
 * console.log(parser.parse("2 + 2 * 2")); // 6
 */

{
  "lex": {
    "rules": [
      ["\\s+",  '/* skip whitespace */'],
      ["\\d+",  'return "NUMBER"'],
      ["\\*",   'return "*"'],
      ["\\+",   'return "+"'],
      ["\\(",   'return "("'],
      ["\\)",   'return ")"'],
    ]
  },

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = $1 + $3"],
      ["E * E",  "$$ = $1 * $3"],
      ["NUMBER", "$$ = Number($1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}