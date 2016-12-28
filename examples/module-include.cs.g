/**
 * Module includes. C# version.
 *
 * The "moduleInclude" directive allows including an arbitrary code at the
 * beginning of the generated parser file. As an example, can be the code
 * to require modules for corresponding AST nodes, or direct AST nodes
 * definitions.
 *
 * The code may define callbacks for several parse events, in particular
 * `onParseBegin`, and `onParseEnd`, attaching to `yyparse`:
 *
 *   yyparse.onParseBegin = (string code) =>
 *   {
 *     Console.WriteLine("Parsing: " + code);
 *   };
 *
 * ./bin/syntax -g ./examples/module-include.cs.g -m slr1 -o './CalcParser.cs'
 *
 * using SyntaxParser;
 *
 * var parser = new CalcParser();
 *
 * Console.WriteLine(parser.parse("2 + 2 * 2"));
 *
 * > Custom hook on parse begin. Parsing: 2 + 2 * 2
 * > Custom hook on parse end. Parsed: SyntaxParser.BinaryExpression
 * > SyntaxParser.BinaryExpression
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

  "moduleInclude": `
    // Can be "using" statments, or direct declarations.

    namespace SyntaxParser
    {

        public class Node
        {
          public string Type;

          public Node(string type)
          {
              Type = type;
          }
        }

        public class BinaryExpression : Node
        {
            public object Left;
            public object Right;
            public string Op;

            public BinaryExpression(object left, object right, string op): base("Binary")
            {
                Left = left;
                Right = right;
                Op = op;
            }
        }

        public class PrimaryExpression : Node
        {
            public int Value;

            public PrimaryExpression(string value) : base("Primary")
            {
                Value = Convert.ToInt32(value);
            }
        }

        // Setup of the parser hooks is done via Init.run();
        public class Init
        {
            public static void run()
            {
                // Standard hook on parse beging, and end:

                yyparse.onParseBegin = (string code) =>
                {
                  Console.WriteLine("Custom hook on parse begin. Parsing: " + code);
                };

                yyparse.onParseEnd = (object parsed) =>
                {
                  Console.WriteLine("Custom hook on parse end. Parsed: " + parsed);
                };
            }
        }
    }
  `,

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = new BinaryExpression($1, $3, $2)"],
      ["E * E",  "$$ = new BinaryExpression($1, $3, $2)"],
      ["NUMBER", "$$ = new PrimaryExpression($1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}