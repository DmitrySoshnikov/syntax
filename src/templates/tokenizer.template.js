/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 *
 * See `--custom-tokinzer` to skip this generation, and use a custom one.
 */

const lexRules = <<LEX_RULES>>;
const lexRulesByConditions = <<LEX_RULES_BY_START_CONDITIONS>>;

const EOF_TOKEN = {
  type: EOF,
  value: EOF,
};

tokenizer = {
  initString(string) {
    this._string = string + EOF;
    this._cursor = 0;
    this._states = ['INITIAL'];
    this._tokensQueue = [];
    this._currentLine = 1;
    this._currentColumn = 0;
    this._currentLineBeginOffset = 0;
    this._tokenLoc = null;
    return this;
  },

  /**
   * Returns tokenizer states.
   */
  getStates() {
    return this._states;
  },

  getCurrentState() {
    return this._states[this._states.length - 1];
  },

  pushState(state) {
    this._states.push(state);
  },

  begin(state) {
    this.pushState(state);
  },

  popState() {
    if (this._states.length > 1) {
      return this._states.pop();
    }
    return this._states[0];
  },

  getNextToken() {
    // Something was queued, return it.
    if (this._tokensQueue.length > 0) {
      return this._toToken(this._tokensQueue.shift());
    }

    if (!this.hasMoreTokens()) {
      return EOF_TOKEN;
    } else if (this.isEOF()) {
      this._cursor++;
      return EOF_TOKEN;
    }

    let string = this._string.slice(this._cursor);
    let lexRulesForState = lexRulesByConditions[this.getCurrentState()];

    for (let i = 0; i < lexRulesForState.length; i++) {
      let lexRuleIndex = lexRulesForState[i];
      let lexRule = lexRules[lexRuleIndex];

      let matched = this._match(string, lexRule[0]);
      if (matched) {
        yytext = matched;
        yyleng = yytext.length;
        let token = lexRule[1].call(this);

        if (!token) {
          return this.getNextToken();
        }

        // If multiple tokens are returned, save them to return
        // on next `getNextToken` call.

        if (Array.isArray(token)) {
          const tokensToQueue = token.slice(1);
          token = token[0];
          if (tokensToQueue.length > 0) {
            this._tokensQueue.unshift(...tokensToQueue);
          }
        }

        return this._toToken(token, yytext);
      }
    }

    throw new Error(
      `Unexpected token: "${string[0]}" at ${this._currentLine}:` +
      this._currentColumn
    );
  },

  getCursor() {
    return this._cursor;
  },

  getCurrentLine() {
    return this._currentLine;
  },

  getCurrentColumn() {
    return this._currentColumn;
  },

  _captureLocation(matched) {
    const nlRe = /\n/g;

    // Absolute offsets.
    const startOffset = this._cursor;

    // Line-based locations, start.
    const startLine = this._currentLine;
    const startColumn = startOffset - this._currentLineBeginOffset;

    // Extract `\n` in the matched token.
    let nlMatch;
    while ((nlMatch = nlRe.exec(matched)) !== null) {
      this._currentLine++;
      this._currentLineBeginOffset = startOffset + nlMatch.index + 1;
    }

    const endOffset = this._cursor + matched.length;

    // Line-based locations, end.
    const endLine = this._currentLine;
    const endColumn = this._currentColumn =
      (endOffset - this._currentLineBeginOffset);

    this._tokenLoc = {
      startOffset,
      endOffset,
      startLine,
      endLine,
      startColumn,
      endColumn,
    };
  },

  _toToken(tokenType, yytext = '') {
    return Object.assign({
      type: tokenType,
      value: yytext,
    }, this._tokenLoc);
  },

  isEOF() {
    return this._string[this._cursor] === EOF &&
      this._cursor === this._string.length - 1;
  },

  hasMoreTokens() {
    return this._cursor < this._string.length;
  },

  _match(string, regexp) {
    let matched = string.match(regexp);
    if (matched) {
      // Handle `\n` in the matched token to track line numbers.
      this._captureLocation(matched[0]);
      this._cursor += matched[0].length;
      return matched[0];
    }
    return null;
  },
};