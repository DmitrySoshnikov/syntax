/**
 * Case-insensitive lexical rules.
 *
 * Examples (accepted):
 *
 *   ./bin/syntax -g examples/case-insensitive-lex.g -m slr1 -p 'x'
 *   ./bin/syntax -g examples/case-insensitive-lex.g -m slr1 -p 'X'
 *   ./bin/syntax -g examples/case-insensitive-lex.g -m slr1 -p 'y'
 *
 *   ✓ Accepted
 *
 *
 * Example (fail, "Y" is not case-insensitive):
 *
 *   ./bin/syntax -g examples/case-insensitive-lex.g -m slr1 -p 'Y'
 *
 *   Rejected: Unexpected token: "Y" at 1:0.
 */
{
  "lex": {
    "rules": [

      // This rule is by default case-insensitive:

      [`x`, `return "X"`],

      // This rule overrides global options:

      [`y`, `return "Y"`, {"case-insensitive": false}],
    ],

    // Global options for the whole lexical grammar.

    "options": {
      "case-insensitive": true,
    }
  },

  "bnf": {
    "E": ["X", "Y"],
  }
}