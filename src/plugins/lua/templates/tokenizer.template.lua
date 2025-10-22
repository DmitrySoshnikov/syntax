--[[
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 *
 * See `--custom-tokinzer` to skip this generation, and use a custom one.
--]]

-- In old version of Lua, unpack is global. Set table.unpack to unpack if not exists.
if table.unpack == nil then
    table.unpack = unpack
end

EOF = '$'

local function Token(params)
  local token = {
    type = params.type,
    value = params.value,
    startOffset = params.startOffset,
    endOffset = params.endOffset,
    startLine = params.startLine,
    endLine = params.endLine,
    startColumn = params.startColumn,
    endColumn = params.endColumn,
  }

  return token
end

tokensMap = {{{TOKENS}}}

EOF_TOKEN =  {type = tokensMap[EOF]}

yytext = ""

yyleng = 0

lexRules = {{{LEX_RULES}}}

lexRulesByConditions = {{{LEX_RULES_BY_START_CONDITIONS}}}

Tokenizer = {}
Tokenizer.__index = Tokenizer

function Tokenizer:new(tokenizingString)
    local self = setmetatable({}, Tokenizer)
    self:initString(tokenizingString)
    return self
end

function Tokenizer:initString(tokenizingString)
    self._string = tokenizingString
    self._states = {"INITIAL"}
    self._cursor = 0
    self._tokensQueue = {}
    self._currentLine = 1
    self._currentColumn = 0
    self._currentLineBeginOffset = 0
    self._tokenStartOffset = 0
    self._tokenEndOffset = 0
    self._tokenStartLine = 1
    self._tokenEndLine = 1
    self._tokenStartColumn = 0
    self._tokenEndColumn = 0

    return self
end

{{{LEX_RULE_HANDLERS}}}


function Tokenizer:getCurrentState()
    return self._states[#self._states]
end

function Tokenizer:pushState(state)
    table.insert(self._states, state)
end

function Tokenizer:begin(state)
    self:pushState(state)
end

function Tokenizer:popState()
    if #self._states > 1 then
        return table.remove(self._states)
    else
        return self._states[1]
    end
end

-- --------------------------------------------
-- Tokenizing.

function Tokenizer:getNextToken()
    -- Return queued token first
    if #self._tokensQueue > 0 then
        return self:_toToken(table.remove(self._tokensQueue, 1))
    end

    if not self:hasMoreTokens() then
        return EOF_TOKEN
    end

    local stringRest = self._string:sub(self._cursor + 1)
    local lexRulesForState = lexRulesByConditions[self:getCurrentState()]

    for i = 1, #lexRulesForState do
        local lexRuleIndex = lexRulesForState[i]
        local lexRule = lexRules[lexRuleIndex + 1]

        local matched = self:_match(stringRest, lexRule[1])

        if stringRest == '' and matched == '' then
            self._cursor = self._cursor + 1
        end

        if matched then
            yytext = matched
            yyleng = #yytext

            local tokenType = self[lexRule[2]]()
            if not tokenType then
                return self:getNextToken()
            end

            if type(tokenType) == "table" then
                local tokensToQueue = {}
                for j = 2, #tokenType do
                    table.insert(tokensToQueue, tokenType[j])
                end
                tokenType = tokenType[1]
                for j = #tokensToQueue, 1, -1 do
                    table.insert(self._tokensQueue, 1, tokensToQueue[j])
                end
            end

            return self:_toToken(tokenType, yytext)
        end
    end

    if self:isEOF() then
        self._cursor = self._cursor + 1
        return EOF_TOKEN
    end

    self:throwUnexpectedToken(stringRest:sub(1,1), self._currentLine, self._currentColumn)
end

function Tokenizer:throwUnexpectedToken(symbol, line, column)
    local lines = {}
    for l in self._string:gmatch("([^\n]*)\n?") do
        table.insert(lines, l)
    end
    local lineSource = lines[line] or ""

    local pad = string.rep(" ", column)
    local lineData = "\n\n" .. lineSource .. "\n" .. pad .. "^\n"

    error(lineData .. 'Unexpected token: "' .. symbol .. '" at ' .. line .. ":" .. column)
end

function Tokenizer:_captureLocation(matched)
    local nlRe = "\n"

    self._tokenStartOffset = self._cursor
    self._tokenStartLine = self._currentLine
    self._tokenStartColumn = self._tokenStartOffset - self._currentLineBeginOffset

    for nl in matched:gmatch(nlRe) do
        self._currentLine = self._currentLine + 1
        -- Simplifying: assume 1 char per \n for offset
        self._currentLineBeginOffset = self._cursor + 1
    end

    self._tokenEndOffset = self._cursor + #matched
    self._tokenEndLine = self._currentLine
    self._currentColumn = self._tokenEndOffset - self._currentLineBeginOffset
    self._tokenEndColumn = self._currentColumn
end

function Tokenizer:_toToken(tokenType, yytext)
    yytext = yytext or ""
    return Token({
        type = tokensMap[tokenType],
        value = yytext,
        startOffset = self._tokenStartOffset,
        endOffset = self._tokenEndOffset,
        startLine = self._tokenStartLine,
        endLine = self._tokenEndLine,
        startColumn = self._tokenStartColumn,
        endColumn = self._tokenEndColumn
    })
end

function Tokenizer:isEOF()
    return self._cursor == #self._string
end

function Tokenizer:hasMoreTokens()
    return self._cursor <= #self._string
end

function Tokenizer:_match(stringRest, pattern)
    local s, e = stringRest:find(pattern)
    if s then
        local matched = stringRest:sub(s, e)
        self:_captureLocation(matched)
        self._cursor = self._cursor + #matched
        return matched
    end
    return nil
end
 