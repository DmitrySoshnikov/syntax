/**
 * Generated parser in C#.
 *
 * ./bin/syntax -g examples/calc.cs.g -m lalr1 -o CalcParser.cs
 *
 * using SyntaxParser;
 *
 * var parser = new CalcParser();
 *
 * Console.WriteLine(parser.parse("2 + 2 * 2"));   // 6
 * Console.WriteLine(parser.parse("(2 + 2) * 2")); // 8
 */

{
  "lex": {
    "rules": [
      ["\\s+",  '/* skip whitespace */ return null'],
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
      ["NUMBER", "$$ = Convert.ToInt32($1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}