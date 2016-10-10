/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 *
 * See `--custom-tokinzer` to skip this generation, and use a custom one.
 */

const lexRules = <<LEX_RULES>>;

tokenizer = {
  initString(string) {
    this._string = string + EOF;
    this._cursor = 0;
    return this;
  },

  getNextToken() {
    if (!this.hasMoreTokens()) {
      return {
        type: EOF,
        value: EOF,
      };
    } else if (this.isEOF()) {
      this._cursor++;
      return {
        type: EOF,
        value: EOF,
      };
    }

    let string = this._string.slice(this._cursor);

    for (let i = 0; i < lexRules.length; i++) {
      let lexRule = lexRules[i];
      let matched = this._match(string, lexRule[0]);
      if (matched) {
        yytext = matched;
        yyleng = yytext.length;
        let token = lexRule[1]();

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