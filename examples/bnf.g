/**
 * BNF grammar grammar.
 *
 * Example:
 *
 *   ./bin/syntax -g examples/bnf.g -f examples/bnf.bnf -m slr1
 */

{
  "lex": {
    "rules": [
      ["\\/\\/.*",                                  "/* skip comments */"],
      ["\/\\*(.|\\s)*?\\*\/",                       "/* skip comments */"],
      ["\\s+",                                      "/* skip whitespace */"],
      ["%start\\b",                                 "return '%start'"],
      ["%prec\\b",                                  "return '%prec'"],
      ["%left\\b",                                  "return '%left'"],
      ["%right\\b",                                 "return '%right'"],
      ["%nonassoc\\b",                              "return '%nonassoc'"],
      ["%token",                                    "return '%token'"],

      // Code inside an action block { } may contain { } from the language
      // itself, so we collect the action block piece by piece, handling
      // { and } explicitly counting the depth.

      [["action"], "\\/\\*(.|\\n|\\r)*?\\*\\/",     "return 'CODE'"],
      [["action"], "\\/\\/.*",                      "return 'CODE'"],
      [["action"], "\\/[^ /]*?['\"{}'][^ ]*?\\/",   "return 'CODE'"], // regexp with braces or quotes (and no spaces)
      [["action"], "\"(\\\\\\\\|\\\\\"|[^\"])*\"",  "return 'CODE'"],
      [["action"], "'(\\\\\\\\|\\\\'|[^'])*'",      "return 'CODE'"],
      [["action"], "[/\"'][^{}/\"']+",              "return 'CODE'"],
      [["action"], "[^{}/\"']+",                    "return 'CODE'"],
      [["action"], "\\{",                           "yy.depth++; return '{';"],
      [["action"], "\\}",                           "if (yy.depth==0) this.popState(); else yy.depth--; return '}'"],

      ["[a-zA-Z][a-zA-Z0-9_\\-']*",                 "return 'ID'"],
      ["(?:->|:(:=)?)",                             "return 'SPLITTER'"],
      [";",                                         "return ';'"],
      ["\\|",                                       "return '|'"],
      ["\\{",                                       "yy.depth = 0; this.pushState('action'); return '{';"],
      ["\\}",                                       "return '}'"],

      ["%%",                                        "return '%%'"],

      ["%lex[\\w\\W]*?\\/lex\\b",                   "yytext = yytext.slice(4, -4).trim(); return 'LEX_BLOCK'"],
      ["%\\{(.|\\r|\\n)*?%\\}",                     "yytext = yytext.slice(2, -2).trim(); return 'MODULE_INCLUDE'"],
      ["\\{\\{[\\w\\W]*?\\}\\}",                    "yytext = yytext.slice(2, -2); return 'CODE';"],
      ["%[a-zA-Z]+[^\\r\\n]*",                      "/* skip unrecognized options */"],
      ["(?:\"|')([^\"']*)(?:\"|')",                 "return 'STRING'"],
    ],

    "startConditions": {
      "action": 1, // exclusive condition
    },
  },

  "moduleInclude": `
    let tokens;
    let operators;
    let extra;

    yyparse.onParseBegin = () => {
      tokens = [];
      operators = [];
      extra = {};
    };
  `,

  "bnf": {
    "Spec":         [["DeclList %% Productions", `
                      const spec = Object.assign({bnf: $3}, extra);

                      if (operators.length) {
                        spec.operators = operators;
                      }

                      if (tokens.length) {
                        spec.tokens = tokens.join(' ');
                      }

                      $$ = spec;
                    `]],

    "DeclList":     ["Declarations",
                     "ε"],

    "Declarations": ["Declaration",
                     "Declarations Declaration"],

    "Declaration":  [["LEX_BLOCK",                  "extra.lex = $1"],
                     ["MODULE_INCLUDE",             "extra.moduleInclude = $1"],
                     ["%start LHS",                 "extra.start = $2"],
                     ["%left OperatorList",         "operators.push(['left'].concat($2))"],
                     ["%right OperatorList",        "operators.push(['right'].concat($2))"],
                     ["%nonassoc OperatorList",     "operators.push(['nonassoc'].concat($2))"],
                     ["%token OperatorList",        "tokens.push(...$2)"]],

    "OperatorList": [["Primary",                    "$$ = [$1]"],
                     ["OperatorList Primary",       "$$ = $1; $1.push($2)"]],

    "Productions":  [["Productions Production",     "$$ = $1; $$[$2[0]] = $2[1]"],
                     ["Production",                 "$$ = {}; $$[$1[0]] = $1[1]"]],

    "Production":   [["LHS SPLITTER HandleList ;",  "$$ = [$1, $3]"]],

    "LHS":          [["ID",                         "$$ = $1"]],

    "HandleList":   [["HandleList | HandleAction",  "$$ = $1; $1.push($3)"],
                     ["HandleAction",               "$$ = [$1]"]],

    "HandleAction": [["Handle Action",              "$$ = [$1[0], $2]; $1[1] && $$.push({prec: $1[1]})"]],

    "Handle":       [["Entries Prec",               "$$ = [$1, $2]"],
                     ["ε",                          "$$ = ''"]],

    "Prec":         [["%prec Primary",              "$$ = $2"],
                     ["ε"]],

    "Entries":      [["Entries Primary",            "$$ = $1 + ' ' + $2"],
                     ["Primary",                    "$$ = $1"]],

    "Primary":      [["ID",                         "$$ = $1"],
                     ["STRING",                     "$$ = $1"]],

    "Action":       [["{ ActionBody }",             "$$ = $2"],
                     ["ε",                          "$$ = null"]],

    // In order to handle nested { } we construct code piece by piece.

    "ActionBody":   [["ActionCommentBody",                            "$$ = $1"],
                     ["ActionBody { ActionBody } ActionCommentBody",  "$$ = $1 + $2 + $3 + $4 + $5"],
                     ["ActionBody { ActionBody }",                    "$$ = $1 + $2 + $3 + $4"],
                     ["ε",                                            "$$ = ''"]],

    "ActionCommentBody": [["ActionCommentBody CODE",  "$$ = $1 + $2"],
                          ["CODE",                    "$$ = $1"]],
  }
}