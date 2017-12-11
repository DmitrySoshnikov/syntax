/**
 * HDL (Hardware-definition langauge) syntactic grammar.
 *
 * How to run:
 *
 * ./bin/syntax -g examples/hdl.g -m lalr1 -f examples/and.hdl
 */

%lex

%%

\/\/.*              /* skip comments */
\/\*(.|\s)*?\*\/    /* skip comments */

\s+                 /* skip whitespace */

CHIP                return 'CHIP'
IN                  return 'IN'
OUT                 return 'OUT'
PARTS               return 'PARTS'

\w+                 return 'ID'

/lex

%{

/**
 * List of inputs for this chip.
 */
let inputs = [];

/**
 * List of outputs for this chip.
 */
let outputs = [];

/**
 * Actual definitions.
 */
let parts = [];

%}

%%

Chip
  : CHIP Name '{' Sections '}' {
      $$ = {
        type: 'Chip',
        name: $2,
        inputs,
        outputs,
        parts,
      };
    }
  ;

Sections
  : Section Section Section
  ;

Section
  : Inputs
  | Outputs
  | Parts
  ;

Inputs
  : IN Names ';' {
      inputs.push(...$2);
    }
  ;

Outputs
  : OUT Names ';' {
      outputs.push(...$2);
    }
  ;

Parts
  : PARTS ':' ChipCalls {
      parts.push(...$3);
    }
  ;

Names
  : Name
    { $$ = [$1]; }

  | Names ',' Name
    { $1.push($3); $$ = $1; }
  ;

Name
  : ID
  | CHIP
  | IN
  | OUT
  | PARTS
  ;

ChipCalls
  : ChipCall
    { $$ = [$1] }

  | ChipCalls ChipCall
    { $1.push($2); $$ = $1 }
  ;

ChipCall
  : ID '(' ArgsList ')' ';' {
      $$ = {
        type: 'ChipCall',
        name: $1,
        arguments: $3,
      }
    }
  ;

ArgsList
  : Arg
    { $$ = [$1] }

  | ArgsList ',' Arg
    { $1.push($3); $$ = $1 }
  ;

Arg
  : ID '=' ID {
      $$ = {
        type: 'Argument',
        name: $1,
        value: $3,
      }
    }
  ;