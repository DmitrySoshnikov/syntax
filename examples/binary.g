/**
 * Binary numbers.
 *
 * Example:
 *
 *   ./bin/syntax -g examples/binary.g -p '101001101' -t -m slr1
 */

%%

N -> L;

L -> L B
   | B
   ;

B -> '1'
   | '0'
   ;