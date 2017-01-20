/**
 * Lang: Lexical Grammar.
 *
 * BNF grammar is in: examples/lang.bnf
 * Test source code is in: examples/test.lang
 *
 * How to run:
 *
 *   ./bin/syntax \
 *     --grammar examples/lang.bnf \
 *     --lex examples/lang.lex \
 *     --mode lalr1 \
 *     --default-actions \
 *     --file examples/test.lang
 */
{
  macros: {
    id: `[a-zA-Z0-9_]`,
  },

  rules: [
    ["\\/\\/.*",                `/* skip comments */`],
    ["\/\\*(.|\\s)*?\\*\/",     `/* skip comments */`],

    [`\\s+`,                    `/* skip whitespace */`],

    // ------------------------------------------------
    // Keywords.

    [`let`,                     `return 'LET'`],
    [`if`,                      `return 'IF'`],
    [`else`,                    `return 'ELSE'`],
    [`true`,                    `return 'TRUE'`],
    [`false`,                   `return 'FALSE'`],
    [`null`,                    `return 'NULL'`],
    [`return`,                  `return 'RETURN'`],
    [`fn`,                      `return 'FN'`],
    [`do`,                      `return 'DO'`],
    [`while`,                   `return 'WHILE'`],

    [`\\->`,                    `return 'ARROW'`],

    [`\\(`,                     `return 'LPAREN'`],
    [`\\)`,                     `return 'RPAREN'`],

    [`\\{`,                     `return 'LCURLY'`],
    [`\\}`,                     `return 'RCURLY'`],

    [`;`,                       `return 'SEMICOLON'`],
    [`,`,                       `return 'COMMA'`],

    // ------------------------------------------------
    // Logical operators: &&, ||

    [`\\|\\|`,                  `return 'LOGICAL_OR'`],
    [`&&`,                      `return 'LOGICAL_AND'`],

    // ------------------------------------------------
    // Assignment operators: =, *=, /=, +=, -=,

    [`=`,                       `return 'SIMPLE_ASSIGN'`],
    [`(\\*|\\/|\\+|\\-)=`,      `return 'COMPLEX_ASSIGN'`],

    // ------------------------------------------------
    // Numbers.

    [`\\d+`,                    `return 'NUMBER'`],

    // ------------------------------------------------
    // Equality operators: ==, !=

    [`(=|!)=`,                  `return 'EQUALITY_OPERATOR'`],

    // ------------------------------------------------
    // Math operators: +, -, *, /

    [`(\\+|\\-)`,               `return 'ADDITIVE_OPERATOR'`],
    [`(\\*|\\/)`,               `return 'MULTIPLICATIVE_OPERATOR'`],

    // ------------------------------------------------
    // Relational operators: >, >=, <, <=

    [`(>|<)=?`,                 `return 'RELATIONAL_OPERATOR'`],

    // ------------------------------------------------
    // Strings.

    [`"[^"]*"`,                 `yytext = yytext.slice(1, -1); return 'STRING';`],
    [`'[^']*'`,                 `yytext = yytext.slice(1, -1); return 'CHAR';`],

    [`{id}+`,                   `return 'IDENTIFIER'`],
  ],
}