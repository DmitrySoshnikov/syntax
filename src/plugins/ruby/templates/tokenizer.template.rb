##
# Generic tokenizer used by the parser in the Syntax tool.
#
# https://www.npmjs.com/package/syntax-cli
#
# See `--custom-tokinzer` to skip this generation, and use a custom one.
##

class SyntaxToolTokenizer__
  @@lex_rules = <<LEX_RULES>>

  @string = ''
  @cursor = 0
  @tokens_queue = []

  EOF_TOKEN = {
    :type => YYParse::EOF,
    :value => YYParse::EOF
  }

  <<LEX_RULE_HANDLERS>>

  def init_string(string)
    @string = string + YYParse::EOF
    @cursor = 0
    @tokens_queue = []
  end

  def get_next_token
    if @tokens_queue.length > 0
      return _to_token(@tokens_queue.shift())
    end

    if not has_more_tokens
      return SyntaxToolTokenizer__::EOF_TOKEN
    elsif is_eof
      @cursor += 1
      return SyntaxToolTokenizer__::EOF_TOKEN
    end

    string = @string[@cursor..-1]

    @@lex_rules.each { |lex_rule|
      matched = match(string, lex_rule[0])

      if matched
        YYParse.yytext = matched
        YYParse.yyleng = matched.length
        token = SyntaxToolTokenizer__.send(lex_rule[1])

        if not token
          return get_next_token
        end

        if token.kind_of?(Array)
          tokens_to_queue = token[1..-1]
          token = token[0]
          if tokens_to_queue.length > 0
            @tokens_queue.concat(tokens_to_queue)
          end
        end

        return _to_token(token, matched)
      end
    }

    raise 'Unexpected token: ' + string[0]
  end

  def _to_token(token, yytext='')
    return {
      :type => token,
      :value => yytext
    }
  end

  def is_eof
    return @string[@cursor, 1] == YYParse::EOF && @cursor == @string.length - 1
  end

  def has_more_tokens
    return @cursor < @string.length
  end

  def match(string, regexp)
    matches = regexp.match(string)
    if matches != nil
      @cursor += matches[0].length
      return matches[0]
    end
    return nil
  end
end

YYParse::tokenizer = SyntaxToolTokenizer__.new
