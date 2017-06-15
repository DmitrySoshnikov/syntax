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

\s+     /* skip whitespace */ return "";
\d+     return "NUMBER";

"+"     return "+";
"*"     return "*";

"("     return "(";
")"     return ")";

/lex

%left +
%left *

%{

// Important: define the type of the parsing result:

type TResult = i32;

%}

%%

Expr

    // ---------------------------------------
    // Addition

    : Expr + Expr {

        |$1: i32, $3: i32| -> i32;

        $$ = $1 + $2
    }

    // ---------------------------------------
    // Multiplication

    | Expr * Expr {

        |$1: i32, $3: i32| -> i32;

        $$ = $1 * $2
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

### 5. Generate the parser

Now using _Syntax_ tool, let's generate the parser from our grammar:

```
syntax-cli -g syntax/grammar.g -m LALR1 -o syntax/src/lib.rs

    ✓ Successfully generated: syntax/src/lib.rs
```

Notice how we specified output file to be the `lib.rs` from our `syntax` crate. We also chose `LALR(1)` parsing mode, which is the most practical one.

### 6. Use the parser

Now in the `main.rs` we can require an use the parser:


```js
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