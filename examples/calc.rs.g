/**
 * Generated parser in Rust.
 *
 * ./bin/syntax -g examples/calc.rs.g -m lalr1 -o lib.rs
 *
 * use syntax::Parser;
 *
 * let parser = Parser::new();
 *
 * println!("{:?}", parser.parse("2 + 2 * 2"));   // 6
 * println!("{:?}", parser.parse("(2 + 2) * 2")); // 8
 */

{
  "lex": {
    "rules": [
      ["\\s+",  '/* skip whitespace */ ""'],
      ["\\d+",  '"NUMBER"'],
      ["\\*",   '"*"'],
      ["\\+",   '"+"'],
      ["\\(",   '"("'],
      ["\\)",   '")"'],
    ]
  },

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "moduleInclude": `

      type TResult = i32;

      fn on_parse_begin(parser: &mut Parser, string: &'static str) {
          println!("on_parse_begin: {:?}", string);
      }

      fn on_parse_end(parser: &mut Parser, parsed: TResult) {
          println!("on_parse_end: {:?}", parsed);
      }

  `,

  "bnf": {
    "E": [
      ["E + E",  "|$1: i32, $3: i32, $2:Token| -> i32; $$ = $1 + $3"],
      ["E * E",  "|$1: i32, $3: i32| -> i32; $$ = $1 * $3"],
      ["NUMBER", "|| -> i32; $$ = yytext.parse::<i32>().unwrap()"],
      ["( E )",  "$$ = $2"],
    ],
  },
}