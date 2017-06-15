/**
 * Generated parser in Rust.
 *
 * ./bin/syntax -g examples/calc-ast.rs.g -m lalr1 -o lib.rs
 *
 * use syntax::Parser;
 *
 * let parser = Parser::new();
 *
 * let ast = parser.parse("2 + 2 * 2");
 */

%lex

%%

\s+         /* skip whitespace */ return "";

\d+         return "NUMBER";

"+"         return "+";
"*"         return "*";

"("         return "(";
")"         return ")";

/lex

%left +
%left *

%{

/**
 * Recursive generic `Node` enum structure.
 */
#[derive(Debug)]
pub enum Node {

    Literal(i32),

    Binary {
        op: &'static str,
        left: Box<Node>,
        right: Box<Node>,
    },
}

/**
 * Final result type returned from `parse` method call.
 */
pub type TResult = Node;

/**
 * Hook executed on parse begin.
 */
fn on_parse_begin(parser: &mut Parser, string: &'static str) {
    println!("Parsing: {:?}", string);
}

/**
 * Hook executed on parse end.
 */
fn on_parse_end(parser: &mut Parser, result: &TResult) {
    println!("Parsed: {:?}", result);
}

%}

%%

Expr
    : Expr + Expr {

        // Types of used args ($1, $2, ...), and return type:
        |$1: Node; $3: Node| -> Node;

        $$ = Node::Binary {
            op: "+",
            left: Box::new($1),
            right: Box::new($3),
        }
    }

    | Expr * Expr {

        |$1: Node; $3: Node| -> Node;

        $$ = Node::Binary {
            op: "*",
            left: Box::new($1),
            right: Box::new($3),
        }
    }

    | ( Expr ) {

        // No need to define argument types, since we don't do any
        // operations here, and just propagate $2 further.

        $$ = $2;

    }

    | NUMBER {

        || -> Node;

        let n = yytext.parse::<i32>().unwrap();

        $$ = Node::Literal(n);

    };

