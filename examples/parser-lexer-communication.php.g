/**
 * Change lexer state from parser. PHP version..
 *
 * Note: a tokenizer can be accessed in a semantic action as `yy::$lexer`,
 * or `yy::$tokenizer`.
 *
 * The grammar below solves the problem of parsing { } in statement position as
 * a "BlockStatement", and in the expression position as an "ObjectLiteral".
 *
 * Note: there are several other techniques for solving this: lookahead
 * restriction productions, or cover grammar.
 *
 * Example in the statement position:
 *
 *   ./bin/syntax -g examples/parser-lexer-communication.php.g -m lalr1 -o ~/Parser.php
 *
 *   Parser::parse('{ 1; 2; }');
 *
 *   array(2) {
 *     ["type"]=>
 *     string(7) "Program"
 *     ["body"]=>
 *     array(1) {
 *       [0]=>
 *       array(2) {
 *         ["type"]=>
 *         string(14) "BlockStatement"
 *         ["body"]=>
 *         array(2) {
 *           [0]=>
 *           string(1) "1"
 *           [1]=>
 *           string(1) "2"
 *         }
 *       }
 *     }
 *   }
 *
 * Exaple in the expression position:
 *
 *   ./bin/syntax -g examples/parser-lexer-communication.php.g -m lalr1 -o ~/Parser.php
 *
 *   Parser::parse('({ 1, 2 });');
 *
 *   array(2) {
 *     ["type"]=>
 *     string(7) "Program"
 *     ["body"]=>
 *     array(1) {
 *       [0]=>
 *       array(2) {
 *         ["type"]=>
 *         string(13) "ObjectLiteral"
 *         ["properties"]=>
 *         array(2) {
 *           [0]=>
 *           string(1) "1"
 *           [1]=>
 *           string(1) "2"
 *         }
 *       }
 *     }
 *   }
 */

{
  // --------------------------------------------------
  // Lexical grammar.

  lex: {

    // Lexer states.
    startConditions: {
      expression: 0,
    },

    rules: [
      [`\\s+`,                    `/* skip whitespace */`],

      // { and } in the expression position yield different token types:

      [['expression'], `\\{`,     `return '%{'`],
      [['expression'], `\\}`,     `return '}%'`],

      // { and } in the statement position yield default token types:

      [`\\{`,                     `return '{'`],
      [`\\}`,                     `return '}'`],

      [`\\d+`,                    `return 'NUMBER'`],

      [`;`,                       `return ';'`],
      [`,`,                       `return ','`],

      [`\\(`,                     `return '('`],
      [`\\)`,                     `return ')'`],
    ],
  },

  // --------------------------------------------------
  // Syntactic grammar.

  bnf: {
    Program:              [[`StatmentList`,                 `$$ = array('type' => 'Program', 'body' => $1)`]],

    StatmentList:         [[`Statment`,                     `$$ = [$1]`],
                           [`StatmentList Statment`,        `array_push($1, $2); $$ = $1;`]],

    Statment:             [[`BlockStatement`,               `$$ = $1`],
                           [`ExpressionStatement`,          `$$ = $1`]],

    BlockStatement:       [[`{ OptStatmentList }`,          `$$ = array('type' => 'BlockStatement', 'body' => $2)`]],

    OptStatmentList:      [[`StatmentList`,                 `$$ = $1`],
                           [`ε`,                            `$$ = null`]],

    ExpressionStatement:  [[`Expression ;`,                 `$$ = $1`]],

    Expression:           [[`expressionBegin ExpressionNode expressionEnd`,
                            `$$ = $2`]],

    // Special "activation productions". They activate needed lexer state,
    // so the later can yield different token types for the same chars.

    expressionBegin:      [[`ε`,                            `yy::$lexer->pushState('expression');`]],
    expressionEnd:        [[`ε`,                            `yy::$lexer->popState();`]],

    ExpressionNode:       [[`NumericLiteral`,               `$$ = $1`],
                           [`ObjectLiteral`,                `$$ = $1`],
                           [`( Expression )`,               `$$ = $2`]],

    NumericLiteral:       [[`NUMBER`,                       `$$ = $1`]],

    ObjectLiteral:        [[`%{ OptPropertyList }%`,        `$$ = array('type' => 'ObjectLiteral', 'properties' => $2)`]],

    OptPropertyList:      [[`PropertyList`,                 `$$ = $1`],
                           [`ε`,                            `$$ = null`]],

    PropertyList:         [[`Property`,                     `$$ = [$1]`],
                           [`PropertyList , Property`,      `array_push($1, $3); $$ = $1;`]],

    Property:             [`NumericLiteral`,                `$$ = $1`],
  }
}