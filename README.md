# syntax
Syntactic analysis toolkit for education, tracing the parsing process, and parsers generation.

Implements [LR](https://en.wikipedia.org/wiki/LR_parser) and [LL](https://en.wikipedia.org/wiki/LL_parser) parsing algorighms.

See also [LL(1) parser](https://github.com/DmitrySoshnikov/ll1) repo (will be merged here).

#### Installation

##### From Github repo

After normal cloning of the Github repo, one needs to run `build` command to transpile ES6 code:

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

#### Parsing modes

_Syntax_ supports several _LR_ parsing modes: _LR(0)_, _SLR(1)_, _LALR(1)_, as well _LL(1)_ mode. The same grammar can be analyzed in different modes, from the CLI it's controled via the `--mode` option, e.g. `--mode slr1`.

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
