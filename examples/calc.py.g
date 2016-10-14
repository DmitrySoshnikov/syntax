/**
 * Generated parser in python.
 *
 * ./bin/syntax -g examples/calc.py.g -m lalr1 -o 'calcparser.py'
 *
 * >>> import calcparser
 * >>> calcparser.parse('2 + 2 * 2')
 * >>> 6
 */

{
  "lex": {
    "rules": [
      ["\\s+",  ""],
      ["\\d+",  "return 'NUMBER'"],
      ["\\*",   "return '*'"],
      ["\\+",   "return '+'"],
      ["\\(",   "return '('"],
      ["\\)",   "return ')'"],
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
      ["NUMBER", "$$ = int($1)"],
      ["( E )",  "$$ = $1"],
    ],
  },
}