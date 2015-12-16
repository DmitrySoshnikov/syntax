/**
 * How to run:
 *
 * ./bin/syntax examples/json.grammar \
 *     --mode slr1 \
 *     --collection \
 *     --table \
 *     --parse '{"x": 10, "y": {"z": [1, 2, 3]}}'
 */

{
    "_info": "Based on: https://github.com/zaach/jison/blob/master/examples/json.js",

    "lex": {
        "macros": {
            "digit": "[0-9]",
            "esc": "\\\\",
            "int": "-?(?:[0-9]|[1-9][0-9]+)",
            "exp": "(?:[eE][-+]?[0-9]+)",
            "frac": "(?:\\.[0-9]+)"
        },
        "rules": [
            ["\\s+", "/* skip whitespace */"],
            ["{int}{frac}?{exp}?\\b", "return 'NUMBER';"],
            ["\"(?:{esc}[\"bfnrt/{esc}]|{esc}u[a-fA-F0-9]{4}|[^\"{esc}])*\"", "return 'STRING';"],
            ["\\{", "return '{'"],
            ["\\}", "return '}'"],
            ["\\[", "return '['"],
            ["\\]", "return ']'"],
            [",", "return ','"],
            [":", "return ':'"],
            ["true\\b", "return 'TRUE'"],
            ["false\\b", "return 'FALSE'"],
            ["null\\b", "return 'NULL'"]
        ]
    },

    "tokens": "STRING NUMBER { } [ ] , : TRUE FALSE NULL",
    "start": "JSONText",

    "bnf": {
        "JSONString": [ "STRING" ],

        "JSONNullLiteral": [ "NULL" ],

        "JSONNumber": [ "NUMBER" ],

        "JSONBooleanLiteral": [ "TRUE", "FALSE" ],


        "JSONText": [ "JSONValue" ],

        "JSONValue": [ "JSONNullLiteral",
                       "JSONBooleanLiteral",
                       "JSONString",
                       "JSONNumber",
                       "JSONObject",
                       "JSONArray" ],

        "JSONObject": [ "{ }",
                        "{ JSONMemberList }" ],

        "JSONMember": [ "JSONString : JSONValue" ],

        "JSONMemberList": [ "JSONMember",
                              "JSONMemberList , JSONMember" ],

        "JSONArray": [ "[ ]",
                       "[ JSONElementList ]" ],

        "JSONElementList": [ "JSONValue",
                             "JSONElementList , JSONValue" ]
    }
}