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
`${__dirname}/../templates/ll.template`,
  'utf-8'
);

/**
 * LL parser generator. Creates a parser module for a given grammar, and
 * saves it to the `outputFile`.
 *
 * By default also generates code for a tokenizer, unless
 * `customTokenizer` is passed.
 */
export default class LLParserGenerator extends BaseParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({grammar, outputFile, customTokenizer = null}) {
    if (!grammar.getMode().isLL()) {
      throw new Error(`LL parser generator: LL(1) grammar is expected.`);
    }

    super({grammar, outputFile, customTokenizer})
      .setTable(new LLParsingTable({grammar}))
      .setTemplate(LL_PARSER_TEMPLATE);

    this._generateStartSymbol();
  }

  /**
   * Format of the production is:
   * [Non-terminal index, RHS.reverse().map(index), semanticAction]
   * The RHS is reversed to push onto the stack at derivation.
   */
  generateProductionsData() {
    let productionsData = this.getGrammar().getProductions().map(production => {
      // RHS for derivation.
      let reversedRHS = [];
      if (!production.isEpsilon()) {
        reversedRHS = production.getRHS().map(symbol => {
          return this.getEncodedSymbol(symbol.getSymbol())
        }).reverse();
      }

      let semanticAction = this.buildSemanticAction(production);

      return `[[${reversedRHS}]` +
        (semanticAction ? `, ${semanticAction}` : '') + ']';
    });

    // For 1-based index production.
    productionsData.unshift(`[-1]`);
    return productionsData;
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
    this.writeData('<<START>>', startSymbol);
  }
};
