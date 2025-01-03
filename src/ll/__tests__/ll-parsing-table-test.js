/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../../grammar/grammar';
import {MODES as GRAMMAR_MODE} from '../../grammar/grammar-mode';
import LLParsingTable from '../ll-parsing-table';
import LLParser from '../ll-parser';

describe('ll-parsing-table', () => {
  it('ll1-grammar-1', () => {
    const grammarFile = __dirname + '/grammar1.bnf';
    const expectedTable = {
      S: {
        "'a'": '1',
        $: '1',
      },
      A: {
        "'a'": '2',
        $: '3',
      },
    };

    const grammarBySLR = Grammar.fromGrammarFile(grammarFile, {
      mode: GRAMMAR_MODE.LL1,
    });
    expect(new LLParsingTable({grammar: grammarBySLR}).get()).toEqual(
      expectedTable
    );
    expect(new LLParser({grammar: grammarBySLR}).parse('a')).toEqual({
      status: 'accept',
      semanticValue: true,
    });
    expect(new LLParser({grammar: grammarBySLR}).parse('')).toEqual({
      status: 'accept',
      semanticValue: true,
    });
  });
});
