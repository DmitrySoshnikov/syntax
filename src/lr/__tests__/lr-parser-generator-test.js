/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import Grammar from '../../grammar/grammar';
import {MODES as GRAMMAR_MODE} from '../../grammar/grammar-mode';

import LRParserGeneratorDefault from '../lr-parser-generator-default';

import path from 'path';
import os from 'os';

function createParser(grammar, options) {
  const outputFile = path.resolve(os.tmpdir(), '.syntax-parser.js');

  return new LRParserGeneratorDefault({
    grammar,
    outputFile,
    options,
  }).generate();
}

const grammar = Grammar.fromGrammarFile(
  __dirname + '/../../grammar/__tests__/calc.g',
  {
    mode: GRAMMAR_MODE.LALR1,
    captureLocations: true,
  }
);

describe('LR parser generator', () => {

  it('parse options', () => {

    const options = {
      captureLocations: true,
    };

    const parser = createParser(grammar, options);

    // Global options.
    expect(parser.getOptions()).toEqual(options);

    const overrideOptions = {
      captureLocations: false,
      'x-flag': true,
    };

    const parsingString = '2 + 2';

    // // Setup on parse begin hook.
    parser.onParseBegin = (string, tokenizer, options) => {

      expect(string).toBe(parsingString);

      expect(options).toEqual(overrideOptions);
      expect(parser.getOptions()).toEqual(overrideOptions);

      if (options['x-flag']) {
        tokenizer.pushState('x-flag');
      }

      expect(tokenizer.getCurrentState()).toBe('x-flag');
      tokenizer.popState();
    };

    parser.parse(parsingString, overrideOptions);

    // Check the global options are restored.
    expect(parser.getOptions()).toEqual(options);
  });

});