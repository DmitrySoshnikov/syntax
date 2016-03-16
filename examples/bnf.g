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
            ["\/\\*(.|\\s)*?\\*\/",        "/* skip comments */"],
            ["\\s+",                       "/* skip whitespace */"],
            ["\\{\\s*(.*)\\s*\\}",         "yytext = yytext.slice(1, -1).trim(); return 'CODE'"],
            ["[a-zA-Z][a-zA-Z0-9_-]*",     "return 'ID'"],
            ["(?:->|:)",                   "return 'SPLITTER'"],
            [";",                          "return ';'"],
            ["\\|",                        "return '|'"],
            ["\\{",                        "return '{'"],
            ["\\}",                        "return '}'"],
            ["%%",                         "return '%%'"],
            ["(?:\"|')([^\"']*)(?:\"|')",  "return 'STRING'"]
        ]
    },

    "bnf": {
        "Spec":           [["%% ProductionList",            "return $$ = {bnf: $2 };"]],

        "ProductionList": [["ProductionList Production",    "$$ = $1; $$[$2[0]] = $2[1];"],
                           ["Production",                   "$$ = {}; $$[$1[0]] = $1[1];"]],

        "Production":     [["LHS SPLITTER HandleList ;",    "$$ = [$1, $3];"]],

        "LHS":            [["ID",                           "$$ = yytext;"]],

        "HandleList":     [["HandleList | HandleAction",    "$$ = $1; $$.push($3);"],
                           ["HandleAction",                 "$$ = [$1];"]],

        "HandleAction":   [["Handle Action",                "$$ = [$1, $2];"]],

        "Handle":         [["Entries",                      "$$ = $1;"],
                           ["ε",                            "$$ = '';"]],

        "Entries":        [["Entries Entry",                "$$ = $1 + ' ' + $2;"],
                           ["Entry",                        "$$ = $1;"]],

        "Entry":          [["ID",                           "$$ = yytext;"],
                           ["STRING",                       "$$ = yytext;"]],

        "Action":         [["CODE",                         "$$ = yytext;"],
                           ["ε",                            "$$ = null;"]]
    }
}