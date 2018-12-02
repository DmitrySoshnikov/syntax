## How to build a parser for Java

Below are the guiding steps how to build a working LR-parser for Java.

### 0. Prerequisite: install Syntax tool

```
npm install -g syntax-cli
```

> NOTE: `npm` comes pre-installed with [Node.js](https://nodejs.org/en/)

### 1. Create a project directory

```
mkdir java_syntax_parser
cd java_syntax_parser
```

### 2. Create parser package

By default Syntax tool generates parser package as `com.syntax`. You can change it to any, however, let's use the default one in our example.

Create the `com.syntax`:

```
mkdir -p com/syntax
```

### 4. Create grammar file

We use simple calculator grammar for the example. Create the `com/syntax/grammar.g`, and add the following:

```
/**
 * Calculator grammar to generate parser in Java.
 */

%lex

%%

// -----------------------------------------------
// Lexical grammar.
//
// Uses regexp to produce list of tokens.
// Return values is a token type.

\s+     /* skip whitespace */ return null;
\d+     return "NUMBER";

/**
 * Simple tokens like '*', '(', etc can be omitted here, and used inline
 * however, define them here as well:
 */

"+"     return "+";
"*"     return "*";

"("     return "(";
")"     return ")";

/lex

// -----------------------------------------------
// Operator precedence.
//
// The `*` goes after `+`, so `2 + 2 * 2` is
// correctly parsed as `2 + (2 * 2)`.
//
// Also both are left-associative, meaning
// `2 + 2 + 2` is `(2 + 2) + 2`, which is important
// when we build AST nodes.

%left +
%left *

// -----------------------------------------------
// Module include.
//
// The code which is included "as is" to the generated
// parser. Can contain `ParserEvents` class to subscribe to
// needed parsing events.

%{

/**
 * The ParserEvents class allows subscribing to
 * different parsing events.
 */
class ParserEvents {
  public static void init() {
    System.out.println("Parser is created.");
  }

  public static void onParseBegin(String str) {
    System.out.println("Parsing is started: " + str);
  }

  public static void onParseEnd(Object result) {
    System.out.println("Parsing is completed: " + result);
  }
}

%}

%%

// -----------------------------------------------
// Syntactic grammar (BNF).
//
// Defines an actual syntactic structure of
// our program.

Expr

    // ---------------------------------------
    // Addition

    : Expr + Expr {

        $$ = (Integer)$1 + (Integer)$3
    }

    // ---------------------------------------
    // Multiplication

    | Expr * Expr {

        $$ = (Integer)$1 * (Integer)$3
    }

    // ---------------------------------------
    // Simple number

    | NUMBER {

        $$ = Integer.valueOf(yytext)
    }

    // ---------------------------------------
    // Grouping in parens

    | ( Expr ) {

        $$ = $2

    };
```

> NOTE: here we used example in Bison/Yacc format. You can also check [the example](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/calc.java.g) in JSON format.

Since Rust is a strongly and (mostly) statically typed language, we need to define _types_ of all the _used_ arguments in production handlers. They are defined in the Rust’s closure notation.

The production handler arguments, such as `$1`, `$2`, etc after of the generic `Object` type. That's why we need to manually cast them to needed types in certain operations. For example:

```
$$ = (Integer)$1 + (Integer)$3
```

### 5. Generate the parser

Now using _Syntax_ tool, generate the parser from the grammar:

```
syntax-cli -g syntax/grammar.g -m LALR1 -o com/syntax/CalcParser.java

    ✓ Successfully generated: com/syntax/CalcParser.java
```

You can specify any name of the generated parser, here we chose the `CalcParser.java`. We also use `LALR(1)` parsing mode, which is the most practical.

### 6. Use the parser

Let's create the main testing class, and require the parser from it.

Create the `java_syntax_parser/SyntaxTest.java`, and add the:


```java
import com.syntax.*;
import java.text.ParseException;

public class SyntaxTest {
  public static void main(String[] args) {

    CalcParser calcParser = new CalcParser();

    try {
      System.out.println(calcParser.parse("2 + 2 * 2")); // 6
      System.out.println(calcParser.parse("(2 + 2) * 2")); // 8
    } catch (ParseException e) {
      e.printStackTrace();
    }
  }
}
```

Check the result:

```
javac SyntaxTest.java && java SyntaxTest
    ....

    6
    8
```

Above we used a direct evaluation of the expression, however, you can easily build an AST for the code. Check out [this example](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/calc-ast-java.bnf) which builds a tree of nodes for math expressions.