/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 */

#ifndef __Syntax_Tokenizer_h
#define __Syntax_Tokenizer_h

class Tokenizer;

// ------------------------------------------------------------------
// TokenType.

enum class TokenType {
  __UNKNOWN,
  // clang-format off
  {{{TOKEN_TYPES}}}
  // clang-format on
};

// ------------------------------------------------------------------
// Token.

struct Token {
  TokenType type;
  std::string value;

  int startOffset;
  int endOffset;
  int start_line;
  int endLine;
  int startColumn;
  int endColumn;
};

typedef TokenType (*LexRuleHandler)(const Tokenizer&, const std::string&);

// ------------------------------------------------------------------
// Lex rule: [regex, handler]

struct LexRule {
  std::regex rule;
  LexRuleHandler handler;
};

// ------------------------------------------------------------------
// Token.

enum TokenizerState {
  // clang-format off
  {{{TOKENIZER_STATES}}}
  // clang-format on
};

// ------------------------------------------------------------------
// Tokenizer.

class Tokenizer {
 public:
  /**
   * Initializes a parsing string.
   */
  void initString(const std::string& str) {
    str_ = str;

    // Initialize states.
    states_.clear();
    states_.push_back(TokenizerState::INITIAL);

    cursor_ = 0;
    currentLine_ = 1;
    currentColumn_ = 0;
    currentLineBeginOffset_ = 0;

    tokenStartOffset_ = 0;
    tokenEndOffset_ = 0;
    tokenStartLine_ = 0;
    tokenEndLine_ = 0;
    tokenStartColumn_ = 0;
    tokenEndColumn_ = 0;
  }

 private:
  /**
   * Lexical rules.
   */
  // clang-format off
  static constexpr size_t LEX_RULES_COUNT = {{{LEX_RULES_COUNT}}};
  static std::array<LexRule, LEX_RULES_COUNT> lexRules_;
  // clang-format on

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

// ------------------------------------------------------------------
// Lexical rule handlers.

// clang-format off
{{{LEX_RULE_HANDLERS}}}
// clang-format on

// ------------------------------------------------------------------
// Lexical rules.

// clang-format off
std::array<LexRule, Tokenizer::LEX_RULES_COUNT> Tokenizer::lexRules_ = {{{LEX_RULES}}};
// clang-format on

#endif