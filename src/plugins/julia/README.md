## How to build a parser for Julia

Below are the guiding steps how to build a working parser for the Julia programming language.

### 0. Prerequisite: install Syntax tool

```
npm install -g syntax-cli
```

> NOTE: `npm` comes pre-installed with [Node.js](https://nodejs.org/en/)

### 1. Generate a project environment

Use Julia to generate the project by invoking the package management capability, which you can do by hitting the ']' key while in the Julia REPL:

```
$ julia
               _
   _       _ _(_)_     |  Documentation: https://docs.julialang.org
  (_)     | (_) (_)    |
   _ _   _| |_  __ _   |  Type "?" for help, "]?" for Pkg help.
  | | | | | | |/ _` |  |
  | | |_| | | | (_| |  |  Version 1.7.1 (2021-12-22)
 _/ |\__'_|_|_|\__'_|  |  Official https://julialang.org/ release
|__/                   |

(@v1.7) pkg> generate demo
  Generating  project demo:
    demo/Project.toml
    demo/src/demo.jl

(@v1.7) pkg> activate demo
  Activating project at `~/demo`

(demo) pkg> status
     Project demo v0.1.0
      Status `~/demo/Project.toml` (empty project)

(demo) pkg> 
```

### 2. Add the DataStructures dependency

```
(demo) pkg> add DataStructures
    Updating registry at `~/.julia/registries/General.toml`
   Resolving package versions...
    Updating `~/demo/Project.toml`
  [864edb3b] + DataStructures v0.18.11
    Updating `~/demo/Manifest.toml`
  [34da2185] + Compat v3.42.0
  [864edb3b] + DataStructures v0.18.11
  [bac558e1] + OrderedCollections v1.4.1
  [0dad84c5] + ArgTools
  [56f22d72] + Artifacts
  [2a0f44e3] + Base64
  [ade2ca70] + Dates
  [8bb1440f] + DelimitedFiles
  [8ba89e20] + Distributed
  [f43a241f] + Downloads
  [b77e0a4c] + InteractiveUtils
  [b27032c2] + LibCURL
  [76f85450] + LibGit2
  [8f399da3] + Libdl
  [37e2e46d] + LinearAlgebra
  [56ddb016] + Logging
  [d6f4376e] + Markdown
  [a63ad114] + Mmap
  [ca575930] + NetworkOptions
  [44cfe95a] + Pkg
  [de0858da] + Printf
  [3fa0cd96] + REPL
  [9a3f8284] + Random
  [ea8e919c] + SHA
  [9e88b42a] + Serialization
  [1a1011a3] + SharedArrays
  [6462fe0b] + Sockets
  [2f01184e] + SparseArrays
  [10745b16] + Statistics
  [fa267f1f] + TOML
  [a4e569a6] + Tar
  [8dfed614] + Test
  [cf7118a7] + UUIDs
  [4ec0a83e] + Unicode
  [e66e0078] + CompilerSupportLibraries_jll
  [deac9b47] + LibCURL_jll
  [29816b5a] + LibSSH2_jll
  [c8ffd9c3] + MbedTLS_jll
  [14a3606d] + MozillaCACerts_jll
  [4536629a] + OpenBLAS_jll
  [83775a58] + Zlib_jll
  [8e850b90] + libblastrampoline_jll
  [8e850ede] + nghttp2_jll
  [3f19e933] + p7zip_jll
Precompiling project...
  1 dependency successfully precompiled in 1 seconds (9 already precompiled)

(demo) pkg> 
```

### 3. Create your new Julia file

Exit the Julia REPL by hitting the backspace key to go back to Julia prompt and exit() to end the process, then create a new Julia file for your code

```
julia> exit()
$ touch demo/src/Demo.jl
```

### 4. Create grammar file

We use simple calculator grammar for the example. In the `demo/src/grammar.g` add:

```
/**
 * Generated parser in Julia language
 *
 * ./bin/syntax -g examples/calc.jl.g -m lalr1 -o CalcParser.jl
 *
 */

{
  "lex": {
    "rules": [
      ["\\s+",  '# skip whitespace'],
      ["\\d+",  'return "NUMBER"'],
      ["\\*",   'return "*"'],
      ["\\+",   'return "+"'],
      ["\\(",   'return "("'],
      ["\\)",   'return ")"'],
    ]
  },

  "operators": [
    ["left", "+"],
    ["left", "*"],
  ],

  "bnf": {
    "E": [
      ["E + E",  "$$ = $1 + $3"],
      ["E * E",  "$$ = $1 * $3"],
      ["NUMBER", "$$ = tryparse(Int, $1)"],
      ["( E )",  "$$ = $2"],
    ],
  },
}
```

> NOTE: here we used example in JSON format. You can also check [the example](https://github.com/DmitrySoshnikov/syntax/blob/master/examples/letter.jl.bnf) in BISON/YACC format.

Notice that the productions need to conform to Julia syntax, while anything outside these are processed by Javascript. So we use here the ' single quote javascript notation to capture strings fine, but everything inside the production must conform to Julia language specifications.

### 5. Generate the parser

Now using _Syntax_ tool, let's generate the parser from our grammar:

```
syntax-cli -g demo/grammar.g -m LALR1 -o demo/src/SyntaxParser.jl

    ✓ Successfully generated: demo/src/SyntaxParser.jl
```

Notice how we specified the output file to be Julia extension 'jl' which informs syntax to produce a Julia based parser. We also chose `LALR(1)` parsing mode, which is the most practical one.

### 6. Use the parser

Now in the `Demo.jl` we can include and use the parser:


```julia
include("SyntaxParser.jl")

output = SyntaxParser.parse("5 + 5")
print(output)
print("\n")
```
