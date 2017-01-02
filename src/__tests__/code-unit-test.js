/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import CodeUnit from '../code-unit';

const environment = CodeUnit.getSandbox();

describe('code-unit', () => {

  it('default bindings', () => {
    expect(environment.yytext).toBe('');
    expect(environment.yyleng).toBe(0);
    expect(environment.yy).toEqual({});

    expect(environment.yyparse).not.toBe(null);
    expect(typeof environment.yyparse.onParseBegin).toBe('function');
    expect(typeof environment.yyparse.onParseEnd).toBe('function');


    expect(environment.$$).toBe(null);
    expect(typeof environment.require).toBe('function');
  });

  it('create handler', () => {
    const handler = CodeUnit.createHandler('$1, $2', '$$ = $1 + $2');
    expect(typeof handler).toBe('function');

    handler(1, 2);
    expect(environment.$$).toBe(3);
  });

  it('shared sandbox', () => {
    expect(environment).toBe(CodeUnit.getSandbox());
  });

  it('eval', () => {
    CodeUnit.eval('$$ = 2 * 5');
    expect(environment.$$).toBe(10);
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