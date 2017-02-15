/**
 * Change lexer state from parser.
 *
 * Note: a tokenizer can be accessed in a semantic action as `yy.lexer`,
 * or `yy.tokenizer`.
 *
 * The grammar below solves the problem of parsing { } in statement position as
 * a "BlockStatement", and in the expression position as an "ObjectLiteral".
 *
 * Note: there are several other techniques for solving this: lookahead
 * restriction productions, or cover grammar.
 *
 * Example in the statement position:
 *
 *   ./bin/syntax -g examples/parser-lexer-communication.g -m lalr1 -p '{ 1; 2; }'
 *
 *   ✓ Accepted
 *
 *   Parsed value:
 *
 *   {
 *     "type": "Program",
 *     "body": [
 *       {
 *         "type": "BlockStatement",
 *         "body": [
 *           "1",
 *           "2"
 *         ]
 *       }
 *     ]
 *   }
 *
 * Two empty blocks:
 *
 *   ./bin/syntax -g examples/parser-lexer-communication.g -m lalr1 -p '{{}}'
 *
 * Exaple in the expression position:
 *
 *   ./bin/syntax -g examples/parser-lexer-communication.g -m lalr1 -p '({ 1, 2 });'
 *
 *    ✓ Accepted
 *
 *   Parsed value:
 *
 *   {
 *     "type": "Program",
 *     "body": [
 *       {
 *         "type": "ObjectLiteral",
 *         "properties": [
 *           "1",
 *           "2"
 *         ]
 *       }
 *     ]
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
    Program:              [[`StatmentList`,                 `$$ = {type: 'Program', body: $1}`]],

    StatmentList:         [[`Statment`,                     `$$ = [$1]`],
                           [`StatmentList Statment`,        `$$ = $1; $1.push($2)`]],

    Statment:             [[`BlockStatement`,               `$$ = $1`],
                           [`ExpressionStatement`,          `$$ = $1`]],

    BlockStatement:       [[`{ OptStatmentList }`,          `$$ = {type: 'BlockStatement', body: $2}`]],

    OptStatmentList:      [[`StatmentList`,                 `$$ = $1`],
                           [`ε`,                            `$$ = null`]],

    ExpressionStatement:  [[`Expression ;`,                 `$$ = $1`]],

    Expression:           [[`expressionBegin ExpressionNode expressionEnd`,
                            `$$ = $2`]],

    // Special "activation productions". They activate needed lexer state,
    // so the later can yield different token types for the same chars.

    expressionBegin:      [[`ε`,                            `yy.lexer.pushState('expression')`]],
    expressionEnd:        [[`ε`,                            `yy.lexer.popState()`]],

    ExpressionNode:       [[`NumericLiteral`,               `$$ = $1`],
                           [`ObjectLiteral`,                `$$ = $1`],
                           [`( Expression )`,               `$$ = $2`]],

    NumericLiteral:       [[`NUMBER`,                       `$$ = $1`]],

    ObjectLiteral:        [[`%{ OptPropertyList }%`,        `$$ = {type: 'ObjectLiteral', properties: $2}`]],

    OptPropertyList:      [[`PropertyList`,                 `$$ = $1`],
                           [`ε`,                            `$$ = null`]],

    PropertyList:         [[`Property`,                     `$$ = [$1]`],
                           [`PropertyList , Property`,      `$$ = $1; $1.push($3)`]],

    Property:             [`NumericLiteral`,                `$$ = $1`],
  }
}