/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from '../code-unit';

const environment = CodeUnit.getSandbox();

function MockSymbol(symbol) {
  return {
    getSymbol() {
      return symbol;
    },
  };
}

function MockProduction(RHS, handler = '$$ = $1 + $3', isEpsilon = false) {
  return {
    getRHS() {
      return RHS.map(symbol => MockSymbol(symbol));
    },

    getRawSemanticAction() {
      return handler;
    },

    isEpsilon() {
      return isEpsilon;
    }
  };
}

const defaultLoc = {
  startOffset: 1,
  endOffset: 2,
  startLine: 1,
  endLine: 1,
  startColumn: 1,
  endColumn: 2,
};

describe('code-unit', () => {

  it('default bindings', () => {
    expect(environment.yytext).toBe('');
    expect(environment.yyleng).toBe(0);
    expect(environment.yy).toEqual({});

    expect(environment.yyparse).not.toBe(null);
    expect(typeof environment.yyparse.onParseBegin).toBe('function');
    expect(typeof environment.yyparse.onParseEnd).toBe('function');

    expect(environment.__).toBe(null);
    expect(typeof environment.require).toBe('function');
  });

  it('create handler', () => {
    const handler = CodeUnit.createHandler('$1, $2', '$$ = $1 + $2');
    expect(typeof handler).toBe('function');

    handler(1, 2);
    expect(environment.__).toBe(3);
  });

  it('shared sandbox', () => {
    expect(environment).toBe(CodeUnit.getSandbox());
  });

  it('eval', () => {
    CodeUnit.eval('$$ = 2 * 5');
    expect(environment.__).toBe(10);
  });

  it('production action parameters', () => {
    let production = MockProduction(['additive', 'PLUS', 'multiplicative']);

    expect(CodeUnit.createProductionParams({production}))
      .toBe('_1, _2, _3');

    expect(CodeUnit.createProductionParams({
      production,
      captureLocations: true,
    }))
      .toBe('_1, _2, _3, _1loc, _2loc, _3loc');
  });

  it('production handler', () => {
    const production = MockProduction(['additive', 'PLUS', 'multiplicative']);
    let handler = CodeUnit.createProductionHandler({production});

    expect(handler.toString()).toBe(
      'function (' +
        '_1, _2, _3' +
      ') { __ = _1 + _3 }'
    );

    handler(1, '+', 2)
    expect(environment.__).toBe(3);

    handler = CodeUnit.createProductionHandler({
      production,
      captureLocations: true,
    });

    expect(handler.toString()).toBe(
      'function (' +
        '_1, _2, _3, _1loc, _2loc, _3loc' +
      ') { __loc = yyloc(_1loc, _3loc);__ = _1 + _3 }'
    );

    handler(1, '+', 2, defaultLoc, defaultLoc, defaultLoc)
    expect(environment.__).toBe(3);
  });

  it('epsilon production loc', () => {
    const production = MockProduction([], '', /* isEpsilon */true);

    let handler = CodeUnit.createProductionHandler({
      production,
      captureLocations: true,
    });

    expect(handler.toString()).toBe(
      'function (' +
        '' +
      ') { __loc = null; }'
    );
  });

  it('yyloc', () => {
    const yyloc = environment.yyloc;

    const $1loc = {
      startOffset: 0,
      endOffset: 2,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 2,
    };

    const $2loc = {
      startOffset: 6,
      endOffset: 8,
      startLine: 1,
      endLine: 1,
      startColumn: 6,
      endColumn: 8,
    };

    const $$loc = {
      startOffset: 0,
      endOffset: 8,
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 8,
    };

    expect(yyloc($1loc, $2loc)).toEqual($$loc);

    // Epsilon loc (null)
    expect(yyloc(null, $2loc)).toEqual($2loc);
    expect(yyloc($1loc, null)).toEqual($1loc);
  });

  it('set bindings', () => {
    CodeUnit.setBindings({
      yytext: 'Hi!',
      yyleng: 3,
    });

    expect(environment.yytext).toBe('Hi!');
    expect(environment.yyleng).toBe(3);
  });

});