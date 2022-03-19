module SyntaxParser

#=
  LR parser generated by the Syntax tool.
 
  https://www.npmjs.com/package/syntax-cli
 
    npm install -g syntax-cli
 
    syntax-cli --help
 
  To regenerate run:
 
    syntax-cli \
      --grammar ~/path-to-grammar-file \
      --mode <parsing-mode> \
      --output ~/ParserClassName.jl
=#

# --------------------------------------------------------------
# Shared includes
using DataStructures;

# Constants and globals
const EOF = "\$"
yytext = ""
yylength = 0
__res = nothing
__loc = nothing
should_capture_locations = {{{CAPTURE_LOCATIONS}}}

# Types
struct SyntaxError <: Exception
  msg::AbstractString
end

function Base.showerror(io::IO, err::SyntaxError)
  print(io, err.msg)
end

Base.@kwdef mutable struct yyLoc
  startoffset
  endoffset
  startline
  endline
  startcolumn
  endcolumn
end

Base.@kwdef mutable struct StackEntry
  symbol
  semanticValue
  loc
end

# --------------------------------------------------------------
# Module includes provided by the grammar.
{{{MODULE_INCLUDE}}}

# --------------------------------------------------------------
# Tokenizer.

{{{TOKENIZER}}}

#=
  Throws default "Unexpected token" exception, showing the actual
  line from the source, pointing with the ^ marker to the bad token.
  In addition, shows line:column location.
=#
function throwUnexpectedToken(tokenizerData::TokenizerData, symbol, line::Int, column::Int)
  throw(SyntaxError(string("Incorrect Syntax\n\n", split(tokenizerData.initstring, "\n")[line], "\n", " "^(column - 1), "^\nUnexpected Token: \"", symbol, "\" at ", line, ":", column, ".")))
end

# --------------------------------------------------------------
# Parser implementation

function yyloc(start, ending)
  !should_capture_locations && return nothing

  if isnothing(start) || isnothing(ending)
    return isnothing(start) ? ending : start
  end

  return yyLoc(
    startoffset = start.startoffset,
    endoffset = ending.endoffset,
    startline = start.startline,
    endline = ending.endline,
    startcolumn = start.startcolumn,
    endcolumn = ending.endcolumn
  )
end

function yyloc(token)
  !should_capture_locations && return nothing
  isnothing(token) && return nothing
  return yyLoc(
    startoffset = token.startoffset,
    endoffset = token.endoffset,
    startline = token.startline,
    endline = token.endline,
    startcolumn = token.startcolumn,
    endcolumn = token.endcolumn
  )
end

{{{PRODUCTION_HANDLERS}}}

# blank stand-ins for begin and end
function parseBegin()
end

function parseEnd(value)
end

#=
  Primary parsing function
    ss - the code to parse, in a String
    onParseBegin - a function to call when parsing begins
    onParseEnd - a function to call when parsing ends, should accept as a single argument with the parsed value result
=#
# Q for Dmetry: ok to default tokenizer here? other implementations throw but I wanted to keep the parse interface to only the string required
function parse(ss::String; tokenizerInitFunction::Function = initTokenizer, onParseBegin::Function = parseBegin, onParseEnd::Function = parseEnd)
  # constants inserted by the parser generator
  productions = {{{PRODUCTIONS}}} # [[1, 2, "handler1"], [3, 4, "handler2], ...] i.e. Vector{Vector{Union{Integer, String}}}
  table = {{{TABLE}}} # i.e. Dict{Int, String}

  # initialization and prep for parsing
  !isnothing(onParseBegin) && onParseBegin()
  tokenizerData = tokenizerInitFunction(ss)
  stack = Stack{Union{StackEntry, Integer}}()
  push!(stack, 0)

  # begin parsing
  token = getNextToken!(tokenizerData)
  shiftedToken = nothing
  while hasMoreTokens(tokenizerData) || !isempty(stack)
    # get a token and look it up in our parsing table
    isnothing(token) && unexpectedEndOfInput()
    state = first(stack)
    column = token.type
    entry = get(table[state + 1], column, nothing)
    if isnothing(entry)
      unexpectedToken(tokenizerData, token)
      break
    end

    # found 'shift' instruction, which starts with s then has <next state number> - i.e. s5 means "shift to state 5"
    if entry[1] == 's'
      push!(stack, StackEntry(symbol = token.type, semanticValue = token.value, loc = yyloc(token)))
      push!(stack, tryparse(Int, SubString(entry, 2)))
      shiftedToken = token
      token = getNextToken!(tokenizerData)

    # found "reduce" instruction, which starts with r then has <production number> to reduce by - i.e. r2 means "reduce by production 2"
    elseif entry[1] == 'r'
      production = productions[tryparse(Int, SubString(entry, 2)) + 1]

      # Handler can be optional: [0, 3] - no handler, [0, 3, "_handler1"] - has handler.
      hasSemanticAction = length(production) > 2
      semanticValueArgs = Vector{Any}()
      locationArgs = should_capture_locations ? Vector{Any}() : nothing
      rhsLength = production[2]
      if rhsLength != 0
        while rhsLength > 0
          # pop the state number
          pop!(stack)

          # pop the stack entry
          stackEntry = pop!(stack)

          # collection all the semantic values from the stack to the argument list, which will be passed to the action handler
          if hasSemanticAction
            pushfirst!(semanticValueArgs, stackEntry.semanticValue)
            should_capture_locations && pushfirst!(locationArgs, stackEntry.loc)
          end
          rhsLength -= 1
        end
      end
      previousState = first(stack)
      symbolToProduceWith = production[1]
      reduceStackEntry = StackEntry(symbol = symbolToProduceWith, semanticValue = nothing, loc = nothing)
      if hasSemanticAction
        global yytext = isnothing(shiftedToken) ? nothing : shiftedToken.value
        global yylength = isnothing(shiftedToken) ? 0 : length(shiftedToken.value)
        semanticActionHandler = getfield(SyntaxParser, Symbol(production[3]))
        semanticActionArgs = semanticValueArgs
        if should_capture_locations
          semanticActionArgs = vcat(semanticActionArgs, locationArgs)
        end
        
        # call the handler the result is put in __res, which is accessed/assigned to by for example $$ = <something> in the grammar
        semanticActionHandler(semanticActionArgs...)
        reduceStackEntry.semanticValue = __res
        if should_capture_locations
          reduceStackEntry.loc = __loc
        end
      end
      push!(stack, reduceStackEntry)
      push!(stack, tryparse(Int, table[previousState + 1][symbolToProduceWith]))

    # Accepted; time to pop the starting production and it's state number
    elseif entry == "acc"
      # pop the state number and get the parsed value 
      pop!(stack)
      parsed = pop!(stack)

      # Check for if the stack has other stuff on it, which would be bad
      if length(stack) != 1 || first(stack) != 0 || hasMoreTokens(tokenizerData)
        unexpectedToken(tokenizerData, token)
      end

      # success!
      parsedValue = parsed.semanticValue
      !isnothing(onParseEnd) && onParseEnd(parsedValue)
      return parsedValue
    end
  end

  # if we got here, we failed to parse and failed to throw an exception about why we failed to parse...
  return nothing
end

function unexpectedToken(tokenizerData::TokenizerData, token::Token)
  if token.type == tokenizerData.EOF_TOKEN.type
    unexpectedEndOfInput()
  else
    throwUnexpectedToken(tokenizerData, token.value, token.startline, token.startcolumn)
  end
end

function unexpectedEndOfInput()
  parseError("Unexpected end of input.")
end

function parseError(message::String)
  throw(SyntaxError(message))
end

end # module