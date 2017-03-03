/**
 * Lexical grammar for lexical grammar.
 *
 * The grammar is heavily based on the lexical grammar from Jison.
 * https://raw.githubusercontent.com/zaach/lex-parser/master/lex.l
 */

{
  macros: {
    NAME: `[a-zA-Z_][a-zA-Z0-9_-]*`,
    BR:   `\\n`,
  },

  startConditions: {
    indented: 0,
    trail: 0,
    rules: 0,
    code: 1,
    start_condition: 1,
    options: 1,
    conditions: 1,
    action: 1,
  },

  rules: [
    [[`*`],         `<<EOF>>`,                    `return 'EOF'`],

    [[`action`],  `\\/\\*(.|\\n|\\r)*?\\*\\/`,    `return 'ACTION_BODY'`],
    [[`action`],  `\\/\\/.*`,                     `return 'ACTION_BODY'`],
    [[`action`],  `\\/[^ /]*?['\"{}'][^ ]*?\\/`,  `return 'ACTION_BODY'`], // regexp with braces or quotes (and no spaces)"
    [[`action`],  `"(\\\\\\\\|\\\\\"|[^\"])*"`,   `return 'ACTION_BODY'`],
    [[`action`],  `'(\\\\\\\\|\\\\'|[^'])*'`,     `return 'ACTION_BODY'`],
    [[`action`],  `[/"'][^{}/"']+`,               `return 'ACTION_BODY'`],
    [[`action`],  `[^{}/"']+`,                    `return 'ACTION_BODY'`],
    [[`action`],  `\\{`,                          `yy.depth++; return '{'`],
    [[`action`],  `\\}`,                          `yy.depth == 0 ? this.begin('trail') : yy.depth--; return '}'`],

    [[`conditions`],        `{NAME}`,             `return 'NAME'`],
    [[`conditions`],        `>`,                  `this.popState(); return '>'`],
    [[`conditions`],        `,`,                  `return ','`],
    [[`conditions`],        `\\*`,                `return '*'`],

    [[`rules`],             `{BR}+`,              `/* */`],
    [[`rules`],             `\\s+{BR}+`,          `/* */`],
    [[`rules`],             `\\s+`,               `this.begin('indented')`],
    [[`rules`],             `%%`,                 `this.begin('code'); return '%%'`],
    [[`rules`],             `[a-zA-Z0-9_]+`,      `return 'CHARACTER_LIT'`],

    [[`options`],           `{NAME}`,             `yy.options[yytext] = true`],
    [[`options`],           `{BR}+`,              `this.begin('INITIAL')`],
    [[`options`],           `\\s+{BR}+`,          `this.begin('INITIAL')`],
    [[`options`],           `\\s+`,               `/* empty */`],

    [[`start_condition`],   `{NAME}`,             `return 'START_COND'`],
    [[`start_condition`],   `{BR}+`,              `this.begin('INITIAL')`],
    [[`start_condition`],   `\\s+{BR}+`,          `this.begin('INITIAL')`],
    [[`start_condition`],   `\\s+`,               `/* empty */`],

    [[`trail`],             `.*{BR}+`,            `this.begin('rules')`],

    [[`indented`],          `\\{`,                `yy.depth = 0; this.begin('action'); return '{'`],
    [[`indented`],          `%\\{(.|{BR})*?%\\}`, `this.begin('trail'); yytext = yytext.slice(2, -2); return 'ACTION'`],
    [`%\\{(.|{BR})*?%\\}`,                        `yytext = yytext.slice(2, -2); return 'ACTION'`],
    [[`indented`],          `.+<<EOF>>`,          `this.begin('rules'); yytext = yytext.slice(0, -1); return ['ACTION', 'EOF']`],
    [[`indented`],          `.+`,                 `this.begin('rules'); return 'ACTION'`],

    [`\\/\\*(.|\\n|\\r)*?\\*\\/`,                 `/* ignore */`],
    [`\\/\\/.*`,                                  `/* ignore */`],
    [`{BR}+`,                                     `/* */`],
    [`\\s+`,                                      `/* */`],
    [`{NAME}`,                                    `return 'NAME'`],

    [`"(\\\\\\\\|\\\\\"|[^"])*"`,                 `yytext = yytext.replace(/\\\\"/g, '"'); return 'STRING_LIT'`],
    [`'(\\\\\\\\|\\\\'|[^'])*'`,                  `yytext = yytext.replace(/\\\\'/g, "'"); return 'STRING_LIT'`],

    [`\\|`,                                       `return '|'`],
    [`\\[(\\\\\\\\|\\\\\\]|[^\\]])*\\]`,          `return 'ANY_GROUP_REGEX'`],

    [`\\(\\?:`,                                   `return 'SPECIAL_GROUP'`],
    [`\\(\\?=`,                                   `return 'SPECIAL_GROUP'`],
    [`\\(\\?!`,                                   `return 'SPECIAL_GROUP'`],

    [`\\(`,                                       `return '('`],
    [`\\)`,                                       `return ')'`],
    [`\\+`,                                       `return '+'`],
    [`\\*`,                                       `return '*'`],
    [`\\?`,                                       `return '?'`],
    [`\\^`,                                       `return '^'`],
    [`,`,                                         `return ','`],

    [`<`,                                         `this.begin('conditions'); return '<'`],
    [`\\/!`,                                      `return '/!'`],
    [`\\/`,                                       `return '/'`],
    [`\\\\([0-7]{1,3}|[rfntvsSbBwWdD\\\\*+()$\\{\\}|[\\]\\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4})`,
     `return 'ESCAPE_CHAR'`],

    [`\\\\.`,                                     `yytext = yytext.replace(/^\\\\/g,''); return 'ESCAPE_CHAR'`],

    [`\\$`,                                       `return '$'`],
    [`\\.`,                                       `return '.'`],
    [`%options\\b`,                               `yy.options = {}; this.begin('options')`],
    [`%s\\b`,                                     `this.begin('start_condition'); return 'START_INC'`],
    [`%x\\b`,                                     `this.begin('start_condition'); return 'START_EXC'`],
    [`%%`,                                        `this.begin('rules'); return '%%'`],

    [`\\{\\d+(,\\s?\\d+|,)?\\}`,                  `return 'RANGE_REGEX'`],
    [`\\{{NAME}\\}`,                              `return 'NAME_BRACE'`],
    [`\\{`,                                       `return '{'`],
    [`\\}`,                                       `return '}'`],
    [`.`,                                         `/* ignore bad characters */`],

    [[`code`],      `(.|{BR})+<<EOF>>`,           `yytext = yytext.slice(0, -1); return ['CODE', 'EOF']`],
  ],
}