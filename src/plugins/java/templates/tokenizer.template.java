/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 */

/* These should be inserted by Yyparse already:

package com.syntax;

import java.lang.reflect.Method;
import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Stack;
import java.text.ParseException;

*/

// --------------------------------------------
// Tokenizer.

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
 * - pushState(String stateName): void
 * - popState(): void
 * - begin(String stateName): void - alias for pushState
 */
public class Tokenizer {

  /**
   * Token class: encapsulates token type, and the matched value.
   */
  public static class Token {
    // Basic data.
    public int type;
    public String value;

    // Location data.
    public int startOffset;
    public int endOffset;
    public int startLine;
    public int endLine;
    public int startColumn;
    public int endColumn;

    public Token(int type, String value) {
      // Special token with no location data (e.g. EOF).
      this(type, value, 0, 0, 0, 0, 0, 0);
    }

    public Token(int type, String value, int startOffset,
           int endOffset, int startLine, int endLine,
           int startColumn, int endColumn)
    {
      this.type = type;
      this.value = value;

      this.startOffset = startOffset;
      this.endOffset = endOffset;
      this.startLine = startLine;
      this.endLine = endLine;
      this.startColumn = startColumn;
      this.endColumn = endColumn;
    }

    public String toString() {
      return "{type: " + type + ", value: " + value + "}";
    }
  }

  /**
   * Tokenizing String.
   */
  private String mString;

  /**
   * Matched text.
   */
  public static String yytext = null;

  /**
   * Matched text length.
   */
  public static int yyleng = 0;

  /**
   * EOF.
   */
  public static String EOF = "$";

  /**
   * Maps a String name of a token type to its encoded number (the first
   * token number starts after all numbers for non-terminal).
   *
   * Example:
   *
   *   {{
   *     put("+", 1);
   *     put("*", 2);
   *     put("NUMBER", 3);
   *     put("(", 4);
   *     put(")", 5);
   *     put("$", 6);
   *  }};
   */
  private static final Map<String, Integer> mTokensMap = new HashMap<String, Integer>()
  {{
    {{{TOKENS}}}
  }};

  /**
   * EOF Token.
   */
  public static Token EOF_TOKEN = new Token(
    mTokensMap.get(Tokenizer.EOF),
    Tokenizer.EOF
  );

  /**
   * Lex patterns:
   *
   * Example:
   *
   *   Pattern.compile("^\\s+"),
   *   Pattern.compile("^\\d+"),
   *   Pattern.compile("^\\*"),
   *   Pattern.compile("^\\+"),
   *   Pattern.compile("^\\("),
   *   Pattern.compile("^\\)"),
   */
  private static final Pattern[] mLexPatterns = {
    {{{LEX_RULES}}}
  };

  /**
   * Handler methods for patterns.
   *
   * Example:
   *
   *   "_lexRule1",
   *   "_lexRule2",
   *   ...
   */
  private static final String[] mLexHandlers = {
    {{{LEX_RULES}}}
  };

  private static final Pattern NL_RE = Pattern.compile("\\n");

  /**
   * Lex rules grouped by tokenizer state.
   *
   * Example:
   *
   *   put("INITIAL", new Integer[] {0, 1, 2, 3, 4, 5});
   */
  private static Map<String, Integer[]> mLexRulesByConditions = new HashMap<String, Integer[]>()
  {{
    {{{LEX_RULES_BY_START_CONDITIONS}}};
  }};

  /**
   * Stack of lexer states.
   */
  private Stack<String> mStates = null;

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
  private Queue<String> mTokensQueue = null;

  /**
   * Lex rule handlers.
   *
   * Example:
   *
   *   public String _lexRule1() {
   *     // Skip whitespace.
   *     return null;
   *   }
   *
   *   public String _lexRule2() {
   *     return "NUMBER";
   *   }
   */
  {{{LEX_RULE_HANDLERS}}}

  // --------------------------------------------
  // Constructor.

  public Tokenizer() {
    //
  }

  public Tokenizer(String tokenizingString) {
    initString(tokenizingString);
  }

