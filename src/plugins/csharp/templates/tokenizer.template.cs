/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 *
 * See `--custom-tokinzer` to skip this generation, and use a custom one.
 */

/* These should be inserted by yyparse already:

using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Reflection;

*/

namespace SyntaxParser
{
    // --------------------------------------------
    // Tokenizer.

    /**
     * Token class: encapsulates token type, and the matched value.
     */
    public class Token
    {
        // Basic data.
        public int Type;
        public string Value;

        // Location data.
        public int StartOffset;
        public int EndOffset;
        public int StartLine;
        public int EndLine;
        public int StartColumn;
        public int EndColumn;

        public Token(int type, string value) :
            // Special token with no location data (e.g. EOF).
            this(type, value, 0, 0, 0, 0, 0, 0) {}

        public Token(int type, string value, int startOffset,
                     int endOffset, int startLine, int endLine,
                     int startColumn, int endColumn)
        {
            Type = type;
            Value = value;

            StartOffset = startOffset;
            EndOffset = endOffset;
            StartLine = startLine;
            EndLine = endLine;
            StartColumn = startColumn;
            EndColumn = endColumn;
        }
    }

    /**
     * Regexp-based tokenizer. Applies lexical rules in order, until gets
     * a match; otherwise, throws the "Unexpected token" exception.
     *
     * Tokenizer should implement at least the following API:
     *
     * - getNextToken(): Token
     * - hasMoreTokens(): boolean
     * - isEOF(): boolean
     *
     * For state-based tokenizer, also:
     *
     * - getCurrentState(): number
     * - pushState(string stateName): void
     * - popState(): void
     * - begin(string stateName): void - alias for pushState
     */
    public class Tokenizer
    {
        /**
         * Original string.
         */
        private string mOriginalString;

        /**
         * Tokenizing string.
         */
        private string mString;

        /**
         * Maps a string name of a token type to its encoded number (the first
         * token number starts after all numbers for non-terminal).
         *
         * Example (assuming non-terminals reserved numbers 1-4, so token
         * numbers start from 5):
         *
         *  {"+",         5},
         *  {"*",         6},
         *  {"NUMBER",    7},
         *  {yyparse.EOF, 8},
         */
        private static Dictionary<string, int> mTokensMap = new Dictionary<string, int>()
        {{{TOKENS}}};

        private static Token EOF_TOKEN = new Token(
            mTokensMap[yyparse.EOF],
            yyparse.EOF
        );

        /**
         * Lex rules, and their handler names.
         *
         * Example:
         *
         * {
         *   new string[] {@"^\s+", "_lexRule1"},
         *   new string[] {@"^\d+", "_lexRule2"},
         * }
         *
         */
        private static string[][] mLexRules = {{{LEX_RULES}}};

        /**
         * Lex rules grouped by tokenizer state.
         *
         * Example:
         *
         * {
         *     { "INITIAL", new int[] { 0, 1, 2, 3 } },
         * }
         */
        private static Dictionary<string, int[]> mLexRulesByConditions = new Dictionary<string, int[]>()
        {{{LEX_RULES_BY_START_CONDITIONS}}};

        /**
         * Stack of lexer states.
         */
        private Stack<string> mStates = null;

        /**
         *  Cursor tracking current position.
         */
        private int mCursor = 0;

        /**
         * Line-based location tracking.
         */
        int mCurrentLine;
        int mCurrentColumn;
        int mCurrentLineBeginOffset;

        /**
         * Location data of a matched token.
         */
        int mTokenStartOffset;
        int mTokenEndOffset;
        int mTokenStartLine;
        int mTokenEndLine;
        int mTokenStartColumn;
        int mTokenEndColumn;

        /**
         * In case if a token handler returns multiple tokens from one rule,
         * we still return tokens one by one in the `getNextToken`, putting
         * other "fake" tokens into the queue. If there is still something in
         * this queue, it's just returned.
         */
        private Queue<string> mTokensQueue = null;

        /**
         * Lex rule handlers.
         *
         * Example:
         *
         * public string _lexRule1()
         * {
         *     // skip whitespace
         *     return null;
         * }
         *
         * public string _lexRule2()
         * {
         *     return "NUMBER";
         * }
         */
        {{{LEX_RULE_HANDLERS}}}

        // --------------------------------------------
        // Constructor.

        public Tokenizer()
        {
            //
        }

        public Tokenizer(string tokenizingString)
        {
            initString(tokenizingString);
        }

