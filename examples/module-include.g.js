/**
 * Module includes.
 *
 * The "moduleInclude" directive allows including an arbitrary code at the
 * beginning of the generated parser file. As an example, can be the code
 * to require modules for corresponding AST nodes, or direct AST nodes
 * definitions.
 *
 * The "onParseBegin", and "onParseEnd" hooks are executed accordingly, when
 * parsing starts (receiving parsing string as an argument), and ends
 * (receiving a parsed value).
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
  `,

  "onParseBegin": `
    console.log('Custom hook executed on parse begin. Parsing:', $1, '\\n');
  `,

  "onParseEnd": `
    console.log('Custom hook executed on parse end. Parsed:\\n\\n', $1, '\\n');
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