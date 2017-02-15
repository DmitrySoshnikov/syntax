/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import BaseParserGenerator from '../base-parser-generator';
import Grammar from '../grammar/grammar';
import LLParsingTable from './ll-parsing-table';
import {EOF} from '../special-symbols';

import fs from 'fs';

/**
 * Template for LL(1) parser.
 */
const LL_PARSER_TEMPLATE = fs.readFileSync(
`${__dirname}/../templates/ll.template.js`,
  'utf-8'
);

/**
 * LL parser generator. Creates a parser module for a given grammar, and
 * saves it to the `outputFile`.
 */
export default class LLParserGeneratorDefault extends BaseParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({grammar, outputFile, options = {}}) {
    if (!grammar.getMode().isLL()) {
      throw new Error(`LL parser generator: LL(1) grammar is expected.`);
    }
    super({grammar, outputFile, options})
      .setTable(new LLParsingTable({grammar}))
      .setTemplate(LL_PARSER_TEMPLATE);
  }

  /**
   * Generates parser data.
   */
  generateParserData() {
    super.generateParserData();
    this._generateStartSymbol();
  }

  /**
   * Format of the production is:
   * [RHS.reverse().map(index)]
   * The RHS is reversed to push onto the stack at derivation.
   * LL parser doesn't implement yet semantic action.
   */
  generateRawProductionsData() {
    let productionsData = this.getGrammar().getProductions().map(production => {
      // RHS for derivation.
      let reversedRHS = [];
      if (!production.isEpsilon()) {
        reversedRHS = production.getRHS().map(symbol => {
          return this.getEncodedSymbol(symbol.getSymbol()).toString();
        }).reverse();
      }
      return [reversedRHS];
    });

    // For 1-based index production.
    productionsData.unshift([-1]);
    return productionsData;
  }

  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => JSON.stringify(data));
  }

  /**
   * Actual parsing table.
   */
  generateParseTableData() {
    let originalTable = this._table.get();
    let table = {};

    for (let nonTerminal in originalTable) {
      let row = {};
      let originalRow = originalTable[nonTerminal];

      for (let symbol in originalRow) {
        let entry = originalRow[symbol];
        row[this.getEncodedSymbol(symbol)] = entry;
      }

      table[this.getEncodedNonTerminal(nonTerminal)] = row;
    }

    return table;
  }

  _generateStartSymbol() {
    let startSymbol = this.getEncodedNonTerminal(
      this.getGrammar().getStartSymbol(),
    );
    this.writeData('<<START>>', `'${startSymbol}'`);
  }
};
