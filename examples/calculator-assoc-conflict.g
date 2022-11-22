%%

/**
 * This grammar has "shift-reduce" conflicts. See how to resolve them using
 * operators precedence in the `./examples/calculator-assoc.g`.
 *
 * Also automatic conflicts resolution is possible (see `--resolve-conflicts`
 * flag), however it may not always help, and a more correct way is to specify
 * precedence and associativity, or to rewrite grammar.
 */

E
  : E '+' E
  | E '*' E
  | 'id'
  ;
