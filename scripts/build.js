/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

require('shelljs/global');

const colors = require('colors');

console.info(colors.bold('Building...\n'));

// Need to checkout to working copies of the generated parser if
// they got corrupted with current changes. The parsers are regenerated
// further in the build steps.
exec(`git checkout "src/generated/lex-parser.gen.js"`);
exec(`git checkout "src/generated/bnf-parser.gen.js"`);

// ----------------------------------------------------------
// 1. Templates

console.info(colors.bold('[1/5] Installing templates...\n'));
rm('-rf', 'dist');
mkdir('dist');
mkdir('dist/templates');

const templates = ls('src/templates').map(template => '  - ' + template);
console.info(templates.join('\n'));

cp('-r', 'src/templates/*', 'dist/templates/');
console.info(colors.bold('\nDone.\n'));

// ----------------------------------------------------------
// 2. Plugins

console.info(colors.bold('[2/5] Installing plugins...\n'));
const plugins = ls('src/plugins/').filter(file => file !== 'README.md');

plugins.forEach(plugin => {
  console.info('  - ' + plugin);
  mkdir('-p', `dist/plugins/${plugin}/templates`);
  cp('-r', `src/plugins/${plugin}/templates/*`, `dist/plugins/${plugin}/templates/`);
});

console.info(colors.bold('\nDone.\n'));

// ----------------------------------------------------------
// 3. Transpiling JS code

console.info(colors.bold('[3/5] Transpiling JS code...\n'));
exec(`"node_modules/.bin/babel" ${process.argv[2] || ''} src/ --out-dir dist/ --ignore templates/,__tests__`);
console.info(colors.bold('\nDone.'));

// ----------------------------------------------------------
// 4. Rebuilding LEX parser

console.info(colors.bold('\n[4/5] Rebuilding LEX parser...'));
exec(`node "./bin/syntax" -g src/generated/lex.bnf -l src/generated/lex.lex -m lalr1 -o src/generated/lex-parser.gen.js`);
exec(`"node_modules/.bin/babel" src/generated/lex-parser.gen.js -o dist/generated/lex-parser.gen.js`);
console.info(colors.bold('Done.\n'));

// ----------------------------------------------------------
// 4. Rebuilding BNF parser

console.info(colors.bold('[5/5] Rebuilding BNF parser...'));
exec(`node "./bin/syntax" -g src/generated/bnf.g -m lalr1 -o src/generated/bnf-parser.gen.js`);
exec(`"node_modules/.bin/babel" src/generated/bnf-parser.gen.js -o dist/generated/bnf-parser.gen.js`);

console.info(colors.bold('All done.\n'));