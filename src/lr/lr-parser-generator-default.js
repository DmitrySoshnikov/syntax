/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import BaseParserGenerator from '../base-parser-generator';
import CanonicalCollection from './canonical-collection';
import LRParsingTable from './lr-parsing-table';
import {EOF} from '../special-symbols';

import fs from 'fs';

/**
 * Generic JS template for all LR parsers.
 */
const LR_PARSER_TEMPLATE = fs.readFileSync(
`${__dirname}/../templates/lr.template.js`,
  'utf-8'
);

/**
 * LR parser generator. Creates a parser module for a given grammar, and
 * saves it to the `outputFile`.
 *
 * By default also generates code for a tokenizer, unless
 * `customTokenizer` is passed.
 */
export default class LRParserGeneratorDefault extends BaseParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    customTokenizer = null,
    resolveConflicts = false,
  }) {
    if (!grammar.getMode().isLR()) {
      throw new Error(`LR parser generator: LR grammar is expected.`);
    }

    const table = new LRParsingTable({
      canonicalCollection: new CanonicalCollection({grammar}),
      grammar,
      resolveConflicts,
    });

    super({grammar, outputFile, customTokenizer})
      .setTable(table)
      .setTemplate(LR_PARSER_TEMPLATE);
  }

  /**
   * Format of the production is:
   * [Non-terminal index, RHS.length, semanticAction]
   */
  generateProductionsData() {
    return this.getGrammar().getProductions().map(production => {
      let LHS = production.getLHS().getSymbol().replace(/'/g, "\\'");
      let RHSLength = production.isEpsilon() ? 0 : production.getRHS().length;
      let semanticAction = this.buildSemanticAction(production);

      return `[${this.getEncodedNonTerminal(LHS)}, ${RHSLength}` +
        (semanticAction ? `, ${semanticAction}` : '') + ']';
    });
  }

  /**
   * Actual parsing table.
   */
  generateParseTableData() {
    let originalTable = this._table.get();
    let table = {};

    for (let state in originalTable) {
      let row = {};
      let originalRow = originalTable[state];

      for (let symbol in originalRow) {
        let entry = originalRow[symbol];
        row[this.getEncodedSymbol(symbol)] = entry;
      }

      table[state] = row;
    }

    return table;
  }
};
