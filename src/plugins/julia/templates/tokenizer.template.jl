#=
  Julia tokenizer for use with the Syntax tool

  https:#www.npmjs.com/package/syntax-cli

  See `--custom-tokenizer` to skip this generation, and use a custom one.

=#

#  Token: encapsulates token type, the matched value, and also location data.
Base.@kwdef mutable struct Token
    type::Int
    value::String
    startoffset = 1
    endoffset = 1
    startline = 1
    endline = 1
    startcolumn = 1
    endcolumn = 1
end

# TokenizerData: state of the tokenizer process
Base.@kwdef mutable struct TokenizerData
    tokensDict = {{{TOKENS}}}
    EOF_TOKEN = Token(type = tokensDict[EOF], value = EOF)
    lexRules = {{{LEX_RULES}}}
    lexRulesByConditionsDict = {{{LEX_RULES_BY_START_CONDITIONS}}}
    initstring
    states::Stack{String}
    cursor = 1
    tokensQueue::Queue{String}
    currentLine = 1
    currentColumn = 1
    currentLineBeginOffset = 1
    tokenStartoffset = 1
    tokenEndoffset = 1
    tokenStartline = 1
    tokenEndline = 1
    tokenStartcolumn = 1
    tokenEndcolumn = 1
end

# injected by parser
{{{LEX_RULE_HANDLERS}}}

#=
  Throws default "Unexpected token" exception, showing the actual
  line from the source, pointing with the ^ marker to the bad token.
  In addition, shows line:column location.
=#
function throwunexpectedtoken(tokenizerData::TokenizerData, symbol, line::Integer, column::Integer)
    throw(SyntaxError(string("\n\n", split(tokenizerData.initstring, "\n")[line], "\n", " "^(column - 1), "^\nUnexpected Token: \"", symbol, "\" at ", line, ":", column, ".")))
end

function inittokenizer(tokenizingString::AbstractString)
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
function getcurrentstate(tokenizerData::TokenizerData)
    return first(tokenizerData.states)
end

function pushstate!(tokenizerData::TokenizerData, newState::AbstractString)
    push!(tokenizerData.states, newState)
end

function begin!(tokenizerData::TokenizerData, beginState::AbstractString)
    pushstate!(tokenizerData, beginState)
end

function popstate!(tokenizerData::TokenizerData)
    return pop!(tokenizerData.states)
end

function getnexttoken!(tokenizerData::TokenizerData)
    if !isempty(tokenizerData.tokensQueue)
        # process tokens waiting in the queue
        return totoken(tokenizerData, dequeue(tokenizerData.tokensQueue), "")
    end
    if !hasmoretokens(tokenizerData)
        return tokenizerData.EOF_TOKEN
    end

    ss = SubString(tokenizerData.initstring, tokenizerData.cursor)
    lexrulesforstate = tokenizerData.lexRulesByConditionsDict[getcurrentstate(tokenizerData)]
    # loop through all the lexer rules for this state to see what we can match
    for rulenum ∈ lexrulesforstate
        rule = tokenizerData.lexRules[rulenum+1]
        regexmatch = match(rule[1], ss)
        matchstr = ""
        if !isnothing(regexmatch)
            matchstr = regexmatch.match
            capturelocation(tokenizerData, matchstr)
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
            rulefunction = getfield(SyntaxParser, Symbol(rule[2]))
            tokens = rulefunction()
            local token
            if isnothing(tokens)
                return getnexttoken!(tokenizerData)
            end
            if tokens isa AbstractVector
                token = tokens[1]
                for i in 2:length(tokens)
                    enqueue!(tokenizerData.tokensQueue, tokens[i])
                end
            else
                token = tokens
            end
            return totoken(tokenizerData, token, yytext)
        end
    end

    # If we are at the end of the file, push the cursor past the end and return that we have eaten EOF
    if isEOF(tokenizerData)
        tokenizerData.cursor += 1
        return tokenizerData.EOF_TOKEN
    end
    # we should not have reached here
    throwunexpectedtoken(tokenizerData, ss[1], tokenizerData.currentLine, tokenizerData.currentColumn)
end

# Given a string that matches a token, captures the location and start/end offsets
function capturelocation(tokenizerData::TokenizerData, matched::AbstractString)
    newline = r"\n"

    # absolute offsets
    tokenizerData.tokenStartoffset = tokenizerData.cursor

    # token start line-based locations
    tokenizerData.tokenStartline = tokenizerData.currentLine
    tokenizerData.tokenStartcolumn = tokenizerData.tokenStartoffset - tokenizerData.currentLineBeginOffset + 1

    # extract new line in the matched token
    for i in [x.offset for x in eachmatch(newline, matched)]
        tokenizerData.currentLine += 1
        tokenizerData.currentLineBeginOffset = tokenizerData.tokenStartoffset + i
    end
    tokenizerData.tokenEndoffset = tokenizerData.cursor + length(matched)

    # token end line-based locations
    tokenizerData.tokenEndline = tokenizerData.currentLine
    tokenizerData.tokenEndcolumn = tokenizerData.currentColumn = tokenizerData.tokenEndoffset - tokenizerData.currentLineBeginOffset
end

function totoken(tokenizerData::TokenizerData, tokenType::AbstractString, yytext::AbstractString)
    return Token(
        type = tokenizerData.tokensDict[tokenType],
        value = yytext,
        startoffset = tokenizerData.tokenStartoffset,
        endoffset = tokenizerData.tokenEndoffset,
        startline = tokenizerData.tokenStartline,
        endline = tokenizerData.tokenEndline,
        startcolumn = tokenizerData.tokenStartcolumn,
        endcolumn = tokenizerData.tokenEndcolumn
    )
end

function hasmoretokens(tokenizerData::TokenizerData)
    return tokenizerData.cursor <= length(tokenizerData.initstring)
end

function isEOF(tokenizerData::TokenizerData)
    return tokenizerData.cursor == (length(tokenizerData.initstring) + 1)
end
