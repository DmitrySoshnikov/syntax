/**
 * Handling nested blocks based on indentation (similar to Python).
 *
 * Handling blocks based on indentation doesn't differ much from handling blocks
 * based on { } or [].
 *
 * We have 3 use-cases:
 *
 *   1. `:\n( *)` - block begin, INDENT token
 *   2. `\n( *)` if indent level is the same - stay in the same block, NL token
 *   3. `\n( *)` if indent level decreased - DEDENT token
 *
 * Example `~/test.lang`:
 *
 * - entry1:             # INDENT
 *   - entry11           # NL
 *   - entry12           # NL
 *   - entry13:          # INDENT
 *     - entry131        # NL
 *     - entry131        # NL
 *     - entry133:       # INDENT
 *       - entry1331     # NL
 *       - entry1332     # DEDENT, DEDENT, NL
 * - entry2
 *
 * As you can see, an "entry" may have an (optional) list of child items.
 *
 * We maintain initial and current level of indentations, yielding several
 * `DEDENT` tokens if the indentation switches from a lower level to
 * several levels up.
 *
 * The parsed value for the example:
 *
 *   [
 *    {
 *      "name": "entry1",
 *      "items": [
 *        {
 *          "name": "entry11",
 *          "items": null
 *        },
 *        {
 *          "name": "entry12",
 *          "items": null
 *        },
 *        {
 *          "name": "entry13",
 *          "items": [
 *            {
 *              "name": "entry131",
 *              "items": null
 *            },
 *            {
 *              "name": "entry131",
 *              "items": null
 *            },
 *            {
 *              "name": "entry133",
 *              "items": [
 *                {
 *                  "name": "entry1331",
 *                  "items": null
 *                },
 *                {
 *                  "name": "entry1332",
 *                  "items": null
 *                }
 *              ]
 *            }
 *          ]
 *        }
 *      ]
 *    },
 *    {
 *      "name": "entry2",
 *      "items": null
 *    }
 *  ]
 *
 * See also `examples/indent.g` for generic indentation as a separator for
 * nested list entries.
 */

{
  lex: {
    rules: [

      [`[a-zA-Z0-9_]+`,    `return 'IDENTIFIER'`],


      // ------------------------------------------------
      // Indent

      [`:\\n( *)`,  `

        yytext = yytext.slice(2); // strip leading : and NL
        const matchedIndent = yytext.length;

        // On new block creation, we expect indent level to go up:

        if (matchedIndent < currentIndent) {
          throw new Error(
            'Bad indent: got ' + matchedIndent +
            ', expected > ' + currentIndent
          );
        }

        // Init the indent level. All the following indentations
        // should be relative to it.

        if (!indentLevel) {
          indentLevel = matchedIndent;
        }

        currentIndent = matchedIndent;
        return 'INDENT';
      `],

      // ------------------------------------------------
      // Dedent/NL

      [`\\n( *)`,  `
        yytext = yytext.slice(1); // strip leading NL
        const matchedIndent = yytext.length;

        // 1. Stay in the same block, skip NL.

        if (matchedIndent === currentIndent) {
          return 'NL';
        }

        // 2. Else it should be a dedent, or a bad indent.

        if (matchedIndent < currentIndent) {

          // If we dedent on several levels, we return several
          // dedent tokens, plus 'NL' token. So dedenting from level 3
          // to level 1, may look like: ['DEDENT', 'DEDENT', 'NL']

          const dedentTokensCount = (currentIndent - matchedIndent) / indentLevel;
          const tokens = new Array(dedentTokensCount).fill('DEDENT');

          // The "fake" NL token is to make BNF grammar simpler.
          tokens.push('NL');

          currentIndent = matchedIndent;
          return tokens;
        }

        throw new Error(
          'Blocks should start with ":", ' +
          'cannot increase indent not in block'
        );
      `],

      [`\\-`,     `return '-'`],
      [`\\s+`,    `/* skip whitespace */`],
    ],
  },

  moduleInclude: `
    /**
     * Indentation level. On first indent, we determine what indentation
     * level the program will use, and then check current indentation
     * to be relative to it.
     */
    let indentLevel = null;

    /**
     * Current level of indentation.
     */
    let currentIndent = 0;
  `,

  bnf: {
    /**
     * List of entries, where each entry is separated by a new line.
     */
    Entries: [[`Entry`,                  `$$ = [$1]`],
              [`Entries NL Entry`,       `$$ = $1; $1.push($3)`]],

    /**
     * An entry is an identifier, which may have an optional block
     * of child entries/items.
     */
    Entry:   [[`- IDENTIFIER OptBlock`,  `$$ = {name: $2, items: $3}`]],

    OptBlock: [[`INDENT Entries DEDENT`, `$$ = $2`],
               [`ε`,                     `$$ = null`]],
  }
}