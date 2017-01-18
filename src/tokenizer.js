/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from './grammar/grammar-symbol';
import {EOF} from './special-symbols';

import colors from 'colors';

const EOF_TOKEN = {
  type: EOF,
  value: EOF,
};

/**
 * A default tokenizer that extracts tokens from the string,
 * based on the tokens from the grammar. Uses underlying
 * regexp implementation.
 */
export default class Tokenizer {

  /**
   * Creates a tokenizer instance for a string
   * that belongs to the given grammar.
   */
  constructor({string, lexGrammar}) {

    /**
     * Corresponding lexical grammar.
     */
    this._lexGrammar = lexGrammar;

    if (string) {
      this.initString(string);
    }
  }

  /**
   * Returns tokenizer states.
   */
  getStates() {
    return this._states;
  }

  /**
   * Returns current state.
   */
  getCurrentState() {
    return this._states[this._states.length - 1];
  }

  /**
   * Pushes a new state for the tokinizer. Some lex-rules may
   * specify in which state they are triggered. A rule won't be
   * triggered if a tokenizer is not in this state.
   */
  pushState(state) {
    this._states.push(state);
  }

  /**
   * Alias for `pushState`.
   */
  begin(state) {
    this.pushState(state);
  }

  /**
   * Pops a state. If there is only INITIAL state, just returns it.
   */
  popState() {
    if (this._states.length > 1) {
      return this._states.pop();
    }
    return this._states[0];
  }

  /**
   * Initializes a parsing string, and corresponding meta data.
   */
  initString(string) {
    /**
     * The string followed by the EOF.
     */
    this._string = string + EOF;

    /**
     * Tracking cursor (absolute offset).
     */
    this._cursor = 0;

    /**
     * Tokenizer states to work with start conditions of lex rules.
     * The `INITIAL` state always present, i.e. all rules with no
     * explicit start conditions are executed, untill a new state is
     * pushed. If the state is exclusive, then only the rules with this
     * start condition are executed. If it's inclusive, then in addition
     * rules with no start conditions are executed as well.
     * https://gist.github.com/DmitrySoshnikov/f5e2583b37e8f758c789cea9dcdf238a
     */
    this._states = ['INITIAL'];

    /**
     * In case if a token handler returns multiple tokens from one rule,
     * we still return tokens one by one in the `getNextToken`, putting
     * other "fake" tokens into the queue. If there is still something in
     * this queue, it's just returned.
     */
    this._tokensQueue = [];

    /**
     * Current line number.
     */
    this._currentLine = 1;

    /**
     * Current column number.
     */
    this._currentColumn = 0;

    /**
     * Current offset of the beginning of the current line.
     *
     * Since new lines can be handled by the lex rules themselves,
     * we scan an extracted token for `\n`s, and calculate start/end
     * locations of tokens based on the `currentLine`/`currentLineBeginOffset`.
     */
    this._currentLineBeginOffset = 0;

    /**
     * Matched token location data.
     */
    this._tokenStartOffset = 0;
    this._tokenEndOffset = 0;
    this._tokenStartLine = 1;
    this._tokenEndLine = 1;
    this._tokenStartColumn = 0;
    this._tokenEndColumn = 0;
  }

  getTokens() {
    if (!this._tokens) {
      // Rewind to calculate all tokens.
      let cursor = this._cursor;
      this._cursor = 0;
      this._tokens = [];
      while (this.hasMoreTokens()) {
        this._tokens.push(this.getNextToken());
      }
      // And restore back for the `getNextToken`.
      this._cursor = cursor;
    }
    return this._tokens;
  }

  /**
   * Returns next token.
   */
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

    // Analyze untokenized yet part of the string starting from
    // the current cursor position (so all regexp are from ^).
    let string = this._string.slice(this._cursor);

    // Get all rules which should be considered for this state.
    const lexRulesForState = this._lexGrammar.getRulesForState(
      this.getCurrentState(),
    );

    for (let lexRule of lexRulesForState) {
      let matched = this._match(string, lexRule.getMatcher());
      if (matched) {
        let yytext, rawToken;

        try {
          [yytext, rawToken] = lexRule.getTokenData(matched, this);
        } catch (e) {
          console.error(
            colors.red('\nError in handler:\n\n') +
            lexRule.getRawHandler() + '\n',
          );
          throw e;
        }

        // Usually whitespaces, etc.
        if (!rawToken) {
          return this.getNextToken();
        }

        // If multiple tokens are returned, save them to return
        // on next `getNextToken` call.

        if (Array.isArray(rawToken)) {
          const tokensToQueue = rawToken.slice(1);
          rawToken = rawToken[0];
          if (tokensToQueue.length > 0) {
            this._tokensQueue.unshift(...tokensToQueue);
          }
        }

        return this._toToken(rawToken, yytext);
      }
    }

    throw new Error(
      `Unexpected token: "${string[0]}" ` +
      `at ${this._currentLine}:${this._currentColumn}.`
    );
  }

  _captureLocation(matched) {
    const nlRe = /\n/g;

    // Absolute offsets.
    this._tokenStartOffset = this._cursor;

    // Line-based locations, start.
    this._tokenStartLine = this._currentLine;
    this._tokenStartColumn =
      this._tokenStartOffset - this._currentLineBeginOffset;

    // Extract `\n` in the matched token.
    let nlMatch;
    while ((nlMatch = nlRe.exec(matched)) !== null) {
      this._currentLine++;
      this._currentLineBeginOffset = this._tokenStartOffset + nlMatch.index + 1;
    }

    this._tokenEndOffset = this._cursor + matched.length;

    // Line-based locations, end.
    this._tokenEndLine = this._currentLine;
    this._tokenEndColumn = this._currentColumn =
      (this._tokenEndOffset - this._currentLineBeginOffset);
  }

  _toToken(tokenType, yytext = '') {
    return {
      // Basic data.
      type: tokenType,
      value: yytext,

      // Location data.
      startOffset: this._tokenStartOffset,
      endOffset: this._tokenEndOffset,
      startLine: this._tokenStartLine,
      endLine: this._tokenEndLine,
      startColumn: this._tokenStartColumn,
      endColumn: this._tokenEndColumn,
    };
  }

  isEOF() {
    return this._string[this._cursor] === EOF &&
      this._cursor === this._string.length - 1;
  }

  hasMoreTokens() {
    return this._cursor < this._string.length;
  }

  /**
   * Generic tokenizing based on current regexp.
   */
  _match(string, regexp) {
    let matched = string.match(regexp);
    if (matched) {
      // Handle `\n` in the matched token to track line numbers.
      this._captureLocation(matched[0]);
      this._cursor += matched[0].length;
      return matched[0];
    }
    return null;
  }
};
