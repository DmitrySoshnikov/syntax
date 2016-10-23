/**
 * Start conditions of lex rules. Tokenizer states.
 *
 * Tokenizer rules may provide start conditions. Such rules are executed
 * only when lexer enters the state corresponding to the names of the
 * start conditions.
 *
 * Start conditions can be inclusive (%s, 0), and exclusive (%x, 1).
 * Inclusive conditions also include rules without any start conditions.
 * Exclusive conditions do not include other rules when the parser enter
 * this state. The rules with `*` condition are always included.
 *
 * https://gist.github.com/DmitrySoshnikov/f5e2583b37e8f758c789cea9dcdf238a
 *
 * When a grammar is defined in the JSON format, the start conditions are
 * specified as:
 *
 *   "startConditions": {
 *     "name": 1,  // exclusive
 *     "other": 0, // inclusive
 *   }
 *
 * And a rule itself may specify a list of start conditions as the
 * first element:
 *
 *   // This lex-rule is applied only when parser enters `name` state.
 *
 *   [["name"], "\w+", "return 'NAME'"]
 *
 * At the beginning a lexer is in the `INITIAL` state. A new state is
 * entered either using `this.pushState(name)` or `this.begin(name)`. To
 * exit a state, use `this.popState()`.
 *
 * In the grammar below we has `comment` tokenizer state, which allows us
 * to skip all the comment characters, but still to count number of lines.
 *
 *   ./bin/syntax -g examples/lexer-start-conditions.g -m slr1 -f ~/test.js
 */

// Example of ~/test.js
//
//  1.
//  2.  /* Hello world
//  3.      privet
//  4.
//  5.     OK **/
//  6.
//  7.  Main
//  8.
//
// Number of lines: 8

{
  "moduleInclude": `
    let lines = 1;

    yyparse.onParseBegin = (string) => {
      // Print the string with line numbers.

      let code = string
        .split('\\n')
        .map((s, line) => (line + 1) + '. ' + s)
        .join('\\n');

      console.log(code + '\\n');
    };

    yyparse.onParseEnd = () => {
      console.log('Number of lines: ' + lines + '\\n');
    };
  `,

  "lex": {
    "startConditions": {
      "comment": 1, // exclusive
    },

    "rules": [

      // On `/*` we enter the comment state:

      ["\\/\\*", "this.pushState('comment');      /* skip comments */"],

      // On `*/` being in `comment` state we return to the initial state:

      [["comment"], "\\*+\\/", "this.popState();  /* skip comments */"],

      // Being inside the `comment` state, skip all chars, except new lines
      // which we count.

      [["comment"], "[^*\\n]*",                  "/* skip comments */"],
      [["comment"], "\\*+[^*/\\n]*",             "/* skip comments */"],

      // Count lines in comments.
      [["comment"], "\\n",  "lines++;             /* skip new lines in comments */"],

      // In INITIAL state, count line numbers as well:
      ["\\n",               "lines++              /* skip new lines */"],

      [["*"], " +",                              "/* skip spaces in any state */"],

      // Main program consisting only of one word "Main"
      ["Main", "return 'MAIN'"],
    ],
  },

  "bnf": {
    "Program": ["MAIN"],
  }
}