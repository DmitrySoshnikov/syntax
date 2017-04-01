/**
 * Word boundary example: `if` keyword vs. `ifi` identifier.
 *
 * ./bin/syntax -g examples/word-boundary.g -m lalr1 -p 'if'
 *   > id-keyword
 *
 * ./bin/syntax -g examples/word-boundary.g -m lalr1 -p 'ifi'
 *   > identifier
 */

%lex

%%

'if'\b          return 'IF'
\w+             return 'ID'

/lex

%%

Program
  : IF { $$ = 'if-keyword' }
  | ID { $$ = 'identifier' }
  ;
