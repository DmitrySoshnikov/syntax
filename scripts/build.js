/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

require('shelljs/global');

console.info('Building...\n');

console.info('Installing templates...');
rm('-rf', 'dist');
mkdir('dist');
mkdir('dist/templates');
cp('-r', 'src/templates/*', 'dist/templates/');
console.info('Done.\n');

const PLUGINS = [
  'example',
  'python',
  'php',
  'ruby',
  'csharp',
];

console.info('Installing plugins...')
PLUGINS.forEach(plugin => {
  mkdir('-p', `dist/plugins/${plugin}/templates`);
  cp('-r', `src/plugins/${plugin}/templates/*`, `dist/plugins/${plugin}/templates/`);
});
console.info('Done.\n');

console.info('Transpiling JS code...\n');
mkdir('dist/generated');

exec(`"node_modules/.bin/babel" src/generated/bnf-parser.gen -o dist/generated/bnf-parser.gen --presets es2015,stage-1,stage-2`);
exec(`"node_modules/.bin/babel" src/generated/lex-parser.gen -o dist/generated/lex-parser.gen --presets es2015,stage-1,stage-2`);

exec(`"node_modules/.bin/babel" ${process.argv[2] || ''} src/ --out-dir dist/ --presets es2015,stage-1,stage-2 --ignore templates/,__tests__`);
console.info('\nAll done.');