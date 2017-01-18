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

  # Line-based location tracking.
  @current_line = 1
  @current_column = 0
  @current_line_begin_offset = 0

  # Location data of a matched token.
  @token_start_offset = 0
  @token_end_offset = 0
  @token_start_line = 0
  @token_end_line = 0
  @token_start_column = 0
  @token_end_column = 0

  EOF_TOKEN = {
    :type => YYParse::EOF,
    :value => YYParse::EOF
  }

  <<LEX_RULE_HANDLERS>>

  def init_string(string)
    @string = string + YYParse::EOF
    @cursor = 0
    @tokens_queue = []

    @current_line = 1
    @current_column = 0
    @current_line_begin_offset = 0

    @token_start_offset = 0
    @token_end_offset = 0
    @token_start_line = 0
    @token_end_line = 0
    @token_start_column = 0
    @token_end_column = 0
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

    raise 'Unexpected token: "' + string[0] + '" at ' +
      @current_line.to_s + ':' + @current_column.to_s + '.'
  end

  def _capture_location(matched)
    # Absolute offsets.
    @token_start_offset = @cursor

    # Line-based locations, start.
    @token_start_line = @current_line
    @token_start_column = @token_start_offset - @current_line_begin_offset

    # Extract `\n` in the matched token.
    matched.enum_for(:scan, /\n/).each {
      Regexp.last_match.begin(0)
      @current_line += 1
      @current_line_begin_offset = @token_start_offset + Regexp.last_match.begin(0) + 1
    }

    @token_end_offset = @cursor + matched.length

    # Line-based locations, end.
    @token_end_line = @current_line
    @token_end_column = @current_column = (@token_end_offset - @current_line_begin_offset)
  end

  def _to_token(token_type, yytext='')
    return {
      :type => token_type,
      :value => yytext,
      :start_offset => @token_start_offset,
      :end_offset => @token_end_offset,
      :start_line => @token_start_line,
      :end_line => @token_end_line,
      :start_column => @token_start_column,
      :end_column => @token_end_column,
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
      _capture_location(matches[0])
      @cursor += matches[0].length
      return matches[0]
    end
    return nil
  end
end

YYParse::tokenizer = SyntaxToolTokenizer__.new
