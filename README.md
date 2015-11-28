# syntax
Syntactic analysis toolkit for education, tracing the parsing process, and parsers generation.

Implements [LR](https://en.wikipedia.org/wiki/LR_parser) and [LL](https://en.wikipedia.org/wiki/LL_parser) parsing algorighms.

See also [LL(1) parser](https://github.com/DmitrySoshnikov/ll1) repo (will be merged here).

#### CLI usage example:

```
./bin/syntax --grammar examples/grammar.lr0 --parse "aabb" --mode lr0 --table --collection
```
