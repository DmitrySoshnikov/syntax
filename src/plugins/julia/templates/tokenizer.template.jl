#=
  Julia tokenizer for use with the Syntax tool

  https:#www.npmjs.com/package/syntax-cli

  See `--custom-tokenizer` to skip this generation, and use a custom one.

=#

using DataStructures;

# probably needs to be moved to parser template instead
struct SyntaxError <: Exception end

# for now placed here, probably belong somewhere else but not sure where yet
global yytext::String
global yylength::Int

#  Token: encapsulates token type, the matched value, and also location data.
Base.@kwdef mutable struct Token
    type::Int
    value::String
    startOffset::Int = 1
    endOffset::Int = 1
    startLine::Int = 1
    endLine::Int = 1
    startColumn::Int = 1
    endColumn::Int = 1
end

# TokenizerData: state of the tokenizer process
Base.@kwdef mutable struct TokenizerData
  tokensDict = {{{TOKENS}}}
  EOF_TOKEN = Token(type = tokensDict["[EOF]"], value = "")
  lexRules = {{{LEX_RULES}}}
  lexRulesByConditionsDict = {{{LEX_RULES_BY_START_CONDITIONS}}}
  initstring::String
  states::Stack{String}
  cursor::Int = 1
  tokensQueue::Queue{String}
  currentLine = 1
  currentColumn = 1
  currentLineBeginOffset = 1
  tokenStartOffset = 1
  tokenEndOffset = 1
  tokenStartLine = 1
  tokenEndLine = 1
  tokenStartColumn = 1
  tokenEndColumn = 1
end

# injected by parser
{{{LEX_RULE_HANDLERS}}}

function initTokenizer(tokenizingString::String)
  mydata = TokenizerData(
    initString = tokenizingString,
    states = Stack{String}(),
    tokensQueue = Queue{String}()
  )
  push!(mydata.states, "INITIAL")
  return mydata
end

#=
  All functions take the TokenizerData structure as a first value,
  similar to "self" pattern in other languages.

  Note that by convention in Julia, functions that change their
  arguments have ! which provides clarity to the user.
=# 
function getCurrentState(tokenizerData::TokenizerData)
  return first(tokenizerData.states)
end

function pushState!(tokenizerData::TokenizerData, newState::String)
  push!(tokenizerData.states, newState)
end

function begin!(tokenizerData::TokenizerData, beginState::String)
  pushState!(tokenizerData, beginState)
end

function popState!(tokenizerData::TokenizerData)
  return pop!(tokenizerData.states)
end

function getNextToken!(tokenizerData::TokenizerData)
  if (!isempty(tokenizerData.tokensQueue))
    # process tokens waiting in the queue
    return toToken(tokenizerData, dequeue(tokenizerData.tokensQueue), "")
  end
  if (!hasMoreTokens)
    return tokenizerData.EOF_TOKEN
  end

  ss = SubString(tokenizerData.initstring, tokenizerData.cursor)
  lexrulesforstate = tokenizerData.lexRulesByConditionsDict[getCurrentState(tokenizerData)]
  # loop through all the lexer rules for this state to see what we can match
  for rule ∈ lexrulesforstate
    match = match(rule[1], ss)
    local matchstr = ""
    if (!isnothing(match))
      matchstr = match.match
      captureLocation(tokenizerData, matchstr)
      tokenizerData.cursor += length(match)
    end
    # EOF token
    if (length(ss) == 0 && !isnothing(match) && length(match) == 0)
      tokenizerData.cursor += 1
    end
    if (!isnothing(match))
      yytext = matchstr
      yylength = length(match)
      tokens = (rule[2])(tokenizerData)
      local token
      if (isnothing(tokens))
        return getNextToken(tokenizerData)
      end
      if (tokens isa AbstractVector)
        token = tokens[1]
        for i in 2:length(tokens)
          enqueue!(tokenizerData.tokensQueue, tokens[i])
        end
      else
        token = tokens
      end
      return toToken(tokenizerData, token, yytext)
    end
  end

  # If we are at the end of the file, push the cursor past the end and return that we have eaten EOF
  if (isEOF(tokenizerData))
    tokenizerData.cursor += 1
    return tokenizerData.EOF_TOKEN
  end
  # we should not have reached here
  throwUnexpectedToken(tokenizerData, ss[1], tokenizerData.currentLine, tokenizerData.currentColumn)
end

# Given a string that matches a token, captures the location and start/end offsets
function captureLocation(tokenizerData::TokenizerData, matched::String)
  newline = r"\n"

  # absolute offsets
  tokenizerData.tokenStartOffset = tokenizerData.cursor

  # token start line-based locations
  tokenizerData.tokenStartLine = tokenizerData.currentLine
  tokenizerData.tokenStartColumn = tokenizerData.tokenStartOffset - tokenizerData.currentLineBeginOffset

  # extract new line in the matched token
  for i in [x.offset for x in eachmatch(newline,matched)]
    tokenizerData.currentLine += 1
    tokenizerData.currentLineBeginOffset = tokenizerData.tokenStartOffset + i + 1
  end
  tokenizerData.tokenEndOffset = tokenizerData.cursor + length(matched)

  # token end line-based locations
  tokenizerData.tokenEndLine = tokenizerData.currentLine
  tokenizerData.tokenEndColumn = tokenizerData.currentColumn = tokenizerData.tokenEndOffset - tokenizerData.currentLineBeginOffset
end

function toToken(tokenizerData::TokenizerData, tokenType::String, yytext::String)
  return Token(
      type = tokenizerData.tokensDict[tokenType],
      value = yytext,
      startOffset = tokenizerData.tokenStartOffset,
      endOffset = tokenizerData.tokenEndOffset,
      startLine = tokenizerData.tokenStartLine,
      endLine = tokenizerData.tokenEndLine,
      startColumn = tokenizerData.tokenStartColumn,
      endColumn = tokenizerData.tokenEndColumn
    )
end

function hasMoreTokens(tokenizerData::TokenizerData)
  return tokenizerData.cursor <= length(tokenizerData.initstring)
end

function isEOF(tokenizerData::TokenizerData)
  return tokenizerData.cursor == (length(tokenizerData.initstring) + 1)
end

#=
  Throws default "Unexpected token" exception, showing the actual
  line from the source, pointing with the ^ marker to the bad token.
  In addition, shows line:column location.
=#
function throwUnexpectedToken(tokenizerData::TokenizerData, symbol::String, line::Int, column::Int)
  message = string("\n\n", split(tokenizerData.initstring, "\n")[line], "\n", " "^(column - 1), "^\nUnexpected Token: \"", symbol, "\" at ", line, ":", column, ".")
  throw(SyntaxError(message))
end
