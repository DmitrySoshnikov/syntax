#=
  Julia tokenizer for use with the Syntax tool

  https:#www.npmjs.com/package/syntax-cli

  See `--custom-tokenizer` to skip this generation, and use a custom one.

=#

#  Token: encapsulates token type, the matched value, and also location data.
Base.@kwdef mutable struct Token
    type::Int
    value::String
    startOffset::Int = 0
    endOffset::Int = 0
    startLine::Int = 1
    endLine::Int = 1
    startColumn::Int = 1
    endColumn::Int = 1
end

# TokenizerData: state of the tokenizer process
Base.@kwdef mutable struct TokenizerData
  tokensDict = {{{TOKENS}}}
  EOF_TOKEN = Token(type = tokensDict[EOF], value = EOF)
  lexRules = {{{LEX_RULES}}}
  lexRulesByConditionsDict = {{{LEX_RULES_BY_START_CONDITIONS}}}
  initstring::String
  states::Stack{String}
  cursor::Int = 1
  tokensQueue::Queue{String}
  currentLine = 1
  currentColumn = 1
  currentLineBeginOffset = 0
  tokenStartOffset = 0
  tokenEndOffset = 0
  tokenStartLine = 1
  tokenEndLine = 1
  tokenStartColumn = 1
  tokenEndColumn = 1
end

# injected by parser
{{{LEX_RULE_HANDLERS}}}

function initTokenizer(tokenizingString::AbstractString)
  mydata = TokenizerData(
    initstring = tokenizingString,
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

function pushState!(tokenizerData::TokenizerData, newState::AbstractString)
  push!(tokenizerData.states, newState)
end

function begin!(tokenizerData::TokenizerData, beginState::AbstractString)
  pushState!(tokenizerData, beginState)
end

function popState!(tokenizerData::TokenizerData)
  return pop!(tokenizerData.states)
end

function getNextToken!(tokenizerData::TokenizerData)
  if !isempty(tokenizerData.tokensQueue)
    # process tokens waiting in the queue
    return toToken(tokenizerData, dequeue(tokenizerData.tokensQueue), "")
  end
  if !hasMoreTokens(tokenizerData)
    return tokenizerData.EOF_TOKEN
  end

  ss = SubString(tokenizerData.initstring, tokenizerData.cursor)
  lexrulesforstate = tokenizerData.lexRulesByConditionsDict[getCurrentState(tokenizerData)]
  # loop through all the lexer rules for this state to see what we can match
  for rulenum ∈ lexrulesforstate
    rule = tokenizerData.lexRules[rulenum + 1]
    regexmatch = match(rule[1], ss)
    matchstr = ""
    if !isnothing(regexmatch)
      matchstr = regexmatch.match
      captureLocation(tokenizerData, matchstr)
      tokenizerData.cursor += length(matchstr)
    end
    # EOF token
    if length(ss) == 0 && !isnothing(regexmatch) && length(matchstr) == 0
      tokenizerData.cursor += 1
    end
    if !isnothing(regexmatch)
      global yytext = matchstr
      global yylength = length(matchstr)

      # the rules have strings that represent the names of functions to call
      ruleFunction = getfield(SyntaxParser, Symbol(rule[2]))
      tokens = ruleFunction()
      local token
      if isnothing(tokens)
        return getNextToken!(tokenizerData)
      end
      if tokens isa AbstractVector
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
  if isEOF(tokenizerData)
    tokenizerData.cursor += 1
    return tokenizerData.EOF_TOKEN
  end
  # we should not have reached here
  throwUnexpectedToken(tokenizerData, ss[1], tokenizerData.currentLine, tokenizerData.currentColumn)
end

# Given a string that matches a token, captures the location and start/end offsets
function captureLocation(tokenizerData::TokenizerData, matched::AbstractString)
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

function toToken(tokenizerData::TokenizerData, tokenType::AbstractString, yytext::AbstractString)
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
