## How to write a plugin

Even though _Syntax_ tool itself is written in JavaScript, it can be used for generating parsers in _any target language_. By default it implements JavaScript as a target language, however, any extra language can be added as a _plugin_.

This is possible because _Syntax_ separates the algorithms for _parsing table calculation_, from the actual _parser code generation_ using this table. The first part is implemented for you by Syntax, and the second part can be implemented as a plugin.

Currently _Syntax_ supports the following plugins:

- JavaScript (default)
- Python
- Ruby
- PHP
- C#

Below are the steps which will help you implementing a parser generator for a needed target language.

Notice: you'll need to use `npm run build` command for development.

### 1. Directory structure

Create a sub-directory named with your target language, with the following structure (see `src/plugins/example/`):

```
plugins/
└── <your-language>/
    ├── ll/
    │   └── ll-parser-generator-<your-language>.js
    ├── lr
    │   └── lr-parser-generator-<your-language>.js
    ├── <your-language>-parser-generator-trait.js
    └── templates
        ├── ll.template.<ext>
        ├── lr.template.<ext>
        └── tokenizer.template.<ext>
```

### 2. Templates

_Syntax_ tool provides you with all the needed information to build a parser. This includes: a _calculated parsing table_, encoded list of non-terminals, and terminals, etc. All is left to do is to build a _template_ in your language, which _consumes_ the parsing table, and implements an actual parsing algorithm.

Parsing algorithms (LR/LL) are already also implemented, and can be found in the `scr/plugins/example/templates` directory.

Basically we'll need to implement:

- `tokenizer.template.<ext>` -- an actual tokenizer;
- `lr.template.<ext>` -- LR parser, mostly used on practice;
- `ll.template.<ext>` -- in case you need to support LL parser.

where `<ext>` is the extension of the filename of your language.

#### 2.1 Tokenizer

Copy `src/plugins/example/templates/tokenizer.template.example` to your `templates` directory, and port the code from JavaScript to your language. Follow the "Implementation notes" section for guidelines.

The file contains very detailed comments, and doesn't use very specific to JS constructs -- instead it tries to use some generic data structures, which should be easily portable to any other language. I.e. when we have a JS object, such as `{foo: 10, bar: 20}`, this means an abstract _"map"_ data structure, which can be represented by any data type in a needed language. Similarly, JS arrays: `[10, 20]`, which can be represented as a _List_, _array_, etc in other languages.

#### 2.2 LR-parsing

LR-parsers is the default type of parsers used on practice in automatically generated parsers (in particular, _LALR_ parsing mode). To support LR parsing in your language, you need to implement the `lr.template.<ext>`.

Copy `src/plugins/example/templates/lr.template.example` to your `templates` directory, and port the code from JavaScript to your language, following the "Implementation notes" section for guidelines. Detailed comments in the example template file should make the port almost 1:1 match in any other language.

#### 2.3 LL-parsing

If needed, port the LL-parser template from the `src/plugins/example/templates/ll.template.example` to your language. Note, LL parser currently only provides a syntax check, not building actual ASTs, since on practice, as mentioned, LR parsers are mostly used.

### 3. Parser generator

Once you have the templates ported, you need to implement an actual _parser generator_. This is done per parsing mode (LR/LL), and also by implementing a _generator trait_. The trait usually contains _very specific_ things related to the target language.

#### 3.1. LR parser generator

You need to implement `lr/lr-parser-generator-<your-language>.js`.

Copy the `src/plugins/example/lr/lr-parser-generator-example.js` to your `lr` directory, and change the class names, and other specific things to your plugin. In addition you may add any extra functionality there. Read the "Implementation notes" section for guidelines.

#### 3.2 Parser generator trait

You need to implement `<your-language>-parser-generator-trait.js`.

The trait file contains the most specific to the target language functionality, and code generation. For example, it generates code for lex rule, and production handlers, code for the parsing table in the target language format, etc. Read the "Implementation notes" section for guidelines.

#### 3.3 LL generator trait

If needed, implement `ll/ll-parser-generator-<your-language>.js`. Follow the instructions for the LR parser generator above, and do a similar implementation.

### 4. Add your plugin to the build system

You'll need to add your new plugin to the:

- `scripts/build.js`, to the `PLUGINS` array
- to the `bin/syntax` file, to the `GENERATORS` object of the `_genericLR` method, and, if needed, of the `LL1`.

Run `npm run build` to copy your templates files, and transpile code. You can also use `npm run watch` for faster development (notice though, it only transpiles code, and doesn't copy the templates; for that you'll have to use `build` command).

### 5. How to test?

Port `examples/calc.example.g` to your language, and execute the `syntax` command on it. Example:

```
./bin/syntax -g examples/calc.example.g -m LALR1 -o ~/CalcParser.example
```

And then usage of the generated parser file (here in JS):

```
const CalcParser = require('CalcParser.example');

const parser = new CalcParser();

console.log(parser.parse("2 + 2 * 2")); // 6
console.log(parser.parse("(2 + 2) * 2")); // 8
```

### 6. Submit a PR :)

If you built a plugin for a new language which Syntax yet doesn't supported, please submit a pull request, we'll be glad to review, and accept it.

Good luck with parser generators!
