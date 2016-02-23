# syntax
Syntactic analysis toolkit for education, tracing the parsing process, and parsers generation.

Implements [LR](https://en.wikipedia.org/wiki/LR_parser) and [LL](https://en.wikipedia.org/wiki/LL_parser) parsing algorighms.

See also [LL(1) parser](https://github.com/DmitrySoshnikov/ll1) repo (will be merged here).

#### Installation

##### From Github repo

After normal cloning of the Github repo, run `build` command to transpile ES6 code:

```
git clone https://github.com/DmitrySoshnikov/syntax.git
cd syntax
npm install
npm run build

./bin/syntax --help
```

For developement, instead of `npm run build` one can also use:

```
npm run watch
```

#### CLI usage example:

```
./bin/syntax --grammar examples/grammar.lr0 --parse "aabb" --mode lr0 --table --collection
```

#### Parser generation

To generate a parser module, specify the `--output` option, which is a path to the output parser file. Once generated, the module can normally be required, and used for parsing strings based on a given grammar.

Example for the [JSON grammar](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/json.ast.js):

```
./bin/syntax --grammar examples/json.ast.js --mode SLR1 --output json-parser.js

✓ Successfully generated: json-parser.js
```

Loading as a JS module:

```js
const JSONParser = require('./json-parser');

let value = JSONParser.parse('{"x": 10, "y": [1, 2]}');

console.log(value); // JS object: {x: 10, y: [1, 2]}
```

#### Using custom tokenizer

> NOTE: built-in tokenizer uses underlying regexp implementation to extract stream of tokens.

It is possible to provide a custom tokenizer if a built-in isn't sufficient. For this pass the `--custom-tokenizer` option, which is a path to a file that implements a tokenizer. In this case the built-in tokenizer code won't be generated.

```
./bin/syntax --grammar examples/json.ast.js --mode SLR1 --output json-parser.js --custom-tokenizer './my-tokenizer.js'

✓ Successfully generated: json-parser.js
```

In the generated code, the custom tokenizer is just required as a module: `require('./my-tokenizer.js')`.

The tokenizer should implement the following iterator-like interface:

- `initString`: initials a pasrsing string;
- `hasMoreTokens`: whether stream of tokens still has more tokens to consume;
- `getNextToken`: returns next token in the format `{type, value}`;

For example:

```js
// File: ./my-tokenizer.js

const MyTokenizer = {

  initString(string) {
    this._string = string;
    this._cursor = 0;
  },

  hasMoreTokens() {
    return this._cursor < this._string.length;
  },

  getNextToken() {
    // Implement logic here.

    return {
      type: <<TOKEN_TYPE>>,
      value: <<TOKEN_VALUE>>,
    }
  },
};

module.exports = MyTokenizer;
```

#### Parsing modes

_Syntax_ supports several _LR_ parsing modes: _LR(0)_, _SLR(1)_, _LALR(1)_, _CLR(1)_ as well _LL(1)_ mode. The same grammar can be analyzed in different modes, from the CLI it's controled via the `--mode` option, e.g. `--mode slr1`.

> Note: de facto standard for automatically generated parsers is usually the _LALR(1)_ parser. The _CLR(1)_ parser, being the most powerful, and able to parse wider grammar sets, can have much more states than LALR(1), and usually is suitable for educational purposes. As well as its less powerful counterparts, _LR(0)_ and _SLR(1)_ which are less used on practice (although, some production-ready grammars can also normally be parsed by _SLR(1)_, e.g. [JSON grammar](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/json.ast.js)).

Some grammars can be handled by one mode, but not by another. In this case a _conflict_ will be shown in the table.

##### LR conflicts

In LR parsing there are two main types of conflicts: _"shift-reduce" (s/r)_ conflict, and _"reduce-reduce" (r/r)_ conflict. Taking as an example grammar from `examples/example1.slr1`, we see that the parsing table is normally constructed for `SLR(1)` mode, but has a "shift-reduce" conflict if ran in the `LR(0)` mode:

```
./bin/syntax --grammar examples/example1.slr1 --table
```

```
./bin/syntax --grammar examples/example1.slr1 --table --mode lr0
```

![sl1-grammar](http://dmitrysoshnikov.com/wp-content/uploads/2015/12/imageedit_2_9168334335.png)
![sl1-grammar-lr0-m](http://dmitrysoshnikov.com/wp-content/uploads/2015/12/imageedit_2_6530197571.png)
