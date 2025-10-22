/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

'use strict';

/*global ROOT:true*/

// To require local modules from root.
global.ROOT = __dirname + '/../';

/**
 * Global options used from command line
 */
global.globalOptions = {
  output: null,
};

const colors = require('colors');
const fs = require('fs');
const path = require('path');

const options = require('nomnom')
  .script('syntax')
  .options({
    version: {
      abbr: 'v',
      help: 'Print current version',
      flag: true,
    },
    mode: {
      abbr: 'm',
      transform: normalizeMode,
    },
    grammar: {
      abbr: 'g',
      help: 'File containing LL or LR grammar',
      metavar: 'FILE',
    },
    lex: {
      abbr: 'l',
      help: 'File containing lexical grammar',
      required: false,
      metavar: 'FILE',
    },
    table: {
      abbr: 't',
      help: 'Generate and output parsing table',
      flag: true,
    },
    collection: {
      abbr: 'c',
      help: 'Generate and output canonical collection of LR items',
      flag: true,
    },
    sets: {
      abbr: 's',
      help: 'Generate and output parsing sets (all/first/follow/predict)',
    },
    parse: {
      abbr: 'p',
      help: 'Parse a string and checks for acceptance',
      type: 'string',
    },
    file: {
      abbr: 'f',
      help: 'File to be parsed',
      type: 'string',
      metavar: 'FILE',
    },
    output: {
      abbr: 'o',
      help: 'Output file for a generated parser module',
      type: 'string',
      metavar: 'FILE',
    },
    'custom-tokenizer': {
      abbr: 'k',
      help: 'Path to a file with custom tokenizer class',
      type: 'string',
      metavar: 'FILE',
    },
    'tokenizer-only': {
      help: 'Whether to generate only standalone tokenizer output file',
      flag: true,
    },
    tokenize: {
      help: 'Show list of tokens',
      flag: true,
    },
    'ignore-whitespaces': {
      abbr: 'w',
      help: 'Adds a Lex rule to ignore whitespaces',
      flag: true,
    },
    'resolve-conflicts': {
      abbr: 'r',
      help: 'Whether to auto-resolve conflicts with default action',
      flag: true,
    },
    'generate-inline-parser': {
      help: 'Whether to generate a parser module for parsing a passed string',
      flag: true,
    },
    loc: {
      help: 'Capture token locations (offsets, line and column numbers)',
      flag: true,
    },
    'case-insensitive': {
      help: 'Sets case-insensitive mode to lexical grammar',
      abbr: 'i',
      flag: true,
    },
    debug: {
      help: 'Debug mode (outputs steps and timing)',
      abbr: 'd',
      flag: true,
    },
    validate: {
      help: 'Validate a grammar, showing conflicts, number of states, etc.',
      flag: true,
    },
    namespace: {
      help: 'Append a wrapping namespace to generated code',
      type: 'string',
    },
  })
  .parse();

/**
 * Setup debug mode.
 */
global.SYNTAX_DEBUG = options.debug;

// NOTE: all Syntax tool requires go after debug `global.SYNTAX_DEBUG`
// is set, since debug module uses it at load time.

const GRAMMAR_MODE = require(ROOT + 'grammar/grammar-mode').MODES;
const Grammar = require(ROOT + 'grammar/grammar').default;
const debug = require(ROOT + 'debug').default;

if (global.SYNTAX_DEBUG) {
  console.info(colors.bold('\nDEBUG mode is: ON\n'));
}

/**
 * Default generator options.
 */
const generatorOptions = {
  customTokenizer: options['custom-tokenizer'],
  resolveConflicts: options['resolve-conflicts'],
  namespace: options['namespace'],
};

/**
 * Returns a parsing table for a grammar.
 */
function getLRParsingTable(grammar) {
  const LRParsingTable = require(ROOT + 'lr/lr-parsing-table').default;

  return new LRParsingTable({
    grammar,
    canonicalCollection: getCanonicalCollection(grammar),
    resolveConflicts: options['resolve-conflicts'],
  });
}

/**
 * Returns a canonical collection for a grammar.
 */
function getCanonicalCollection(grammar) {
  const CanonicalCollection = require(ROOT + 'lr/canonical-collection').default;

  return new CanonicalCollection({grammar});
}

