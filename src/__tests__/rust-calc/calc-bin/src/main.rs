extern crate calc_syntax;

use calc_syntax::Parser;

fn main() {
    let mut parser = Parser::new();

    let parse_string = String::from("2 + 2 * 2");
    let result = parser.parse(&parse_string);

    println!("parse result: {}", result);
}
