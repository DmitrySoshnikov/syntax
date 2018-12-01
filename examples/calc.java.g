/**
 * Generated parser in Rust.
 *
 * ./bin/syntax -g examples/calc.java.g -m lalr1 -o CalcParser.rs
 *
 * import com.syntax.*;
 *
 * CalcParser parser = new CalcParser();
 *
 * System.out.println(parser.parse("2 + 2 * 2");   // 6
 * System.out.println(parser.parse("(2 + 2) * 2"); // 8
 */

{
  "lex": {
    "rules": [
      ["\\s+",  '/* skip whitespace */ ""'],
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

  "moduleInclude": `

    /**
     * The ParserEvents class allows subscribing to
     * different parsing events.
     */
    class ParserEvents {
      public static void init() {
        System.out.println("Parser is created.");
      }

      public static void onParseBegin(String str) {
        System.out.println("Parsing is started: " + str);
      }

      public static void onParseEnd(Object _result) {
        System.out.println("Parsing is completed: " + (String)_result);
      }
    }

  `,

  "bnf": {
    "E": [
      ["E + E",  "$$ = (Integer)$1 + (Integer)$3"],
      ["E * E",  "$$ = (Integer)$1 * (Integer)$3"],
      ["NUMBER", "$$ = Integer.valueOf(yytext)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}