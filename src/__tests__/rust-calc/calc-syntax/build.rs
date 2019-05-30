use std::process::Command;

fn main() {
    Command::new("make")
        .status()
        .unwrap();
    println!("act-file parser lib successfully generated");
}