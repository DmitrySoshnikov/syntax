/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

jest.disableAutomock();

import CodeUnit from '../../code-unit';
import LexRule from '../lex-rule';

describe('lex-rule', () => {

  it('matcher', () => {
    const rule = new LexRule({matcher: '\\d+'});

    expect(rule.getMatcher() instanceof RegExp).toBe(true);
    expect(rule.getOriginalMatcher()).toBe('\\d+');

    // The matcher is transformed to the beginning of a string ^.
    expect(rule.getRawMatcher()).toBe("^\\d+");
    expect(rule.getMatcher().source).toBe("^\\d+");
  });

  it('matcher from terminal', () => {
    expect(LexRule.matcherFromTerminal(`'a'`)).toBe('a');
    expect(LexRule.matcherFromTerminal(`"a"`)).toBe('a');
    expect(LexRule.matcherFromTerminal(`"d"`)).toBe('d');
    expect(LexRule.matcherFromTerminal(`"/"`)).toBe('\\/');
    expect(LexRule.matcherFromTerminal(`"//"`)).toBe('\\/\\/');
    expect(LexRule.matcherFromTerminal(`"^abc*$"`)).toBe('\\^abc\\*\\$');
  });

  it('handler', () => {
    const rule = new LexRule({
      matcher: '\\d+',
      tokenHandler: 'return "NUMBER"',
    });

    expect(rule.getRawHandler()).toBe('return "NUMBER"');
    expect(rule.getOriginalMatcher()).toBe("\\d+");

    const handlerFn = rule.getHandler();
    const matched = '10';
    const matcherResult = [matched, 'NUMBER'];

    expect(handlerFn instanceof Function).toBe(true);
    expect(handlerFn(matched, null)).toEqual(matcherResult);
    expect(rule.getTokenData(matched, null)).toEqual(matcherResult);

    const codeUnitScope = CodeUnit.getSandbox();

    expect(codeUnitScope.yytext).toBe(matched);
    expect(codeUnitScope.yyleng).toBe(matched.length);
  });

  it('modified yytext', () => {
    const rule = new LexRule({
      matcher: '\\d+',
      tokenHandler: 'yytext = yytext.slice(1); return "NUMBER"',
    });

    const handlerFn = rule.getHandler();
    const matched = '123';
    const modified = matched.slice(1);
    const codeUnitScope = CodeUnit.getSandbox();

    expect(handlerFn(matched, null)).toEqual([modified, 'NUMBER']);
    expect(codeUnitScope.yytext).toBe(modified);
    expect(codeUnitScope.yyleng).toBe(modified.length);
  });

  it('start conditions', () => {
    const startConditions = ['number'];

    const rule = new LexRule({
      startConditions,
      matcher: '\\d+',
    });

    expect(rule.hasStartConditions()).toBe(true);
    expect(rule.getStartConditions()).toBe(startConditions);

    const otherRule = new LexRule({
      matcher: '\\d+',
    });

    expect(otherRule.hasStartConditions()).toBe(false);
    expect(otherRule.getStartConditions()).toBe(undefined);
  });

});