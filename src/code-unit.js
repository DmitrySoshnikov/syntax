/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import vm from 'vm';

const SANDBOX = Object.assign(Object.create(global), {
  /**
   * Matched text of the tokenizer.
   */
  yytext: '',

  /**
   * Length of the matched text.
   */
  yyleng: 0,

  /**
   * Extra global object lex rules, and other handlers
   * may use to track any needed state across the handlers.
   */
  yy: {},

  /**
   * Stores different parse callbacks.
   */
  yyparse: {
    onParseBegin: () => {},
    onParseEnd: () => {},
  },

  /**
   * Result value of production handlers, used as $$.
   */
  __: null,

  /**
   * To require modules.
   */
  require,
});

/**
 * Execution context.
 */
const context = new vm.createContext(SANDBOX);

/**
 * Evaluation unit for different handlers (of lex rules, productions, etc),
 * which shares the same global space via sandbox.
 */
const CodeUnit = {
  /**
   * Sets value to bindings.
   */
  setBindings(bindings) {
    Object.assign(SANDBOX, bindings);
  },

  /**
   * Evaluates the code.
   */
  eval(code) {
    return vm.runInContext(this._rewriteParamsInCode(code), context);
  },

  /**
   * Creates parameters string for a semantic action.
   *
   * Consists of: positioned arguments, named arguments,
   * and location data.
   *
   * Example of using the arguments in a handler:
   *
   * $1, $2, $expr, $term, @1, @2
   *
   * Created parameters: _1, _2, _expr, _term, _1loc, _2loc
   */
  createProductionParams(production) {
    const symbols = production
      .getRHS()
      .map(symbol => symbol.getSymbol());

    let positioned = [];
    let named = [];
    let locations = [];

    const idRe = /^[a-zA-Z][a-zA-Z0-9]*$/;

    for (var i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const index = i + 1;

      positioned.push(`_${index}`);
      named.push(idRe.test(symbol) ? `_${symbol}` : `_named${index}`);
      locations.push(`_${index}loc`);
    }

    return positioned
      .concat(named, locations)
      .join(', ');
  },

  /**
   * Creates a handler for a production.
   */
  createProductionHandler(production) {
    return this.createHandler(
      this.createProductionParams(production),
      this._rewriteParamsInCode(production.getRawSemanticAction()),
    );
  },

  /**
   * Rewrites $1, @1 to _1, _1loc
   */
  _rewriteParamsInCode(code) {
    return code
      .replace(/\$([0-9a-zA-Z]+)/g, '_$1')
      .replace(/@(\d+)/g, '_$1loc')
      .replace(/\$\$/g, '__');
  },

  /**
   * Creates a handler function with code, and parameters.
   */
  createHandler(parameters, code) {
    return this.eval(`(function(${parameters}) { ${code} })`);
  },

  /**
   * Returns evaluation sandbox.
   */
  getSandbox() {
    return SANDBOX;
  }
};

export default CodeUnit;

