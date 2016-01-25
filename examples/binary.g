/**
 * Binary numbers.
 *
 * Example:
 *
 *   ./bin/syntax --parse '101001101' --table --mode slr1
 */

N -> L
L -> L B
   | B
B -> '1'
   | '0'