/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import vm from 'vm';

const SANDBOX = Object.assign(global, {
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
   * Creates location object.
   */
  yyloc(start, end) {
    // Epsilon doesn't produce location.
    if (!start || !end) {
      return start || end;
    }

    return {
      startOffset: start.startOffset,
      endOffset: end.endOffset,
      startLine: start.startLine,
      endLine: end.endLine,
      startColumn: start.startColumn,
      endColumn: end.endColumn,
    };
  },

  /**
   * Result value of production handlers, used as $$.
   */
  __: null,

  /**
   * Result node location object.
   */
  __loc: null,

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
   * Evaluates the code. If `shouldRewrite` is `true` (default),
   * rewrites $1, $2, $$, etc. to _1, _2, __, etc.
   */
  eval(code, shouldRewrite = true) {
    if (shouldRewrite) {
      code = this._rewriteParamsInCode(code);
    }
    return vm.runInContext(code, context);
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
  createProductionParamsArray({production, captureLocations}) {
    if (production.isEpsilon()) {
      return [];
    }

    const symbols = production
      .getRHS()
      .map(symbol => symbol.getSymbol());

    // $1, $2, ...
    let semanticValues = [];

    // @1, @2, ...
    let locations = captureLocations ? [] : null;

    for (var i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const semanticValue = `_${i + 1}`;

      semanticValues.push(semanticValue);

      if (captureLocations) {
        locations.push(`${semanticValue}loc`);
      }
    }

    const params = captureLocations
      ? semanticValues.concat(locations)
      : semanticValues;

    return params;
  },

  /**
   * See `createProductionParamsArray`.
   */
  createProductionParams({production, captureLocations}) {
    return this.createProductionParamsArray({
      production,
      captureLocations,
    }).join(', ');
  },

  /**
   * Creates default location prologue to semantic action. Begin is
   * taken from first symbol on RHS, the end -- from the last one.
   *
   * @$.startOffset = @1.startOffset
   * @$.endOffset = @1.endOffset
   * ...
   */
  createLocationPrologue(production) {
    if (production.isEpsilon()) {
      return '__loc = null;';
    }

    const start = 1;
    const end = production.getRHS().length;

    return `__loc = yyloc(_${start}loc, _${end}loc);`;
  },

  /**
   * Creates a handler for a production. Attaches default
   * location prologue (user code can override it).
   */
  createProductionHandler({production, captureLocations}) {
    const params = this.createProductionParams({production, captureLocations});

    const locationPrologue = captureLocations
      ? this.createLocationPrologue(production)
      : '';

    const action = production.getRawSemanticAction();

    return this.createHandler(
      params,
      locationPrologue + action,
    );
  },

  /**
   * Rewrites $1, @1, $name to _1, _1loc, _name
   */
  _rewriteParamsInCode(code) {
    return code
      .replace(/\$(\d+)/g, '_$1')
      .replace(/@(\d+)/g, '_$1loc')
      .replace(/\$\$/g, '__')
      .replace(/@\$/g, '__loc');
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