/**
 * Validates a grammar.
 */
function validateLRGrammar(grammar) {
  const LRParsingTable = require(ROOT + 'lr/lr-parsing-table').default;
  const EntryType = LRParsingTable.EntryType;

  const table = getLRParsingTable(grammar);

  const conflictsData = table.getConflictsData();
  let hasConflicts = false;

  const srConflicts = new Map();
  const rrConflicts = new Map();

  // Conflicts in all states.
  for (const state in conflictsData) {
    const stateConflicts = conflictsData[state];

    // Conflitcs within a state.
    for (const symbol in stateConflicts) {
      const symbolConflict = stateConflicts[symbol];

      if (symbolConflict.resolved === false) {
        hasConflicts = true;
        const conflict = symbolConflict.conflict;

        switch (LRParsingTable.getEntryType(conflict)) {
          // Shift-reduce conflict.
          case EntryType.SR_CONFLICT: {
            const srParts = table.splitSRParts(conflict);
            const reducePart = srParts[0];
            const production = grammar.getProduction(reducePart.slice(1));
            const data = srConflicts.get(production) || [];
            data.push(symbol);
            srConflicts.set(production, data);
            break;
          }

          // Reduce-reduce conflict.
          case EntryType.RR_CONFLICT: {
            const rrParts = conflict.split('/');
            const reduce1 = rrParts[0];
            const reduce2 = rrParts[1];
            rrConflicts.set(conflict, {
              production1: grammar.getProduction(reduce1.slice(1)),
              production2: grammar.getProduction(reduce2.slice(1)),
            });
            break;
          }

          default:
            throw new Error(
              'Unknown conflict type: ' + symbolConflict.conflict
            );
        }
      }
    }
  }

  // Had conflicts, but all were resolved.
  if (!hasConflicts) {
    console.info(
      colors.green("\n\u2713 Grammar doesn't have any conflicts!\n")
    );
    return;
  }

  console.info(
    colors.red('\nGrammar has the following unresolved conflicts:\n')
  );

  // Shift-reduce.
  if (srConflicts.size > 0) {
    console.info(colors.bold('"Shift-reduce" conflicts:\n'));
    let i = 1;

    for (let productionData of srConflicts.entries()) {
      const production = productionData[0];
      let data = productionData[1];
      const pad = i >= 10 ? '' : ' ';
      data = data.map(symbol => colors.bold(symbol));
      console.info(
        `  ${pad}${i++}. ` +
          `Production: ${colors.bold(production.toFullString())}, ` +
          `conflicts with symbols ${data.join(', ')}.`
      );
    }

    console.info('');
  }

  // Reduce-reduce.
  if (rrConflicts.size > 0) {
    console.info(colors.bold('"Reduce-reduce" conflicts:\n'));
    let i = 1;

    for (let productions of rrConflicts.values()) {
      const production1 = productions.production1;
      const production2 = productions.production2;
      const pad = i >= 10 ? '' : ' ';
      console.info(
        `  ${pad}${i++}. ` +
          `Production: ${colors.bold(production1.toFullString())}, ` +
          `conflicts with production ${colors.bold(
            production2.toFullString()
          )}.`
      );
    }

    console.info('');
  }

  // Hint message how the conflicts can be fixed.
  console.info(
    `${colors.bold('Possible solutions:')}\n\n` +
      `  1. Conflicts possibly can be resolved by using ` +
      `${colors.bold('"operators"')} section,\n     where you can specify ` +
      `${colors.bold('precedence')} and ${colors.bold('associativity')}.\n\n` +
      `  2. By using different parsing mode` +
      (options.mode !== GRAMMAR_MODE.LALR1
        ? `, e.g. ${colors.bold('LALR1')} instead of ` +
          colors.bold(options.mode)
        : '') +
      '.\n\n' +
      `  3. Restructuring grammar.\n\n` +
      `See docs and details in: ${colors.bold('http://bit.ly/2l0zslL')}.\n`
  );
}

/**
 * Set of parsers.
 */