        public void initString(string tokenizingString)
        {
            mOriginalString = tokenizingString;
            mString = mOriginalString + yyparse.EOF;
            mCursor = 0;

            mStates = new Stack<string>();
            begin("INITIAL");

            mTokensQueue = new Queue<string>();

            // Init locations.

            mCurrentLine = 1;
            mCurrentColumn = 0;
            mCurrentLineBeginOffset = 0;

            // Token locationis.
            mTokenStartOffset = 0;
            mTokenEndOffset = 0;
            mTokenStartLine = 0;
            mTokenEndLine = 0;
            mTokenStartColumn = 0;
            mTokenEndColumn = 0;
        }

        // --------------------------------------------
        // States.

        public string getCurrentState()
        {
            return mStates.Peek();
        }

        public void pushState(string state)
        {
            mStates.Push(state);
        }

        public void begin(string state)
        {
            pushState(state);
        }

        public string popState()
        {
            if (mStates.Count > 1)
            {
                return mStates.Pop();
            }
            return getCurrentState();
        }

        // --------------------------------------------
        // Tokenizing.

        public Token getNextToken()
        {
            // Something was queued, return it.
            if (mTokensQueue.Count > 0)
            {
                return toToken(mTokensQueue.Dequeue(), "");
            }

            var str = mString.Substring(mCursor);
            var lexRulesForState = mLexRulesByConditions[getCurrentState()];

            for (int i = 0; i < lexRulesForState.Length; i++)
            {
                var lexRule = mLexRules[i];
                var matched = match(str, new Regex(lexRule[0]));
                if (matched != null)
                {
                    yyparse.yytext = matched;
                    yyparse.yyleng = matched.Length;

                    MethodInfo tokenHandler = GetType().GetMethod(lexRule[1]);
                    var tokenType = tokenHandler.Invoke(this, null);

                    if (tokenType == null)
                    {
                        return getNextToken();
                    }

                    Type tokenDataType = tokenType.GetType();

                    if (tokenType.GetType().IsArray)
                    {
                        var tokensArray = (string[])tokenType;
                        tokenType = (string)tokensArray[0];
                        if (tokensArray.Length > 1) {
                            for (var j = 1; j < tokensArray.Length; j++)
                            {
                                mTokensQueue.Enqueue(tokensArray[j]);
                            }
                        }
                    }

                    return toToken((string)tokenType, matched);
                }
            }

            if (!hasMoreTokens())
            {
                return EOF_TOKEN;
            }
            else if (isEOF())
            {
                mCursor++;
                return EOF_TOKEN;
            }

            throwUnexpectedToken(
                str[0].ToString(),
                mCurrentLine,
                mCurrentColumn
            );

            return null;
        }

        /**
         * Throws default "Unexpected token" exception, showing the actual
         * line from the source, pointing with the ^ marker to the bad token.
         * In addition, shows `line:column` location.
         */
        public void throwUnexpectedToken(string symbol, int line, int column)
        {
            var lineSource = mOriginalString.Split('\n')[line - 1];

            var pad = new String(' ', column);
            string lineData = "\n\n" + lineSource + "\n" + pad + "^\n";

            throw new SyntaxException(
                lineData + "Unexpected token: \"" + symbol +"\" " +
                "at " + line + ":" + column + "."
            );
        }

        private void captureLocation(string matched)
        {
            Regex nlRe = new Regex("\n");

            // Absolute offsets.
            mTokenStartOffset = mCursor;

            // Line-based locations, start.
            mTokenStartLine = mCurrentLine;
            mTokenStartColumn = mTokenStartOffset - mCurrentLineBeginOffset;

            // Extract `\n` in the matched token.
            foreach (Match nlMatch in nlRe.Matches(matched))
            {
                mCurrentLine++;
                mCurrentLineBeginOffset = mTokenStartOffset + nlMatch.Index + 1;
            }

            mTokenEndOffset = mCursor + matched.Length;

            // Line-based locations, end.
            mTokenEndLine = mCurrentLine;
            mTokenEndColumn = mCurrentColumn =
                (mTokenEndOffset - mCurrentLineBeginOffset);
        }

        private Token toToken(string tokenType, string yytext)
        {
            return new Token(
                mTokensMap[tokenType],
                yytext,
                mTokenStartOffset,
                mTokenEndOffset,
                mTokenStartLine,
                mTokenEndLine,
                mTokenStartColumn,
                mTokenEndColumn
            );
        }

        public bool hasMoreTokens()
        {
            return mCursor < mString.Length;
        }

        public bool isEOF()
        {
            return mString[mCursor] == yyparse.EOF[0] &&
                mCursor == mString.Length - 1;
        }

        private string match(string str, Regex re)
        {
            Match m = re.Match(str);
            string v = null;
            if (m.Success)
            {
                v = m.Groups[0].Value;
                captureLocation(v);
                mCursor += v.Length;
            }
            return v;
        }

        public string get()
        {
            return mString;
        }
    }
}