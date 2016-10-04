/**
 * Module includes.
 *
 * The "moduleInclude" directive allows including an arbitrary code at the
 * beginning of the generated parser file. As an example, can be the code
 * to require modules for corresponding AST nodes, or direct AST nodes
 * definitions.
 *
 * The code may define callbacks for several parse events, attaching them
 * to the `yyparse` object. For example:
 *
 *   yyparse.onParseBegin = (string) => {
 *     console.log('Parsing:', string);
 *   };
 *
 * ./bin/syntax -g ./examples/module-include.g.js -m slr1 -o './parser.js'
 *
 * > require('./parser').parse('2 + 2 * 2');
 *
 * BinaryExpression {
 *   type: 'Binary',
 *   left:  PrimaryExpression { type: 'Primary', value: '2' },
 *   right: BinaryExpression {
 *     type: 'Binary',
 *     left:  PrimaryExpression { type: 'Primary', value: '2' },
 *     right: PrimaryExpression { type: 'Primary', value: '2' },
 *     op: '*',
 *   },
 *   op: '+',
 * }
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

  "moduleInclude": `
    // Can be "require" statments, or direct declarations.

    class Node {
      constructor(type) {
        this.type = type;
      }
    }

    class BinaryExpression extends Node {
      constructor(left, right, op) {
        super('Binary');
        this.left = left;
        this.right = right;
        this.op = op;
      }
    }

    class PrimaryExpression extends Node {
      constructor(value) {
        super('Primary');
        this.value = value;
      }
    }

    yyparse.onParseBegin = (string) => {
      console.log('Custom hook on parse begin. Parsing:', string, '\\n');
    };

    yyparse.onParseEnd = (value) => {
      console.log('Custom hook on parse end. Parsed:\\n\\n', value, '\\n');
    };

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
      ["( E )",  "$$ = $1"],
    ],
  },
}