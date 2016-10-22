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
    this._states = ['INITIAL'];
    this._string = string + EOF;
    this._cursor = 0;
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

        return {
          type: token,
          value: yytext,
        };
      }
    }

    throw new Error(`Unexpected token: "${string[0]}".`);
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
      this._cursor += matched[0].length;
      return matched[0];
    }
    return null;
  },
};