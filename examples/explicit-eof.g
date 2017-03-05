/**
 * Explicit <<EOF>> handling.
 *
 * By default Syntax handles end of file with special EOF token, which is
 *
 *   {type: '$', value: ''}
 *
 * However, a grammar may want to handle EOF explicitly in case it uses
 * EOF explicitly in some rules. In this case a lexical rule should match
 * special `<<EOF>>` regexp, which corresponds to the empty string
 * at the end of the parsing string, i.e. `/^$/`. The type of the token
 * can be returned any in this case.
 *
 * ./bin/syntax -g examples/explicit-eof.g -m slr1 -p '10'
 */

{
  lex: {
    rules: [
      [`\\d+`,            `return "NUMBER"`],
      [`<<EOF>>`,         `return "EOF"`],
    ],
  },

  bnf: {
    // The whole string consists only of one number (followed by EOF).
    Main: [[`NUMBER EOF`,  `$$ = $1`]],
  },
}