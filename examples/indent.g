/**
 * Handling nested blocks based on indentation (similar to Python).
 *
 * In this example we handle nested lists based on indentation (YAML-style):
 *
 * Example `~/test.list`:
 *
 *   - one
 *   - two
 *     - three
 *     - four
 *       - five
 *       - six
 *     - seven
 *     - eight
 *   - nine
 *   - ten
 *
 * Handling blocks based on indentation doesn't differ much from handling blocks
 * based on { } or []. In this case we have a recursive `List` production, which
 * consists of Entry items, separated by the `SEPARATOR` token.
 *
 * The `SEPARATOR` handles indentation (indent/dedent), tracking current level
 * of indentation, and current nested list where entries are added.
 *
 *   ./bin/syntax -g ~/indent.g -m slr1 -f ~/test.list
 *
 * Parsed value:
 *
 *   [
 *     "one",
 *     "two",
 *     [
 *       "three",
 *       "four",
 *       [
 *         "five",
 *         "six"
 *       ],
 *       "seven",
 *       "eight"
 *     ],
 *     "nine",
 *     "ten"
 *   ]
 *
 * See also `examples/indent-explicit.g.js` for explicit INDENT, and DEDENT
 * tokens handling.
 */

{
  lex: {
    rules: [
      [`[a-zA-Z0-9_]+`,    `return 'IDENTIFIER'`],

      // ------------------------------------------------
      // Indent/Dedent.

      [`\\n( *)`,  `

        yytext = yytext.slice(1); // strip leading NL
        matchedIndent = yytext.length;

        return 'SEPARATOR';
      `],

      [`\\s+`,    `/* skip whitespace */`],
      [`\\-`,     `return '-'`],
    ],
  },

  moduleInclude: `

    /**
     * Matched during tokenization indentation level
     * (step ahead from the "currentIndent").
     */
    let matchedIndent = 0;

    /**
     * Current level of indentation.
     */
    let currentIndent = 0;

    /**
     * Current list where we add entries.
     */
    let currentList = [];

    /**
     * Keeps track of the indentation levels to check
     * correct level on dedent.
     */
    const indentStack = [];
    indentStack.push(currentIndent);

    /**
     * Same as "indentStack" but to track nested lists.
     */
    const listsStack = [];
    listsStack.push(currentList);
  `,

  bnf: {
    Program: [[`List`,                  `$$ = currentList`]],

    List:    [[`Entry`,                 `currentList.push($1)`],
              [`List SEPARATOR Entry`,  `

        // 1. We're on the same nested level, just push the entry
        // to the current list.

        if (currentIndent === matchedIndent) {
          currentList.push($3);
        }

        // 2. Dedent. Pop the current list from the stack, pushing
        // as a child to the previous.

        else if (currentIndent > matchedIndent) {
          currentList.push($3);

          const poppsedList = listsStack.pop();
          currentList = listsStack[listsStack.length - 1];
          currentList.push(poppsedList);

          indentStack.pop();
          currentIndent = indentStack[indentStack.length - 1];
        }

        // 3. Indent. Allocate a new list for entries and push
        // onto the stack.

        else {
          currentList.push($3);

          currentIndent = matchedIndent;
          currentList = [];

          listsStack.push(currentList);
          indentStack.push(currentIndent);
        }

    `]],

    Entry:   [[`- IDENTIFIER`,  `$$ = $2`]],
  },
}