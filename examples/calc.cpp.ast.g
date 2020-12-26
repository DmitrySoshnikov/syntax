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

#include <iostream>
#include <memory>

/**
 * Base class for AST nodes.
 */
class Node {};

/**
 * Binary expressions.
 */
class BinaryExpression : public Node {
 public:
  BinaryExpression(std::string op, Node* left, Node* right)
    : op(op), left(left), right(right) {}

  std::string op;
  Node* left;
  Node* right;
};

/**
 * AST node for numbers.
 */
class NumericLiteral : public Node {
 public:
  NumericLiteral(int value): value(value) {}
  int value;
};

// Type of the parsing value.
using Value = Node*;


// On parser begin hook:
void onParseBegin(const std::string& str) {
  std::cout << "Parsing: " << str << "\n";
}

// On parser end hook:
void onParseEnd(Node* result) {
  std::cout << "Result: " << result << "\n";
}


%}


%left '+'
%left '*'

%%

E
  : E '+' E
    { $$ = new BinaryExpression($2, $1, $3) }

  | E '*' E
    { $$ = new BinaryExpression($2, $1, $3) }

  | '(' E ')' { $$ = $2 }

  | NUMBER
    { $$ = new NumericLiteral(std::stoi($1)) }
  ;