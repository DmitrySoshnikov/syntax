/**
 * Generated parser in Julia language
 *
 * ./bin/syntax -g examples/calc.jl.g -m lalr1 -o CalcParser.jl
 *
 */

{
  "lex": {
    "rules": [
      ["\\s+",  '# skip whitespace'],
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
      ["NUMBER", "$$ = tryparse(Int, $1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}