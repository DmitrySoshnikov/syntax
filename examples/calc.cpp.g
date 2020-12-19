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

%left '+'
%left '*'

%%

E
  : E '+' E
  | E '*' E
  | '(' E ')'
  | NUMBER
  ;