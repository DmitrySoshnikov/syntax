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
    initstring::String
    states::Stack{String}
    cursor = 1
    tokensqueue::Queue{String}
    currentline = 1
    currentcolumn = 1
    currentlinebeginoffset = 1
    tokenstartoffset = 1
    tokenendoffset = 1
    tokenstartline = 1
    tokenendline = 1
    tokenstartcolumn = 1
    tokenendcolumn = 1
end

# constant tokenization values and lexical rules injected by the parser generator when it processes the lexical grammar definition
const tokensdict = {{{TOKENS}}}
const EOF_TOKEN = Token(type = tokensdict[EOF], value = EOF)
const lexrules = {{{LEX_RULES}}}
const lexrulesbyconditionsdict = {{{LEX_RULES_BY_START_CONDITIONS}}}

# Lexical rule handlers are injected by the parser generator based on the lexical grammar specification
{{{LEX_RULE_HANDLERS}}}

#=
  Throws default "Unexpected token" exception, showing the actual
  line from the source, pointing with the ^ marker to the bad token.
  In addition, shows line:column location.
=#
function throwunexpectedtoken(tokenizerdata::TokenizerData, symbol, line::Integer, column::Integer)
    throw(SyntaxError(string("\n\n", split(tokenizerdata.initstring, "\n")[line], "\n", " "^(column - 1), "^\nUnexpected Token: \"", symbol, "\" at ", line, ":", column, ".")))
end

function inittokenizer(tokenizingstring)
    mydata = TokenizerData(
        initstring = tokenizingstring,
        states = Stack{String}(),
        tokensqueue = Queue{String}()
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
function getcurrentstate(tokenizerdata::TokenizerData)
    return first(tokenizerdata.states)
end

function pushstate!(tokenizerdata::TokenizerData, newstate)
    push!(tokenizerdata.states, newstate)
end

function begin!(tokenizerdata::TokenizerData, beginstate)
    pushstate!(tokenizerdata, beginstate)
end

function popstate!(tokenizerdata::TokenizerData)
    return pop!(tokenizerdata.states)
end

function getnexttoken!(parserdata::ParserData, tokenizerdata::TokenizerData)
    if !isempty(tokenizerdata.tokensqueue)
        # process tokens waiting in the queue
        return totoken(tokenizerdata, dequeue(tokenizerdata.tokensqueue), "")
    end
    if !hasmoretokens(tokenizerdata)
        return EOF_TOKEN
    end

    ss = SubString(tokenizerdata.initstring, tokenizerdata.cursor)
    lexrulesforstate = lexrulesbyconditionsdict[getcurrentstate(tokenizerdata)]
    # loop through all the lexer rules for this state to see what we can match
    for rulenum ∈ lexrulesforstate
        rule = lexrules[rulenum+1]
        regexmatch = match(rule[1], ss)
        matchstr = ""
        if !isnothing(regexmatch)
            matchstr = regexmatch.match
            capturelocation(tokenizerdata, matchstr)
            tokenizerdata.cursor += length(matchstr)
        end
        # EOF token
        if length(ss) == 0 && !isnothing(regexmatch) && length(matchstr) == 0
            tokenizerdata.cursor += 1
        end
        if !isnothing(regexmatch)
            parserdata.yytext = matchstr
            parserdata.yylength = length(matchstr)

            # the rules have strings that represent the names of functions to call
            rulefunction = getfield(SyntaxParser, Symbol(rule[2]))
            tokens = rulefunction()
            local token
            if isnothing(tokens)
                return getnexttoken!(parserdata, tokenizerdata)::Token
            end
            if tokens isa AbstractVector
                token = tokens[1]
                for i in 2:length(tokens)
                    enqueue!(tokenizerdata.tokensqueue, tokens[i])
                end
            else
                token = tokens
            end
            return totoken(tokenizerdata, token, parserdata.yytext)
        end
    end

    # If we are at the end of the file, push the cursor past the end and return that we have eaten EOF
    if isEOF(tokenizerdata)
        tokenizerdata.cursor += 1
        return EOF_TOKEN
    end
    # we should not have reached here
    throwunexpectedtoken(tokenizerdata, ss[1], tokenizerdata.currentline, tokenizerdata.currentcolumn)
end

# Given a string that matches a token, captures the location and start/end offsets
function capturelocation(tokenizerdata::TokenizerData, matched)
    newline = r"\n"

    # absolute offsets
    tokenizerdata.tokenstartoffset = tokenizerdata.cursor

    # token start line-based locations
    tokenizerdata.tokenstartline = tokenizerdata.currentline
    tokenizerdata.tokenstartcolumn = tokenizerdata.tokenstartoffset - tokenizerdata.currentlinebeginoffset + 1

    # extract new line in the matched token
    for i in [x.offset for x in eachmatch(newline, matched)]
        tokenizerdata.currentline += 1
        tokenizerdata.currentlinebeginoffset = tokenizerdata.tokenstartoffset + i
    end
    tokenizerdata.tokenendoffset = tokenizerdata.cursor + length(matched)

    # token end line-based locations
    tokenizerdata.tokenendline = tokenizerdata.currentline
    tokenizerdata.tokenendcolumn = tokenizerdata.currentcolumn = tokenizerdata.tokenendoffset - tokenizerdata.currentlinebeginoffset
end

function totoken(tokenizerdata::TokenizerData, tokenType, yytext)
    return Token(
        type = tokensdict[tokenType],
        value = yytext,
        startoffset = tokenizerdata.tokenstartoffset,
        endoffset = tokenizerdata.tokenendoffset,
        startline = tokenizerdata.tokenstartline,
        endline = tokenizerdata.tokenendline,
        startcolumn = tokenizerdata.tokenstartcolumn,
        endcolumn = tokenizerdata.tokenendcolumn
    )
end

function hasmoretokens(tokenizerdata::TokenizerData)
    return tokenizerdata.cursor <= length(tokenizerdata.initstring)
end

function isEOF(tokenizerdata::TokenizerData)
    return tokenizerdata.cursor == (length(tokenizerdata.initstring) + 1)
end