const parsers = {
  LR0(options) {
    return this._genericLR(GRAMMAR_MODE.LR0, options);
  },

  SLR1(options) {
    return this._genericLR(GRAMMAR_MODE.SLR1, options);
  },

  CLR1(options) {
    return this._genericLR(GRAMMAR_MODE.CLR1, options);
  },

  LALR1(options) {
    // Default algorithm for LALR(1) is "LALR(1) by SLR(1)".
    return this.LALR1_BY_SLR1(options);
  },

  LALR1_BY_SLR1() {
    return this._genericLR(GRAMMAR_MODE.LALR1_BY_SLR1, options);
  },

  LALR1_BY_CLR1() {
    return this._genericLR(GRAMMAR_MODE.LALR1_BY_CLR1, options);
  },

  _genericLR(mode, options) {
    global.globalOptions.output = options.output;

    const grammar = getGrammar(options.grammar, mode);

    console.info(`\nParsing mode: ${grammar.getMode()}.`);

    // Canonical collection or LR items.
    if (options.collection) {
      getCanonicalCollection(grammar).print();
    }

    // Validates a grammar.
    if (options.validate) {
      validateLRGrammar(grammar);
    }

    // LR parsing table.
    if (options.table) {
      getLRParsingTable(grammar).print();
    }

    // Parse a string.
    if (provided('parse')) {
      parse(options.parse, grammar);
    }

    // Parse a file.
    if (provided('file')) {
      parse(fs.readFileSync(options.file, 'utf-8'), grammar);
    }

    // Output information about tokens.
    if (options['tokenize']) {
      tokenizeFromOptions(options, grammar.getLexGrammar());
    }

    // Generate parser module.
    if (options.output) {
      const outputFile = options.output;
      const language = path.extname(outputFile).slice(1);

      // Generator is language agnostic.
      const GENERATORS = {
        // Default.
        js: require(ROOT + 'lr/lr-parser-generator-default.js').default,

        // Plugins.
        example: require(ROOT +
          'plugins/example/lr/lr-parser-generator-example.js').default,

        py: require(ROOT + 'plugins/python/lr/lr-parser-generator-py.js')
          .default,
        php: require(ROOT + 'plugins/php/lr/lr-parser-generator-php.js')
          .default,
        rb: require(ROOT + 'plugins/ruby/lr/lr-parser-generator-ruby.js')
          .default,
        cs: require(ROOT + 'plugins/csharp/lr/lr-parser-generator-csharp.js')
          .default,
        rs: require(ROOT + 'plugins/rust/lr/lr-parser-generator-rust.js')
          .default,
        java: require(ROOT + 'plugins/java/lr/lr-parser-generator-java.js')
          .default,
        h: require(ROOT + 'plugins/cpp/lr/lr-parser-generator-cpp.js').default,
        cpp: require(ROOT + 'plugins/cpp/lr/lr-parser-generator-cpp.js')
          .default,
        jl: require(ROOT + 'plugins/julia/lr/lr-parser-generator-julia.js')
          .default,
        lua: require(ROOT + 'plugins/lua/lr/lr-parser-generator-lua.js')
          .default,
      };

      const LRParserGenerator = GENERATORS[language] || GENERATORS.js;

      new LRParserGenerator({
        grammar,
        outputFile,
        options: generatorOptions,
      }).generate();

      showGeneratedSuccessMessage(options.output);
    }
  },

  LL1(options) {
    const grammar = getGrammar(options.grammar, GRAMMAR_MODE.LL1);

    console.info(`\nParsing mode: ${grammar.getMode()}.`);

    // LL parsing table.
    if (options.table) {
      const LLParsingTable = require(ROOT + 'll/ll-parsing-table').default;

      new LLParsingTable({
        grammar,
      }).print();
    }

    // Parse a string.
    if (provided('parse')) {
      parse(options.parse, grammar);
    }

    // Parse a file.
    if (provided('file')) {
      parse(fs.readFileSync(options.file, 'utf-8'), grammar);
    }

    // Output information about tokens.
    if (options['tokenize']) {
      tokenizeFromOptions(options, grammar.getLexGrammar());
    }

    // Generate parser module.
    if (options.output) {
      const outputFile = options.output;
      const language = path.extname(outputFile).slice(1);

      // Generator is language agnostic.
      const GENERATORS = {
        // Default.
        js: require(ROOT + 'll/ll-parser-generator-default.js').default,

        // Plugins.
        example: require(ROOT +
          'plugins/example/ll/ll-parser-generator-example.js').default,

        py: require(ROOT + 'plugins/python/ll/ll-parser-generator-py.js')
          .default,
        php: require(ROOT + 'plugins/php/ll/ll-parser-generator-php.js')
          .default,
        rb: require(ROOT + 'plugins/ruby/ll/ll-parser-generator-ruby.js')
          .default,
      };

      const LLParserGenerator = GENERATORS[language];

      new LLParserGenerator({
        grammar,
        outputFile,
        options: generatorOptions,
      }).generate();

      showGeneratedSuccessMessage(options.output);
    }
  },
};

