/**
 * Module includes. PHP version.
 *
 * The "moduleInclude" directive allows including an arbitrary code at the
 * beginning of the generated parser file. As an example, can be the code
 * to require modules for corresponding AST nodes, or direct AST nodes
 * definitions.
 *
 * The code may define callbacks for several parse events, in particular
 * `onParseBegin`, and `onParseEnd`, attaching to `yyparse`:
 *
 *   yyparse::setOnParseBegin(function($string) {
 *   var_dump('Parsing:', $string);
 *   });
 *
 * ./bin/syntax -g ./examples/module-include.php.g -m slr1 -o './Parser.php'
 *
 * <?php
 *
 *   require('Parser.php');
 *
 *   var_dump(Parser::parse('2 + 2 * 2'));
 *
 * string(36) "Custom hook on parse begin. Parsing:"
 * string(9) "2 + 2 * 2"
 * string(33) "Custom hook on parse end. Parsed:"
 *
 * object(BinaryExpression)#8 (4) {
 *   ["type"]=>
 *   string(6) "Binary"
 *   ["left"]=>
 *   object(PrimaryExpression)#4 (2) {
 *     ["type"]=>
 *     string(7) "Primary"
 *     ["value"]=>
 *     int(2)
 *   }
 *   ["right"]=>
 *   object(BinaryExpression)#7 (4) {
 *     ["type"]=>
 *     string(6) "Binary"
 *     ["left"]=>
 *     object(PrimaryExpression)#5 (2) {
 *       ["type"]=>
 *       string(7) "Primary"
 *       ["value"]=>
 *       int(2)
 *     }
 *     ["right"]=>
 *     object(PrimaryExpression)#6 (2) {
 *       ["type"]=>
 *       string(7) "Primary"
 *       ["value"]=>
 *       int(2)
 *     }
 *     ["op"]=>
 *     string(1) "*"
 *   }
 *   ["op"]=>
 *   string(1) "+"
 * }
 */

{
  "lex": {
    "rules": [
      ["\\s+",  "/* skip whitespace */"],
      ["\\d+",  "return 'NUMBER'"],
      ["\\*",   "return '*'"],
      ["\\+",   "return '+'"],
      ["\\(",   "return '('"],
      ["\\)",   "return ')'"],
    ]
  },

  "moduleInclude": `
    // Can be "require" statments, or direct declarations.

    class Node {
      public function __construct($type) {
        $this->type = $type;
      }
    }

    class BinaryExpression extends Node {
      public function __construct($left, $right, $op) {
        parent::__construct('Binary');
        $this->left = $left;
        $this->right = $right;
        $this->op = $op;
      }
    }

    class PrimaryExpression extends Node {
      public function __construct($value) {
        parent::__construct('Primary');
        $this->value = intval($value);
      }
    }

    // Standard hook on parse beging, and end:

    yyparse::setOnParseBegin(function($string) {
      var_dump('Custom hook on parse begin. Parsing:', $string);
    });

    yyparse::setOnParseEnd(function($value) {
      var_dump('Custom hook on parse end. Parsed:', $value);
    });
  `,

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = new BinaryExpression($1, $3, $2)"],
      ["E * E",  "$$ = new BinaryExpression($1, $3, $2)"],
      ["NUMBER", "$$ = new PrimaryExpression($1)"],
      ["( E )",  "$$ = $1"],
    ],
  },
}