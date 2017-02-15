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
 */
export default class LRParserGeneratorDefault extends BaseParserGenerator {

  /**
   * Instance constructor.
   */
  constructor({
    grammar,
    outputFile,
    options = {},
  }) {
    if (!grammar.getMode().isLR()) {
      throw new Error(`LR parser generator: LR grammar is expected.`);
    }

    const table = new LRParsingTable({
      canonicalCollection: new CanonicalCollection({grammar}),
      grammar,
      resolveConflicts: options.resolveConflicts,
    });

    super({grammar, outputFile, options})
      .setTable(table)
      .setTemplate(LR_PARSER_TEMPLATE);
  }

  /**
   * Default format in the [ ] array notation.
   */
  generateProductionsData() {
    return this.generateRawProductionsData()
      .map(data => `[${data}]`);
  }

  /**
   * Format of the production is:
   * [Non-terminal index, RHS.length, semanticAction]
   */
  generateRawProductionsData() {
    return this.getGrammar().getProductions().map(production => {
      let LHS = production.getLHS().getSymbol().replace(/'/g, "\\'");
      let RHSLength = production.isEpsilon() ? 0 : production.getRHS().length;
      let semanticAction = this.buildSemanticAction(production);

      let result = [
        this.getEncodedNonTerminal(LHS),
        RHSLength,
      ];

      if (semanticAction) {
        result.push(semanticAction);
      }

      return result;
    });
  }

  /**
   * Actual parsing table.
   */
  generateParseTableData() {
    let originalTable = this._table.get();
    let table = [];

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