function showGeneratedSuccessMessage(filePath) {
  console.info(
    `${colors.green('\n\u2713 Successfully generated:')}`,
    filePath,
    '\n'
  );
}

function parse(string, grammar) {
  console.info(`\n${colors.bold('Parsing:')}\n\n${string}\n`);

  try {
    const parsed = grammar.getMode().isLR()
      ? lrParse(string, grammar)
      : llParse(string, grammar);

    if (parsed.status === 'accept') {
      console.info(`${colors.green('\u2713 Accepted')}\n`);
    }

    if (parsed.hasOwnProperty('value')) {
      console.info(
        colors.bold('Parsed value:'),
        '\n\n' + formatParsedOutput(parsed.value),
        '\n'
      );
    }
  } catch (e) {
    console.info(`${colors.red(e.stack)}\n`);
    process.exit(1);
  }
}

function lrParse(string, grammar) {
  const LRParser = require(ROOT + 'lr/lr-parser').default;

  if (options['generate-inline-parser']) {
    return LRParser.fromParserGenerator({grammar}).parse(string);
  }

  return new LRParser({
    grammar,
    resolveConflicts: options['resolve-conflicts'],
  }).parse(string);
}

function llParse(string, grammar) {
  const LLParser = require(ROOT + 'll/ll-parser').default;

  if (options['generate-inline-parser']) {
    return LLParser.fromParserGenerator({grammar}).parse(string);
  }

  return new LLParser({grammar}).parse(string);
}

function formatParsedOutput(output) {
  // Object constructor is used from another realm, so no direct
  // constructor check, neither `instanceof` would work. Check
  // `name` property.
  if (
    Array.isArray(output) ||
    (output && output.constructor && output.constructor.name === 'Object')
  ) {
    return JSON.stringify(output, null, 2);
  }
  return output;
}

function getGrammar(grammarFile, mode) {
  if (!grammarFile) {
    return null;
  }

  const grammarData = Grammar.dataFromGrammarFile(grammarFile, {
    grammarType: 'bnf',
    useLocation: options.loc,
  });

  // If explicit lexical grammar file was passed, use it.
  const lexGrammarData = getLexGrammarData(options);
  if (!grammarData.lex) {
    grammarData.lex = lexGrammarData;
  } else if (lexGrammarData) {
    grammarData.lex.rules.push(...lexGrammarData.rules);
  }

  const grammarOptions = {
    /**
     * Parsing mode.
     */
    mode,

    /**
     * Whether to capture locations.
     */
    captureLocations: options.loc,
  };

  return Grammar.fromData(grammarData, grammarOptions);
}

function getLexGrammarData(options) {
  let data = null;

  // If explicit lexical grammar file was passed, use it.
  if (options.lex) {
    data = Grammar.dataFromGrammarFile(options.lex, {grammarType: 'lex'});
  }

  if (options['ignore-whitespaces'] && !data) {
    data = {
      rules: [['\\s+', /* skip whitespace */ '']],
    };
  }

  if (options['case-insensitive']) {
    if (!data) {
      data = {};
    }

    if (!data.options) {
      data.options = {};
    }

    data.options['case-insensitive'] = true;
  }

  return data;
}

function normalizeMode(mode) {
  return mode.toUpperCase();
}

function getModesList() {
  return Object.keys(GRAMMAR_MODE).join(', ');
}

