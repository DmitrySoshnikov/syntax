/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 */

#ifndef __Syntax_Tokenizer_h
#define __Syntax_Tokenizer_h

// ------------------------------------------------------------------
// Token.

struct Token {
  int type;
  std::string value;

  int startOffset;
  int endOffset;
  int start_line;
  int endLine;
  int startColumn;
  int endColumn;

  // clang-format off
  {{{TOKEN_NAMES}}}
  // clang-format on
};

// ------------------------------------------------------------------
// Tokenizer.

class Tokenizer {
 private:
  /**
   * Tokenizing string.
   */
  std::string str_;

  /**
   * Cursor for current symbol.
   */
  int cursor_;

  /**
   * States.
   */
  std::vector<int> states_;

  /**
   * Line-based location tracking.
   */
  int currentLine_;
  int currentColumn_;
  int currentLineBeginOffset_;

  /**
   * Location data of a matched token.
   */
  int tokenStartOffset_;
  int tokenEndOffset_;
  int tokenStartLine_;
  int tokenEndLine_;
  int tokenStartColumn_;
  int tokenEndColumn_;

  /**
   * Matched text, and its length.
   */
  std::string yytext;
  int yyleng;
};

#endif