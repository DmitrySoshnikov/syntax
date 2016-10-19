/**
 * Generated parser in Ruby.
 *
 * ./bin/syntax -g examples/calc.rb.g -m lalr1 -o CalcParser.rb
 *
 *   require('CalcParser.rb')
 *
 *   puts CalcParser.parse('2 + 2 * 2') # 6
 */

{
  "lex": {
    "rules": [
      ["\\s+",  "# skip whitespace"],
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
      ["NUMBER", "$$ = $1.to_i"],
      ["( E )",  "$$ = $2"],
    ],
  },
}