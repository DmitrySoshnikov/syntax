/**
 * Module includes. Ruby version.
 *
 * The "moduleInclude" directive allows including an arbitrary code at the
 * beginning of the generated parser file. As an example, can be the code
 * to require modules for corresponding AST nodes, or direct AST nodes
 * definitions.
 *
 * The code may define callbacks for several parse events, in particular
 * `on_parse_begin`, and `on_parse_end`:
 *
 *   YYParse.on_parse_begin {|string|
 *     puts 'Parsing: ' + string
 *   }
 *
 * ./bin/syntax -g ./examples/module-include.rb.g -m slr1 -o './CalcParser.rb'
 *
 *   require '<path-to>/CalcParser.rb'
 *
 *   puts CalcParser.parse('2 + 2 * 2')
 *
 * Custom hook on parse begin. Parsing: 2 + 2 * 2
 * Custom hook on parse end. Parsed: #<BinaryExpression:0x007fda0b0ad880>
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

    class Node
      attr_accessor :type

      def initialize(type)
        @type = type
      end
    end

    class BinaryExpression < Node
      attr_accessor :left
      attr_accessor :right
      attr_accessor :op

      def initialize(left, right, op)
        super('Binary')
        @@left = left
        @right = right
        @op = op
      end
    end

    class PrimaryExpression < Node
      attr_accessor :value

      def initialize(value)
        super('Primary')
        @value = value.to_i
      end
    end

    # Standard hook on parse beging, and end:

    YYParse.on_parse_begin {|string|
      puts 'Custom hook on parse begin. Parsing: ' + string
    }

    YYParse.on_parse_end {|value|
      puts 'Custom hook on parse end. Parsed: ' + value.inspect
    }
  `,

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = BinaryExpression.new($1, $3, $2)"],
      ["E * E",  "$$ = BinaryExpression.new($1, $3, $2)"],
      ["NUMBER", "$$ = PrimaryExpression.new($1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}