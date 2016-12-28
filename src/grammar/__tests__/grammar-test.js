/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

jest.disableAutomock();

import Grammar from '../grammar';
import {MODES as GRAMMAR_MODE} from '../grammar-mode';
import fs from 'fs';

console.log(process.cwd());

const GRAMMAR_FILE = __dirname + '/calc.bnf';

describe('grammar-test', () => {

  it('loads grammar from BNF format', () => {
    const grammar = Grammar.fromGrammarFile(GRAMMAR_FILE, GRAMMAR_MODE.SLR1);
    expect(grammar instanceof Grammar).toBe(true);
  });

});
