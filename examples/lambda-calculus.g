/**
 *
 *
 * ./bin/syntax -g examples/lambda-calculus.g -m slr1 -p '(λx. x) (λy. y)'
 *
 *   Parsing mode: SLR(1).
 *
 *   Parsing: (λx. x) (λy. y)
 *
 *   ✓ Accepted
 *
 *   Parsed value: { type: 'Application',
 *     lhs:
 *      { type: 'Abstraction',
 *        param: { type: 'Identifier', value: 'x' },
 *        body: { type: 'Identifier', value: 'x' } },
 *     rhs:
 *      { type: 'Abstraction',
 *        param: { type: 'Identifier', value: 'y' },
 *        body: { type: 'Identifier', value: 'y' } } }
 *
 *
 * To generate a parser:
 *
 * ./bin/syntax -g examples/lambda-calculus.g -m slr1 -o lc-parser.js
 *
 * In Node:
 *
 * require('lc-parser.js').parse('(λx. x) (λy. y)');
 *
 */

{
  "lex": {
    "rules": [
      ["\\s+",                                 "/* skip whitespace */"],
      ["\\.",                                  "return 'DOT';"],
      ["[a-z][a-zA-Z]*",                       "return 'LCID';"],
      ["λ",                                    "return 'LAMBDA';"],
      ["\\(",                                  "return 'LPAREN';"],
      ["\\)",                                  "return 'RPAREN';"],
    ]
  },

  "bnf": {
    "Term":         [["Application",           "$$ = $1;"],
                     ["LAMBDA Lcid DOT Term",  "$$ = {type: 'Abstraction', param: $2, body: $4};"]],

     "Application": [["Application Atom",      "$$ = {type: 'Application', lhs: $1, rhs: $2};"],
                     ["Atom", "$$ = $1;"]],

     "Atom":        [["LPAREN Term RPAREN",    "$$ = $2;"],
                     ["Lcid",                  "$$ = $1;"]],

     "Lcid":        [["LCID",                  "$$ = {type: 'Identifier', value: $1};"]]
  }
}