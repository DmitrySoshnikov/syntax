/**
 * MIPS Assembly parser
 *
 * by Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 * MIT Style License
 *
 * https://en.wikipedia.org/wiki/MIPS_instruction_set
 */

{
  "lex": {
    "macros": {
      "id": "[a-zA-Z0-9_]",
    },

    "rules": [
      [`\\s+`,          `/* skip whitespace */`],
      [`#.*\\n`,        `/* skip comments */`],


      // ------------------------------------------------
      // Strings, chars
      [`"[^"]*"`,       `yytext = yytext.slice(1, -1); return 'STRING';`],
      [`'[^']*'`,       `yytext = yytext.slice(1, -1); return 'CHAR';`],

      // ------------------------------------------------
      // Numeric Reg names (including float) with $ prefix

      [`(\\$)f?(0|[1-9]|1[0-9]|2[0-5]|2[89]|3[0-1])`, `
        return yytext[1] === 'f' ? 'FLOAT_REG' : 'NUM_REG';
      `],

      // ------------------------------------------------
      // Alias Reg names with Opt $ prefix

      [`\\$(` + [
        "zero",
        "at",
        "v0",
        "v1",
        "a0",
        "a1",
        "a2",
        "a3",
        "t0",
        "t1",
        "t2",
        "t3",
        "t4",
        "t5",
        "t6",
        "t7",
        "s0",
        "s1",
        "s2",
        "s3",
        "s4",
        "s5",
        "s6",
        "s7",
        "t8",
        "t9",
        "k0",
        "k1",
        "gp",
        "sp",
        "s8",
        "fp",
        "ra",
      ].join('|') + `)`,  "return 'NAME_REG'"],

      // ------------------------------------------------
      // Data modes

      ["\\.asciiz",       "return '.asciiz'"],
      ["\\.ascii",        "return '.ascii'"],
      ["\\.space",        "return '.space'"],
      ["\\.byte",         "return '.byte'"],
      ["\\.half",         "return '.half'"],
      ["\\.word",         "return '.word'"],
      ["\\.float",        "return '.float'"],
      ["\\.double",       "return '.double'"],

      // ------------------------------------------------
      // Directives

      ["\\.set",          "return 'SET_DIR'"],

      ['(' + [
        "volatile",
        "novolatile",
        "reorder",
        "noreorder",
        "at",
        "noat",
        "macro",
        "nomacro",
        "bopt",
        "nobopt",
        //"move", // handled by OPCODE
        "nomove",
      ].join('|') + ')',  "return 'SET_DIR_ARG'"],

      // Symbol directives

      ["\\.globa?l",      "return 'SYM_GLOB_DIR'"],

      ['(' + [
        "\\.extern",
        "\\.comm",
        "\\.lcomm",
      ].join('|') + ')',  "return 'SYM_CONS_DIR'"],

      ["\\.align",        "return '.align'"],

      // Compiler directives

      ["\\.alias",        "return '.alias'"],
      ["\\.bgnb",         "return '.bgnb'"],
      ["\\.endb",         "return '.endb'"],
      ["\\.file",         "return '.file'"],
      ["\\.galive",       "return '.galive'"],
      ["\\.gjaldef",      "return '.gjaldef'"],
      ["\\.gjrlive",      "return '.gjrlive'"],
      ["\\.lab",          "return '.lab'"],
      ["\\.livereg",      "return '.livereg'"],
      ["\\.noalias",      "return '.noalias'"],
      ["\\.option",       "return '.option'"],
      ["\\.verstamp",     "return '.verstamp'"],
      ["\\.vreg",         "return '.vreg'"],

      // Block directives

      ["\\.ent",          "return '.ent'"],
      ["\\.aent",         "return '.aent'"],
      ["\\.mask",         "return '.mask'"],
      ["\\.fmask",        "return '.fmask'"],
      ["\\.frame",        "return '.frame'"],
      ["\\.end",          "return '.end'"],

      // ------------------------------------------------
      // Segments

      ['(' + [
        "\\.text",
        "\\.data",
        "\\.rdata",
        "\\.sdata",
      ].join('|') + ')',  "return 'SEGMENT'"],

      // ------------------------------------------------
      // OpCodes

      ['(' + [
        "abs",
        "add",
        "addciu",
        "addi",
        "addiu",
        "addu",
        "and",
        "b\\b",
        "bal",
        "bc0f",
        "bc0fl",
        "bc0t",
        "bc0tlbc1f",
        "bc1fl",
        "bc1t",
        "bc1tl",
        "bc2f",
        "bc2fl",
        "bc2t",
        "bc2tl",
        "beq",
        "beql",
        "beqz",
        "beqzl",
        "bge",
        "bgel",
        "bgeu",
        "bgeul",
        "bgez",
        "bgezal",
        "bgezall",
        "bgezl",
        "bgt",
        "bgtl",
        "bgtu",
        "bgtul",
        "bgtz",
        "bgtzl",
        "ble",
        "blel",
        "bleu",
        "bleul",
        "blez",
        "blezl",
        "blt",
        "bltl",
        "bltu",
        "bltul",
        "bltz",
        "bltzal",
        "bltzall",
        "bltzl",
        "bne",
        "bnel",
        "bnez",
        "bnezl",
        "break",
        "cache",
        "cfc0",
        "cfc1",
        "cfc2",
        "ctc0",
        "ctc1",
        "ctc2",
        "div",
        "divd",
        "divdu",
        "divo",
        "divou",
        "divu",
        "eret",
        "ffc",
        "ffs",
        "flushd",
        "j",
        "jr",
        "jal",
        "jalr",
        "la",
        "lb",
        "lbu",
        "ld",
        "ldl",
        "ldr",
        "ldxc1",
        "lh",
        "lhu",
        "li",
        "ll",
        "lld",
        "lui",
        "lw",
        "lwc1",
        "lwl",
        "lwr",
        "lwu",
        "lwxc1",
        "madd",
        "maddu",
        "mad",
        "madu",
        "madd16",
        "max",
        "mfc0",
        "mfc1",
        "mfc2",
        "mfhi",
        "mflo",
        "min",
        "move",
        "movf",
        "movn",
        "movt",
        "movz",
        "msub",
        "msubu",
        "mtc0",
        "mtc1",
        "mtc2",
        "mthi",
        "mtlo",
        "mul",
        "mulu",
        "mulo",
        "mulou",
        "mult",
        "multu",
        "neg",
        "negu",
        "nop",
        "nor",
        "not",
        "or",
        "ori",
        "pref",
        "prefx",
        "r2u",
        "radd",
        "rem",
        "remu",
        "rfe",
        "rmul",
        "rol",
        "ror",
        "rsub",
        "sb",
        "sc",
        "scd",
        "sd",
        "sdbbp",
        "sdc1",
        "sdl",
        "sdr",
        "sdxc1",
        "selsl",
        "selsr",
        "seq",
        "sge",
        "sgeu",
        "sgt",
        "sgtu",
        "sh",
        "sle",
        "sleu",
        "sll",
        "sllv",
        "slt",
        "slti",
        "sltiu",
        "sltu",
        "sne",
        "sra",
        "srav",
        "srl",
        "srlv",
        "standby",
        "sub",
        "subu",
        "suspend",
        "sw",
        "swc1",
        "swl",
        "swr",
        "swxc1",
        "sync",
        "syscall",
        "teq",
        "teqi",
        "tge",
        "tgei",
        "tgeiu",
        "tgeu",
        "tlbp",
        "tlbr",
        "tlbwi",
        "tlbwr",
        "tlt",
        "tlti",
        "tltiu",
        "tltu",
        "tne",
        "tnei",
        "u2r",
        "uld",
        "ulh",
        "ulhu",
        "ulw",
        "usd",
        "ushusw",
        "waiti",
        "wb",
        "xor",
        "xori",
        "abs.s",
        "add.s",
        "c\\.eq\\.s",
        "c\\.f.s",
        "c\\.le\\.s",
        "c\\.lt\\.s",
        "c\\.nge\\.s",
        "c\\.ngl\\.s",
        "c\\.ngt\\.s",
        "c\\.ole\\.s",
        "c\\.olt\\.s",
        "c\\.seq\\.s",
        "c\\.sf.\\s",
        "c\\.ueq\\.s",
        "c\\.ule\\.s",
        "c\\.ult\\.s",
        "c\\.un\\.s",
        "ceil\\.l\\.d",
        "ceil\\.l\\.s",
        "ceil\\.w\\.d",
        "ceil\\.w\\.s",
        "cvt\\.d\\.l",
        "cvt\\.d\\.s",
        "cvt\\.d\\.w",
        "cvt\\.l\\.d",
        "cvt\\.l\\.s",
        "cvt\\.s\\.d",
        "cvt\\.s\\.l",
        "cvt\\.s\\.w",
        "cvt\\.w\\.d",
        "cvt\\.w\\.s",
        "div\\.s",
        "floor\\.l\\.d",
        "floor\\.l\\.s",
        "floor\\.w\\.d",
        "floor\\.w\\.s",
        "l\\.d",
        "l\\.s",
        "ldc1",
        "madd\\.s",
        "mov\\.s",
        "movf\\.s",
        "movn\\.s",
        "movt\\.s",
        "movz\\.s",
        "msub\\.s",
        "mul\\.s",
        "neg\\.s",
        "nmadd\\.s",
        "nmsub\\.s",
        "recip\\.s",
        "round\\.l\\.d",
        "round\\.l\\.s",
        "round\\.w\\.d",
        "round\\.w\\.s",
        "rsqrt\\.s",
        "s\\.d",
        "s\\.s",
        "sqrt\\.s",
        "sub\\.s",
        "trunc\\.l\\.d",
        "trunc\\.l\\.s",
      ].reverse().join('|') + ')', "return 'OPCODE'"],

      // ------------------------------------------------
      // Operators

      ["\\+",                  "return '+'"],
      ["\\-",                  "return '-'"],
      ["\\*",                  "return '*'"],
      ["\\/",                  "return '/'"],

      // ------------------------------------------------
      // Numbers

      ["0x[0-9A-Fa-z]+",       "return 'HEXADECIMAL';"],
      ["\\d*\\.?\\d+",         "return 'DECIMAL';"],

      // ------------------------------------------------
      // Labels and IDs

      ["{id}+\\:", `
        yytext = yytext.slice(0, -1);
        return 'LABEL';
      `],

      ["{id}+",                "return 'ID'"],

      ["\\(",                  "return '('"],
      ["\\)",                  "return ')'"],
      [",",                    "return ','"],
    ],
  },

  // Precedence, and assoc.
  "operators": [
    ["left", "+", "-"],
    ["left", "*", "/"],
    ["left", "UMINUS"],
  ],

  "moduleInclude": `
    // Stores instructions per segment. Initialize to code segment
    // other segments can be added during parsing.

    const segments = {
      '.text': {
        address: null,
        instructions: [],
      },
    };

    // Current segment where the instructions are written,
    // init to the code segment.

    let currentSegment = '.text';

    // Instructions count per segment.
    let instructionsCount = 0;


    // Store labels defined within a segment.
    const labels = {};


    // Stores compiler directives.
    const directives = [];
  `,

  "bnf": {
    "Program":     [["Statements",  "$$ = {type: 'Program', segments, labels, directives}"]],

    "Statements":  ["Statement",
                    "Statements Statement"],

    "Statement":   [["OptLabel Element", `

      if ($1) {
        // TODO: calculate statically and record actual label address in
        // the .text or .data segment.

        labels[$1.value] = {
          address: instructionsCount,
          segment: currentSegment,
        };
      }

      switch ($2.type) {
        case 'Instruction':
        case 'Data':
          instructionsCount++;
          segments[currentSegment].instructions.push($2);
          break;

        case 'Directive':
        case 'Segment':
          directives.push($2);
          break;

        default:
          throw new Error('Unexpected statement: ' + $2.type);
      }

    `]],

    "Element":     [["Instruction",             "$$ = $1"],
                    ["Data",                    "$$ = $1"],
                    ["Directive",               "$$ = $1"]],

    "Instruction": [["OPCODE Operands",         "$$ = {type: 'Instruction', opcode: $1, operands: $2}"]],

    "Operands":    [["Op",                      "$$ = [$1]"],
                    ["Op , Op",                 "$$ = [$1, $3]"],
                    ["Op , Op , Op",            "$$ = [$1, $3, $5]"],
                    ["ε"]],

    "Op":          [["Reg",                      "$$ = $1"],
                    ["AddrImm",                  "$$ = $1"]],

    "Reg":         [["NUM_REG",                  "$$ = {type: 'Register', value: $1, kind: 'Numeric'}"],
                    ["FLOAT_REG",                "$$ = {type: 'Register', value: $1, kind: 'Float'}"],
                    ["NAME_REG",                 "$$ = {type: 'Register', value: $1, kind: 'Name'}"]],

    "RegAddr":     [["( Reg )",                  "$$ = $2"]],

    "AddrImm":     [["OptOffset RegAddr",        "$$ = {type: 'Address', offset: $1, base: $2}"],
                    ["Offset",                   "$$ = $1"]],

    "SignConst":   [["Const",                    "$$ = $1"],
                    ["- Const",                  "$$ = {type: 'Unary', 'operator': '-', value: $2}"]],

    "Offset":      [["SignConst",                "$$ = $1"],
                    ["Const + Const",            "$$ = {type: 'Offset', kind: 'offset', base: $1, offset: $3, operator: '+'}"],
                    ["Const - Const",            "$$ = {type: 'Offset', kind: 'offset', base: $1, offset: $3, operator: '-'}"]],

    "Data":        [["DataMode DataList",        "$$ = {type: 'Data', mode: $1, value: $2}"],
                    [".ascii String",            "$$ = {type: 'Data', mode: $1, value: $2}"],
                    [".asciiz String",           "$$ = {type: 'Data', mode: $1, value: $2}"],
                    [".space Expr",              "$$ = {type: 'Data', mode: $1, value: $2}"]],

    "String":      [["STRING",                   "$$ = {type: 'String', value: $1}"]],

    "DataMode":    [[".byte",                    "$$ = $1"],
                    [".half",                    "$$ = $1"],
                    [".word",                    "$$ = $1"],
                    [".float",                   "$$ = $1"],
                    [".double",                  "$$ = $1"]],

    "DataList":    [["Expr",                     "$$ = [$1]"],
                    ["DataList , Expr",          "$1.push($3); $$ = $1;"]],

    "Directive":   [["SetDir",                   "$$ = $1"],
                    ["SegmentDir",               "$$ = $1"],
                    ["SymbolDir",                "$$ = $1"],
                    ["AlignDir",                 "$$ = $1"],
                    ["CompilerDir",              "$$ = $1"]],

    "SegmentDir":  [["SEGMENT OptNumber",  `

        // Record current segment on entering it.

        currentSegment = $1;
        instructionsCount = 0;

        // If address is specified, the segmented starts
        // at that specific memory location.

        const address = $2 ? $2.value : null;

        $$ = {
          type: 'Segment',
          value: $1,
          address,
        };

        // Initialize the segment if it's not allocated yet.

        if (!segments[$1]) {
          segments[$1] = {
            address,
            instructions: [],
          };
        }
    `]],

    "SetDir":      [["SET_DIR SetDirArg",        "$$ = {type: 'Directive', kind: 'set', argument: $2}"]],

    "SetDirArg":   [["SET_DIR_ARG",              "$$ = $1"],
                    ["OPCODE",                   "$$ = $1"]],

    "SymbolDir":   [["SYM_GLOB_DIR ID",          "$$ = {type: 'Directive', kind: 'symbol', directive: $1, name: $2}"],
                    ["SYM_CONS_DIR ID , Const",  "$$ = {type: 'Directive', kind: 'symbol', directive: $1, name: $2, value: $4}"]],

    "AlignDir":    [[".align , Expr",            "$$ = {type: 'Directive', kind: 'align', expression: $3}"]],

    "CompilerDir": [[".alias Reg , Reg",         "$$ = {type: 'Directive', kind: 'compiler', directive: $1, reg1: $2, reg2: $4}"],
                    [".bgnb Expr",               "$$ = {type: 'Directive', kind: 'compiler', directive: $1, expression: $2}"],
                    [".endb Expr",               "$$ = {type: 'Directive', kind: 'compiler', directive: $1, expression: $2}"],
                    [".file Const STRING",       "$$ = {type: 'Directive', kind: 'compiler', directive: $1, name: $2, path: $3}"],
                    [".galive",                  "$$ = {type: 'Directive', kind: 'compiler', directive: $1}"],
                    [".gjaldef",                 "$$ = {type: 'Directive', kind: 'compiler', directive: $1}"],
                    [".gjrlive",                 "$$ = {type: 'Directive', kind: 'compiler', directive: $1}"],
                    [".lab ID",                  "$$ = {type: 'Directive', kind: 'compiler', directive: $1, name: $2}"],
                    [".livereg Expr , Expr",     "$$ = {type: 'Directive', kind: 'compiler', directive: $1, expr1: $2, expr2: $4}"],
                    [".noalias Reg , Reg",       "$$ = {type: 'Directive', kind: 'compiler', directive: $1, reg1: $2, reg2: $4}"],
                    [".option 'flag'",           "$$ = {type: 'Directive', kind: 'compiler', directive: $1, flag: $2}"],
                    [".verstamp Const Const",    "$$ = {type: 'Directive', kind: 'compiler', directive: $1, value1: $2, value2: $3}"],
                    [".vreg Expr , Expr",        "$$ = {type: 'Directive', kind: 'compiler', directive: $1, expr1: $2, expr2: $4}"]],

    "BlockDir":    [[".ent OptConst",            "$$ = {type: 'Directive', kind: 'block', directive: $1, value: $2}"],
                    [".aent ID , Const",         "$$ = {type: 'Directive', kind: 'block', directive: $1, name: $2, value: $4}"],
                    [".mask Expr , Expr",        "$$ = {type: 'Directive', kind: 'block', directive: $1, expr1: $2, expr2: $4}"],
                    [".fmask Expr , Expr",       "$$ = {type: 'Directive', kind: 'block', directive: $1, name: $2, value: $4}"],
                    [".frame Reg , Expr , Reg",  "$$ = {type: 'Directive', kind: 'block', directive: $1, reg1: $2, value: $4, reg2: $6}"],
                    [".end OptID",               "$$ = {type: 'Directive', kind: 'block', directive: $1, name: $2}"]],

    "OptConst":    [["Const",          "$$ = $1"],
                    ["ε"]],

    "OptNumber":   [["Number",         "$$ = $1"],
                    ["ε"]],

    "OptID":       [["ID",             "$$ = $1"],
                    ["ε"]],

    "OptOffset":   [["Offset",         "$$ = $1"],
                    ["ε",              "$$ = {type: 'Offset', kind: 'Const', value: 0}"]],

    "OptLabel":    [["LABEL",          "$$ = {type: 'Label', value: $1}"],
                    ["ε"]],

    "Expr":        [["Expr + Expr",    "$$ = {type: 'Binary', 'operator': '+', left: $1, right: $3}"],
                    ["Expr - Expr",    "$$ = {type: 'Binary', 'operator': '-', left: $1, right: $3}"],
                    ["Expr * Expr",    "$$ = {type: 'Binary', 'operator': '*', left: $1, right: $3}"],
                    ["Expr / Expr",    "$$ = {type: 'Binary', 'operator': '/', left: $1, right: $3}"],
                    ["( Expr )",       "$$ = $2"],
                    ["- Expr",         "$$ = {type: 'Unary', 'operator': '-', value: $2}", {prec: 'UMINUS'}],
                    ["Const",          "$$ = $1"]],

    "Number":      [["DECIMAL",        "$$ = {type: 'Number', kind: 'decimal', value: $1}"],
                    ["HEXADECIMAL",    "$$ = {type: 'Number', kind: 'hex', value: $1}"]],

    "Const":       [["Number",         "$$ = $1"],
                    ["CHAR",           "$$ = {type: 'Char', value: $1}"],
                    ["ID",             "$$ = {type: 'Identifier', value: $1}"]],
  }
}