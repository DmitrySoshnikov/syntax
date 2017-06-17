## How to build a parser for Rust

Below are the guiding steps how to build a working parser for Rust programming language.

### 0. Prerequisite: install Syntax tool

```
npm install -g syntax-cli
```

> NOTE: `npm` comes pre-installed with [Node.js](https://nodejs.org/en/)

### 1. Create new cargo project

```
cargo new calc-parser --bin
    Created binary (application) `calc-parser` project

cd calc-parser
```

### 2. Create a local library crate

Let's call it `syntax`:

```
cargo new syntax
    Created library `syntax` project
```

And add it to the dependencies list of the main app. In the `Cargo.toml`:

```
[dependencies]
syntax = { path = "syntax" }
```

### 3. Configure dependencies of the `syntax` crate

_Syntax_ tool generates a parser which depends on two external crates: [regex](https://doc.rust-lang.org/regex/regex/index.html), and [lazy_static](https://crates.io/crates/lazy_static). Let's add them to our `syntax` library dependencies list.

In the `syntax/Cargo.toml` add:

```
[dependencies]
regex = "0.2"
lazy_static = "0.2.8"
```

### 4. Create grammar file

We use simple calculator grammar for the example. In the `syntax/grammar.g` add:

```
/**
 * Calculator grammar to generate parser in Rust.
 */

%lex

%%

// -----------------------------------------------
// Lexical grammar.
//
// Uses regexp to produce list of tokens.
// Return values is a token type.

\s+     /* skip whitespace */ return "";
\d+     return "NUMBER";

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
// parser. Should at least contain `TResult` -- the
// type of the final parsed value.

%{

// Important: define the type of the parsing result:

type TResult = i32;

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

        // Types of used args, and the return type.
        |$1: i32, $3: i32| -> i32;

        $$ = $1 + $3
    }

    // ---------------------------------------
    // Multiplication

    | Expr * Expr {

        |$1: i32, $3: i32| -> i32;

        $$ = $1 * $3
    }

    // ---------------------------------------
    // Simple number

    | NUMBER {

        || -> i32;

        $$ = yytext.parse::<i32>().unwrap()
    }

    // ---------------------------------------
    // Grouping in parens

    | ( Expr ) {

        $$ = $2

    };
```

> NOTE: here we used example in Bison/Yacc format. You can also check [the example](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/calc.rs.g) in JSON format.

Since Rust is a strongly and (mostly) statically typed language, we need to define _types_ of all the _used_ arguments in production handlers. They are defined in the Rust’s closure notation.

For example, before being able to do a mathematical operation of `$$ = $1 + $3` in the first `Expr + Expr` production, we need to define the types of the used arguments, and the result type:

```
|$1: i32, $3: i32| -> i32;
```

If the argument is just propagated without any operation, the type declarations can be omitted, as in the last production `( Expr )` where we just return the `$$ = $2`.

Notice also, that in the third `NUMBER` production, we get direct matched token value via the `yytext` variable. Since we don't use arguments, the type declaration of the production defines only return type, having empty arguments:

```
|| -> i32;
```

We could also access the matched token via the `$1.value`, and for this the type declaration would be `|$1: Token| -> i32`.

### 5. Generate the parser

Now using _Syntax_ tool, let's generate the parser from our grammar:

```
syntax-cli -g syntax/grammar.g -m LALR1 -o syntax/src/lib.rs

    ✓ Successfully generated: syntax/src/lib.rs
```

Notice how we specified output file to be the `lib.rs` from our `syntax` crate. We also chose `LALR(1)` parsing mode, which is the most practical one.

### 6. Use the parser

Now in the `main.rs` we can require an use the parser:


```rust
extern crate syntax;

use syntax::Parser;

fn main() {
    let mut parser = Parser::new();

    let result = parser.parse("2 + 2 * 2");
    println!("{:?}", result); // 6
}
```

Check the result:

```
cargo run
    ....

    6
```

Above we used a direct evaluation of the expression, however, you can easily build an AST for the code. Check out [this example](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/calc-ast.rs.g) which builds a tree of nodes for math expressions.