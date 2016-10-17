/**
 * Generated parser in PHP.
 *
 * ./bin/syntax -g examples/calc.php.g -m lalr1 -o CalcParser.php
 *
 * <?php
 *
 *   require('CalcParser.php');
 *
 *   var_dump(CalcParser::parse('2 + 2 * 2')); // int(6)
 */

{
  "lex": {
    "rules": [
      ["\\s+",  "/* skip whitespace */"],
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
      ["NUMBER", "$$ = intval($1)"],
      ["( E )",  "$$ = $1"],
    ],
  },
}