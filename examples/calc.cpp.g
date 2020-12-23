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

struct Value {
  int data;
  Value operator+(Value& other) {
    return Value{data + other.data};
  }
  Value operator*(Value& other) {
    return Value{data * other.data};
  }
};

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