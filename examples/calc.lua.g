/**
 * Generated parser in Lua.
 *
 * ./bin/syntax -g examples/calc.lua.g -m lalr1 -o calcparser.lua
 * 
 * > Parser = require("calcparser")
 * > parser = Parser.new()
 * > print(parser:parse("2^2^2^2"))
 * 65536
 */

{
  "lex": {
    "rules": [
      ["%s+",  "-- skip whitespace"],
      ["%d+",  "return 'NUMBER'"],
      ["%*",   "return '*'"],
      ["%+",   "return '+'"],
      ["%(",   "return '('"],
      ["%)",   "return ')'"],
      ["%^",   "return '^'"],
    ]
  },

  "operators": [
    ["left", "+"],
    ["left", "*"],
    ["right", "^"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = $1 + $3"],
      ["E * E",  "$$ = $1 * $3"],
      ["E ^ E",  "$$ = $1 ^ $3"],
      ["NUMBER", "$$ = tonumber($1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}