function extractMode(options) {
  let mode = options.mode;

  // If no explicit mode is passed, try
  // infer it from the grammar file extension.
  if (!mode && options.grammar) {
    mode = path.extname(options.grammar).slice(1);
  }

  if (!mode) {
    error(`\nError: "mode" option is required for parsing\n`);
    return null;
  }

  mode = normalizeMode(mode);

  if (!GRAMMAR_MODE.hasOwnProperty(mode)) {
    error(
      `\nError: "${mode}" is not a valid parsing mode. ` +
        `Valid modes are: ${getModesList()}.\n`
    );
    return null;
  }

  if (!parsers.hasOwnProperty(mode)) {
    let availableModes = Object.keys(parsers)
      .filter(mode => !mode.startsWith('_'))
      .join(', ');

    error(
      `\nError: "${mode}" is not implemented yet. ` +
        `Available parsers are: ${availableModes}.\n`
    );
    return null;
  }

  return (options.mode = mode);
}

function handleSets() {
  const SetsGenerator = require(ROOT + 'sets-generator').default;

  let sets = options.sets;
  let sg = new SetsGenerator({
    grammar: getGrammar(options.grammar, options.mode),
  });

  if (sets.indexOf('first') !== -1 || sets === 'all') {
    sg.printSet(sg.getFirstSets());
  }

  if (sets.indexOf('follow') !== -1 || sets === 'all') {
    sg.printSet(sg.getFollowSets());
  }

  if (sets.indexOf('predict') !== -1 || sets === 'all') {
    sg.printSet(sg.getPredictSets());
  }
}

function error(message) {
  console.error(colors.red(message));
  console.info('Run --help for details.\n');
  process.exit(1);
}

function isTokenizerOnly(options) {
  return options['tokenizer-only'] || (options.lex && !options.grammar);
}

function handleStandaloneTokenizer() {
  const LexGrammar = require(ROOT + 'grammar/lex-grammar').default;

  let lexGrammarData = getLexGrammarData(options);
  let lexGrammar;

  if (lexGrammarData) {
    lexGrammar = new LexGrammar(lexGrammarData);
  } else {
    // Try infer from --grammar.
    lexGrammar = getGrammar(options.grammar, options.mode).getLexGrammar();
  }

  if (!provided('tokenize') && !provided('output')) {
    error('\nError: for tokenization pass either --tokenize or --output.\n');
  }

  if (options['tokenize']) {
    tokenizeFromOptions(options, lexGrammar);
  }
}

function provided(option) {
  return options.hasOwnProperty(option);
}

function tokenizeFromOptions(options, lexGrammar) {
  if (!provided('parse') && !provided('file')) {
    error('\nError: tokenization requires -p or -f parameter\n');
    return;
  }

  // Tokenize a string.
  if (provided('parse')) {
    tokenize(options.parse, lexGrammar);
  }

  // Tokinize a file.
  if (provided('file')) {
    tokenize(fs.readFileSync(options.file, 'utf-8'), lexGrammar);
  }
}

function tokenize(string, lexGrammar) {
  // Inline tokenization supported only for JS.
  const Tokenizer = require(ROOT + 'tokenizer').default;

  const tokens = new Tokenizer({string, lexGrammar}).getTokens();

  // Don't show last EOF token.
  tokens.pop();

  console.info(
    colors.bold('\nList of tokens:'),
    '\n\n',
    formatParsedOutput(tokens),
    '\n'
  );
}

function main() {
  if (options.version) {
    const pkg = require('../package.json');
    console.info(`v${pkg.version}`);

    if (!options.grammar && !options.lex) {
      return;
    }
  }

  if (!options.grammar && !options.lex) {
    error(`\nError: expected at least --grammar or --lex parameters.\n`);
    return;
  }

  // Generating a standalone tokenizer, either from direct --lex
  // parameter, or from the `lex` part of the --grammar parameter.
  if (isTokenizerOnly(options)) {
    return handleStandaloneTokenizer();
  }

  // Sets.
  if (options.sets) {
    handleSets();
  }

  parsers[extractMode(options)](options);
}

module.exports = main;

if (require.main === module) {
  debug.time('Total time');
  main();
  debug.timeEnd('Total time');
}
