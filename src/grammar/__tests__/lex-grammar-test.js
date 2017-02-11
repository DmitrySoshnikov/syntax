/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import LexGrammar from '../lex-grammar';

const lexGrammarData = require(__dirname + '/calc.lex');
const lexGrammar = new LexGrammar(lexGrammarData);

const rulesToIndices = rules => {
  return rules.map(rule => lexGrammar.getRuleIndex(rule));
};

const startConditions = {
  INITIAL: 0,
  comment: 1,
};

const lexRulesByStartConditions = {
  INITIAL: [0, 1, 2, 3, 4, 5, 6, 7],
  comment: [0, 8, 9],
};

describe('lex-grammar', () => {

  it('rules', () => {
    const rulesData = lexGrammar.getRules().map(rule => rule.toData());
    expect(rulesData).toEqual(lexGrammarData.rules);
    expect(rulesData).toEqual(lexGrammar.getOriginalRules());
  });

  it('rule by index', () => {
    const firstRule = lexGrammar.getRuleByIndex(0);
    expect(firstRule).toBe(lexGrammar.getRules()[0]);
  });

  it('index of a rule', () => {
    const firstRule = lexGrammar.getRuleByIndex(0);
    expect(lexGrammar.getRuleIndex(firstRule)).toBe(0);
  });

  it('start conditions', () => {
    expect(lexGrammar.getStartConditions()).toEqual(startConditions);
  });

  it('macros', () => {
    expect(lexGrammar.getMacros()).toEqual(lexGrammarData.macros);
  });

  it('expanded macro', () => {
    const rule2 = lexGrammar.getRuleByIndex(2);
    const id = lexGrammarData.macros.id;

    expect(rule2.getMatcher().source).toEqual(`^${id}+`);
    expect(rule2.getOriginalMatcher()).toEqual(`${id}+`);
    expect(rule2.getRawMatcher()).toEqual(`^${id}+`);
  });

  it('rules by start conditions', () => {
    const rulesByStartConditions = lexGrammar.getRulesByStartConditions();
    const rulesByConditionsData = {};

    Object.keys(rulesByStartConditions).forEach(startCondition => {
      const rules = rulesByStartConditions[startCondition];
      rulesByConditionsData[startCondition] = rulesToIndices(rules);
    });

    expect(rulesByConditionsData).toEqual(lexRulesByStartConditions);
  });

  it('rules for start conditions', () => {
    const rulesByStartConditions = lexGrammar.getRulesByStartConditions();

    Object.keys(rulesByStartConditions).forEach(startCondition => {
      const expectedLexRules = lexRulesByStartConditions[startCondition];

      const rules = rulesToIndices(lexGrammar.getRulesForState(startCondition));
      expect(rules).toEqual(expectedLexRules);
    });
  });

  it('options', () => {
    const options = lexGrammarData.options;

    expect(lexGrammar.getOptions()).toEqual(options);
    expect(lexGrammar.getRuleByIndex(0).getOptions()).toEqual(options);
  });

});