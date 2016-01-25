/**
 * Tokens `PLUS` and `ZERO` automatically infered.
 *
 *   ./bin/syntax --grammar examples/auto-tokens.g --mode slr1 --table
 */

E -> E PLUS T
   | T

T -> ZERO