  public void initString(String tokenizingString) {
    mString = tokenizingString;
    mCursor = 0;

    mStates = new Stack<String>();
    begin("INITIAL");

    mTokensQueue = new LinkedList<String>();

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

  public String getCurrentState() {
    return mStates.peek();
  }

  public void pushState(String state) {
    mStates.push(state);
  }

  public void begin(String state) {
    pushState(state);
  }

  public String popState() {
    if (mStates.size() > 1) {
      return mStates.pop();
    }
    return getCurrentState();
  }

  // --------------------------------------------
  // Tokenizing.

  public Token getNextToken() throws ParseException {
    // Something was queued, return it.
    if (mTokensQueue.size() > 0) {
      return toToken(mTokensQueue.remove(), "");
    }

    if (!hasMoreTokens()) {
      return EOF_TOKEN;
    }

    String str = mString.substring(mCursor);
    Integer[] lexRulesForState = mLexRulesByConditions.get(getCurrentState());

    for (int i = 0; i < lexRulesForState.length; i++) {
      String matched = match(str, mLexPatterns[i]);

      // Manual handling of EOF token (the end of String). Return it
      // as `EOF` symbol.
      if (str.length() == 0 && matched != null && matched.length() == 0) {
        mCursor++;
      }

      if (matched != null) {
        Tokenizer.yytext = matched;
        Tokenizer.yyleng = matched.length();

        Object tokenType = null;

        try {
          Method tokenHandler = Tokenizer.class.getDeclaredMethod(mLexHandlers[i]);
          try {
            tokenType = tokenHandler.invoke(this);
          } catch (Throwable e) {
            // Ignore.
          }
        } catch (Throwable e) {
          // Ignore.
        }

        if (tokenType == null) {
          return getNextToken();
        }

        if (tokenType.getClass().isArray()) {
          String[] tokensArray = (String[])tokenType;
          tokenType = (String)tokensArray[0];
          if (tokensArray.length > 1) {
            for (int j = 1; j < tokensArray.length; j++) {
              mTokensQueue.add(tokensArray[j]);
            }
          }
        }

        return toToken((String)tokenType, matched);
      }
    }

    if (isEOF()) {
      mCursor++;
      return EOF_TOKEN;
    }

    throwUnexpectedToken(
      str.charAt(0),
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
  public void throwUnexpectedToken(char symbol, int line, int column) throws ParseException {
    String lineSource = mString.split("\n")[line - 1];

    String pad = new String(new char[column]).replace("\0", " ");
    String lineData = "\n\n" + lineSource + "\n" + pad + "^\n";

    throw new ParseException(
      lineData + "Unexpected token: \"" + symbol +"\" " +
      "at " + line + ":" + column + ".", 0
    );
  }

  private void captureLocation(String matched) {
    // Absolute offsets.
    mTokenStartOffset = mCursor;

    // Line-based locations, start.
    mTokenStartLine = mCurrentLine;
    mTokenStartColumn = mTokenStartOffset - mCurrentLineBeginOffset;

    // Extract `\n` in the matched token.
    Matcher nlMatcher = NL_RE.matcher(matched);
    while (nlMatcher.find()) {
      mCurrentLine++;
      mCurrentLineBeginOffset = mTokenStartOffset + nlMatcher.start() + 1;
    }

    mTokenEndOffset = mCursor + matched.length();

    // Line-based locations, end.
    mTokenEndLine = mCurrentLine;
    mTokenEndColumn = mCurrentColumn =
      (mTokenEndOffset - mCurrentLineBeginOffset);
  }

  private Token toToken(String tokenType, String yytext)
  {
    return new Token(
      mTokensMap.get(tokenType),
      yytext,
      mTokenStartOffset,
      mTokenEndOffset,
      mTokenStartLine,
      mTokenEndLine,
      mTokenStartColumn,
      mTokenEndColumn
    );
  }

  public boolean hasMoreTokens() {
    return mCursor <= mString.length();
  }

  public boolean isEOF() {
    return mCursor == mString.length();
  }

  private String match(String str, Pattern re) {
    Matcher m = re.matcher(str);
    String v = null;
    if (m.find()) {
      v = m.group(0);
      captureLocation(v);
      mCursor += v.length();
    }
    return v;
  }

  public String get() {
    return mString;
  }
}