/**
 * Generated parser in C++.
 *
 * ./bin/syntax -g examples/calc.cpp.g -m lalr1 -o CalcParser.h
 *
 *   #include "CalcParser.h"
 *
 *   CalcParser parser;
 *
 *   std::cout << parser.parse("2 + 2 * 2"); // 6
 */

%lex

%%

\s+    %empty

\d+    NUMBER

/lex

%{

// Type of the parsing value. Can either
// be a type alias or an actual struct:

using Value = int;

%}

%left '+'
%left '*'

%%

E
  : E '+' E   { $$ = $1 + $3 }
  | E '*' E   { $$ = $1 * $3 }
  | '(' E ')' { $$ = $2 }
  | NUMBER
  ;