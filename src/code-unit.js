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
   * Return value of production handlers.
   */
  $$: null,

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
    return vm.runInContext(code, context);
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

