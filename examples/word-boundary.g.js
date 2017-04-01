/**
 * Word boundary example: `if` keyword vs. `ifi` identifier.
 *
 * ./bin/syntax -g examples/word-boundary.g.js -m lalr1 -p 'if'
 *   > id-keyword
 *
 * ./bin/syntax -g examples/word-boundary.g.js -m lalr1 -p 'ifi'
 *   > identifier
 */

{
  lex: {
    rules: [
      ["if\\b", "return 'IF'"],
      ["\\w+",  "return 'ID'"]
    ]
  },

  "bnf": {
    "Program": [["IF", " $$ = 'if-keyword' "],
                ["ID", " $$ = 'identifier' "]],
  }
}
