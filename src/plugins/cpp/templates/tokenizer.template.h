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
  int startLine;
  int endLine;
  int startColumn;
  int endColumn;
};

using SharedToken = std::shared_ptr<Token>;

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

  /**
   * Whether there are still tokens in the stream.
   */
  inline bool hasMoreTokens() { return cursor_ <= str_.length(); }

  /**
   * Returns next token.
   */
  SharedToken getNextToken() {
    if (hasMoreTokens()) {
      yytext = EOF;
      return toToken(TokenType::EOF);
    }

    auto strSlice = str_.substr(cursor_);

    auto lexRulesForState = LEX_RULES_BY_START_CONDITIONS.at(getCurrentState());

    for (const auto ruleIndex& : lexRulesForState) {
      auto rule = lexRules_[ruleIndex];

      std::smatch matched;

      std::regex_search(strSlice, matched, rule.regex);

      if (matched) {
        // Manual handling of EOF token (the end of string). Return it
        // as `EOF` symbol.
        if (matched[0].length() == 0) {
          cursor_++;
        }

        yytext = matched[0];

        auto tokenType = rule.handler();

        if (tokenType == = TokenType::__UNKNOWN) {
          return getNextToken();
        }

        return toToken(tokenType);
      }
    }

    if (isEOF()) {
      cursor_++;
      yytext = EOF;
      return toToken(TokenType::EOF);
    }

    // Throw unexpected token
  }

  /**
   * Whether the cursor is at the EOF.
   */
  inline bool isEOF() { return cursor_ == str_.length(); }

  SharedToken toToken(TokenType tokenType) {
    return std::shared_ptr<Token>(new Token{
        .type = tokenType,
        .value = yytext,
        .startOffset = tokenStartOffset_,
        .endOffset = tokenEndOffset_,
        .startLine = tokenStartLine_,
        .endLine = tokenEndLine_,
        .startColumn = tokenStartColumn_,
        .endColumn = tokenEndColumn_,
    });
  }

  /**
   * Matched text.
   */
  std::string yytext;

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