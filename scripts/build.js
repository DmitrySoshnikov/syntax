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
// 1. Git hooks.

console.info(colors.bold('[1/6] Installing Git hooks...\n'));

// Setup pre-commit hook.
console.info('  - pre-commit: .git/hooks/pre-commit');
exec('unlink .git/hooks/pre-commit');
chmod('+x', './scripts/git-pre-commit');
ln('-s', '../../scripts/git-pre-commit', '.git/hooks/pre-commit');

// Setup pre-push hook.
console.info('  - pre-push:   .git/hooks/pre-push\n');
exec('unlink .git/hooks/pre-push');
chmod('+x', './scripts/git-pre-push');
ln('-s', '../../scripts/git-pre-push', '.git/hooks/pre-push');

// ----------------------------------------------------------
// 2. Templates

console.info(colors.bold('[2/6] Installing templates...\n'));
rm('-rf', 'dist');
mkdir('dist');
mkdir('dist/templates');

const templates = ls('src/templates').map(template => '  - ' + template);
console.info(templates.join('\n'));

cp('-r', 'src/templates/*', 'dist/templates/');

// ----------------------------------------------------------
// 3. Plugins

console.info(colors.bold('\n[3/6] Installing plugins...\n'));
const plugins = ls('src/plugins/').filter(file => file !== 'README.md');

plugins.forEach(plugin => {
  console.info('  - ' + plugin);
  mkdir('-p', `dist/plugins/${plugin}/templates`);
  cp(
    '-r',
    `src/plugins/${plugin}/templates/*`,
    `dist/plugins/${plugin}/templates/`
  );
});

// ----------------------------------------------------------
// 4. Transpiling JS code

console.info(colors.bold('\n[4/6] Transpiling JS code...\n'));
exec(
  `"node_modules/.bin/babel" ${process.argv[2] ||
    ''} src/ --out-dir dist/ --ignore templates/,__tests__`
);

// ----------------------------------------------------------
// 5. Rebuilding LEX parser

console.info(colors.bold('\n[5/6] Rebuilding LEX parser...'));
exec(
  `node "./bin/syntax" -g src/generated/lex.bnf -l src/generated/lex.lex -m lalr1 -o src/generated/lex-parser.gen.js`
);
exec(
  `"node_modules/.bin/babel" src/generated/lex-parser.gen.js -o dist/generated/lex-parser.gen.js`
);

// ----------------------------------------------------------
// 6. Rebuilding BNF parser

console.info(colors.bold('\n[6/6] Rebuilding BNF parser...'));
exec(
  `node "./bin/syntax" -g src/generated/bnf.g -m lalr1 -o src/generated/bnf-parser.gen.js`
);
exec(
  `"node_modules/.bin/babel" src/generated/bnf-parser.gen.js -o dist/generated/bnf-parser.gen.js`
);

console.info(colors.bold('All done.\n'));
