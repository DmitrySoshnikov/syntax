/**
 * Module includes. Python version.
 *
 * The "moduleInclude" directive allows including an arbitrary code at the
 * beginning of the generated parser file. As an example, can be the code
 * to require modules for corresponding AST nodes, or direct AST nodes
 * definitions.
 *
 * The code may define callbacks for several parse events, in particular
 * `on_parse_begin`, and `on_parse_end`:
 *
 *   def on_parse_begin(string):
 *       print('Parsing:', string)
 *
 * ./bin/syntax -g ./examples/module-include.py.g -m slr1 -o './parser.py'
 *
 * >>> import parser
 * >>> parser.parse('2 + 2 * 2')
 *
 * ('Custom hook on parse begin. Parsing:', '2 + 2 * 2')
 * ('Custom hook on parse end. Parsed:', <test.BinaryExpression object at 0x10d1ace10>)
 * <test.BinaryExpression object at 0x10d1ace10>
 */

{
  "lex": {
    "rules": [
      ["\\s+",  "# skip whitespace"],
      ["\\d+",  "return 'NUMBER'"],
      ["\\*",   "return '*'"],
      ["\\+",   "return '+'"],
      ["\\(",   "return '('"],
      ["\\)",   "return ')'"],
    ]
  },

  "moduleInclude": `
    # Can be "require" statments, or direct declarations.

    class Node(object):
        def __init__(self, type):
            self.type = type

    class BinaryExpression(Node):
        def __init__(self, left, right, op):
            super(BinaryExpression, self).__init__('Binary')
            self.left = left
            self.right = right
            self.op = op

    class PrimaryExpression(Node):
        def __init__(self, value):
            super(PrimaryExpression, self).__init__('Primary')
            self.value = int(value)

    # Standard hook on parse beging, and end:

    _string = None

    def on_parse_begin(string):
        global _string
        _string = string
        print('Custom hook on parse begin. Parsing:', string)

    def on_parse_end(value):
        print('Custom hook on parse end. Parsed:', value)

        if _string != '2 + 2 * 2':
            return

        assert isinstance(value, BinaryExpression)
        assert value.op == '+'

        assert isinstance(value.left, PrimaryExpression)
        assert value.left.value == 2
        assert isinstance(value.right, BinaryExpression)

        assert value.right.op == '*'
        assert isinstance(value.right.left, PrimaryExpression)
        assert isinstance(value.right.right, PrimaryExpression)
        assert value.right.left.value == 2
        assert value.right.right.value == 2

        print('All assertions are passed!')
  `,

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = BinaryExpression($1, $3, $2)"],
      ["E * E",  "$$ = BinaryExpression($1, $3, $2)"],
      ["NUMBER", "$$ = PrimaryExpression($1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}