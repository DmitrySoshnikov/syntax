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
  __EMPTY,
  __EOF,
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
  std::regex regex;
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
   * Returns current tokenizing state.
   */
  TokenizerState getCurrentState() { return states_.back(); }

  /**
   * Enters a new state pushing it on the states stack.
   */
  void pushState(TokenizerState state) { states_.push_back(state); }

  /**
   * Alias for `push_state`.
   */
  void begin(TokenizerState state) { states_.push_back(state); }

  /**
   * Exits a current state popping it from the states stack.
   */
  TokenizerState popState() {
    auto state = states_.back();
    states_.pop_back();
    return state;
  }

  /**
   * Returns next token.
   */
  SharedToken getNextToken() {
    if (!hasMoreTokens()) {
      yytext = __EOF;
      return toToken(TokenType::__EOF);
    }

    auto strSlice = str_.substr(cursor_);

    auto lexRulesForState = lexRulesByStartConditions_.at(getCurrentState());

    for (const auto& ruleIndex : lexRulesForState) {
      auto rule = lexRules_[ruleIndex];
      std::smatch sm;

      if (std::regex_search(strSlice, sm, rule.regex)) {
        yytext = sm[0];

        captureLocations_(yytext);
        cursor_ += yytext.length();

        // Manual handling of EOF token (the end of string). Return it
        // as `EOF` symbol.
        if (yytext.length() == 0) {
          cursor_++;
        }

        auto tokenType = rule.handler(*this, yytext);

        if (tokenType == TokenType::__EMPTY) {
          return getNextToken();
        }

        return toToken(tokenType);
      }
    }

    if (isEOF()) {
      cursor_++;
      yytext = __EOF;
      return toToken(TokenType::__EOF);
    }

    throwUnexpectedToken(strSlice[0], currentLine_, currentColumn_);
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
   * Throws default "Unexpected token" exception, showing the actual
   * line from the source, pointing with the ^ marker to the bad token.
   * In addition, shows `line:column` location.
   */
  [[noreturn]] void throwUnexpectedToken(char symbol, int line, int column) {
    std::stringstream ss{str_};
    std::string lineStr;
    int currentLine = 0;

    while (currentLine++ <= line) {
      std::getline(ss, lineStr, '\n');
    }

    auto pad = std::string(column, ' ');

    std::stringstream errMsg;

    errMsg << "Syntax Error:\n\n"
           << lineStr << "\n"
           << pad << "^\nUnexpected token \"" << symbol << "\" at " << line
           << ":" << column << "\n\n";

    std::cerr << errMsg.str();
    throw new std::runtime_error(errMsg.str().c_str());
  }

  /**
   * Matched text.
   */
  std::string yytext;

 private:
  /**
   * Captures token locations.
   */
  void captureLocations_(const std::string& matched) {
    auto len = matched.length();

    // Absolute offsets.
    tokenStartOffset_ = cursor_;

    // Line-based locations, start.
    tokenStartLine_ = currentLine_;
    tokenStartColumn_ = tokenStartOffset_ - currentLineBeginOffset_;

    // Extract `\n` in the matched token.
    std::stringstream ss{matched};
    std::string lineStr;
    std::getline(ss, lineStr, '\n');
    while (ss.tellg() > 0 && ss.tellg() <= len) {
      currentLine_++;
      currentLineBeginOffset_ = tokenStartOffset_ + ss.tellg();
      std::getline(ss, lineStr, '\n');
    }

    tokenEndOffset_ = cursor_ + len;

    // Line-based locations, end.
    tokenEndLine_ = currentLine_;
    tokenEndColumn_ = tokenEndOffset_ - currentLineBeginOffset_;
    currentColumn_ = tokenEndColumn_;
  }

  /**
   * Lexical rules.
   */
  // clang-format off
  static constexpr size_t LEX_RULES_COUNT = {{{LEX_RULES_COUNT}}};
  static std::array<LexRule, LEX_RULES_COUNT> lexRules_;
  static std::map<TokenizerState, std::vector<size_t>> lexRulesByStartConditions_;
  // clang-format on

  /**
   * Special EOF token.
   */
  static std::string __EOF;

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
  std::vector<TokenizerState> states_;

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

std::string Tokenizer::__EOF("$");

// clang-format off
{{{LEX_RULE_HANDLERS}}}
// clang-format on

// ------------------------------------------------------------------
// Lexical rules.

// clang-format off
std::array<LexRule, Tokenizer::LEX_RULES_COUNT> Tokenizer::lexRules_ = {{{LEX_RULES}}};
std::map<TokenizerState, std::vector<size_t>> Tokenizer::lexRulesByStartConditions_ = {{{LEX_RULES_BY_START_CONDITIONS}}};
// clang-format on

#endif