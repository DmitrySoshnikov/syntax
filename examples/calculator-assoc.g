/*

Precedence and associativity rules:

- If the token's precedence is higher, the choice is to shift:

    E -> E + E •
    E -> E • * E (choose to shift on `*` since its precedence is higher than of `+`)

- If the rule's precedence is higher, the choice is to reduce:

    E -> E * E • (choose to reduce since precedence of the production is higher than of `+`)
    E -> E • + E

- If they have equal precedence, the choice is made based on the associativity of that precedence level:

    E -> E * E • (choose to reduce since precedence is the same `*` is left-associative)
    E -> E • * E

  This case we want `id * id * id` to be left-associative, i.e.
  `(id * id) * id`, not right-associative, that would be `id * (id * id)`.

*/

{
    "lex": {
        "rules": [
            ["id",  "return 'id'"],
            ["\\*", "return '*'"],
            ["\\+", "return '+'"]
        ]
    },

    "operators": [
        ["left", "+"],
        ["left", "*"]
    ],

    "bnf": {
        "E": [
            "E + E",
            "E * E",
            "id"
        ]
    }
}