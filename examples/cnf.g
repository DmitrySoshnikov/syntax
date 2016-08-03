/**
 * Conjunctive normal form parser.
 *
 * https://en.wikipedia.org/wiki/Conjunctive_normal_form
 *
 * ./bin/syntax -g examples/cnf.g -m slr1 -p '(A v B v ¬ C) ^ (D v E)'
 *

 *   Parsing mode: SLR(1).
 *
 *   Parsing: (A v B v ¬ C) ^ (D v E)
 *
 *   ✓ Accepted
 *
 *   Parsed value:
 *
 *   {
 *       "type": "Conjunction",
 *       "disjunctions": [
 *           {
 *               "type": "Disjunction",
 *               "variables": [
 *                   {
 *                       "type": "Variable",
 *                       "value": "A"
 *                   },
 *                   {
 *                       "type": "Variable",
 *                       "value": "B"
 *                   },
 *                   {
 *                       "type": "Negation",
 *                       "variable": {
 *                           "type": "Variable",
 *                           "value": "C"
 *                       }
 *                   }
 *               ]
 *           },
 *           {
 *               "type": "Disjunction",
 *               "variables": [
 *                   {
 *                       "type": "Variable",
 *                       "value": "D"
 *                   },
 *                   {
 *                       "type": "Variable",
 *                       "value": "E"
 *                   }
 *               ]
 *           }
 *       ]
 *   }
 *
 * To generate a parser:
 *
 * ./bin/syntax -g examples/cnf.g -m slr1 -o cnf-parser.js
 *
 * In Node:
 *
 * require('cnf-parser.js').parse('(A v B v ¬ C) ^ (D v E)');
 *
 */

{
  "lex": {
    "rules": [
      ["\\s+",                                 "/* skip whitespace */"],
      ["v",                                    "return 'OR';"],
      ["\\^",                                  "return 'AND';"],
      ["¬",                                    "return 'NOT';"],
      ["[a-zA-Z]*",                            "return 'ID';"],
      ["\\(",                                  "return 'LPAREN';"],
      ["\\)",                                  "return 'RPAREN';"],
    ]
  },

  "bnf": {
    "Conjunction":  [["Conjunction AND Disjunction",    "$$ = {type: 'Conjunction', disjunctions: [].concat($1, $3)};"],
                     ["Disjunction",                    "$$ = $1;"]],

     "Disjunction": [["LPAREN Clauses RPAREN",          "$$ = {type: 'Disjunction', variables: $2};"]],

     "Clauses":     [["Clauses OR Var",                 "$$ = [].concat($1, $3);"],
                     ["Var",                            "$$ = [$1];"]],

     "Var":         [["ID",                             "$$ = {type: 'Variable', value: $1};"],
                     ["NOT Var",                        "$$ = {type: 'Negation', variable: $2};"]]
  }
}