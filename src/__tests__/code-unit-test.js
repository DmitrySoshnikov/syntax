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

function MockProduction(RHS) {
  return {
    getRHS() {
      return RHS.map(symbol => MockSymbol(symbol));
    },

    getRawSemanticAction() {
      return '$$ = $1 + $3';
    },
  };
}

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

    expect(CodeUnit.createProductionParams(production)).toBe(
      '_1, _2, _3, _additive, _PLUS, _multiplicative, _1loc, _2loc, _3loc'
    );

    production = MockProduction(['additive', '+', 'multiplicative']);

    expect(CodeUnit.createProductionParams(production)).toBe(
      '_1, _2, _3, _additive, _named2, _multiplicative, _1loc, _2loc, _3loc'
    );
  });

  it('production handler', () => {
    const production = MockProduction(['additive', 'PLUS', 'multiplicative']);
    const handler = CodeUnit.createProductionHandler(production);

    expect(handler.toString()).toBe(
      'function (' +
        '_1, _2, _3, _additive, _PLUS, _multiplicative, _1loc, _2loc, _3loc' +
      ') { __ = _1 + _3 }'
    );

    handler(1, '+', 2)
    expect(environment.__).toBe(3);
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