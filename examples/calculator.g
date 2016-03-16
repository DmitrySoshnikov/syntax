/**
 * Example:
 *
 *   ./bin/syntax \
 *     --grammar examples/calculator.g \
 *     --mode slr1
 *     --parse '(id + id) * id'
 *     --ignore-whitespaces
 */

%%

E -> E '+' T
   | T
   ;

T -> T '*' F
   | F
   ;

F -> 'id'
   | '(' E ')'
   ;