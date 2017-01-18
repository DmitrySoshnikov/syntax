##
# Generic tokenizer used by the parser in the Syntax tool.
#
# https://www.npmjs.com/package/syntax-cli
#
# See `--custom-tokinzer` to skip this generation, and use a custom one.
##

import re as _syntax_tool_re

<<LEX_RULE_HANDLERS>>

_lex_rules = <<LEX_RULES>>

EOF_TOKEN = {
  'type': EOF,
  'value': EOF
}

class Tokenizer(object):
    _string = None
    _cursor = 0

    # Line-based location tracking.
    _current_line = 1
    _current_column = 0
    _current_line_begin_offset = 0

    # Location data of a matched token.
    token_start_offset = 0
    token_end_offset = 0
    token_start_line = 0
    token_end_line = 0
    token_start_column = 0
    token_end_column = 0

    def __init__(self, string=None):
        if not string is None:
            self.init_string(string)

    def init_string(self, string):
        self._string = string + EOF
        self._cursor = 0
        self._tokens_queue = []

        self._current_line = 1
        self._current_column = 0
        self._current_line_begin_offset = 0

        # Location data of a matched token.
        self.token_start_offset = 0
        self.token_end_offset = 0
        self.token_start_line = 0
        self.token_end_line = 0
        self.token_start_column = 0
        self.token_end_column = 0

    def get_next_token(self):
        global __, yytext, yyleng

        if len(self._tokens_queue) > 0:
            return self._to_token(self._tokens_queue.pop(0))

        if not self.has_more_tokens():
            return EOF_TOKEN

        elif self.is_eof():
            self._cursor = self._cursor + 1
            return EOF_TOKEN

        string = self._string[self._cursor:]

        for lex_rule in _lex_rules:
            matched = self._match(string, lex_rule[0])
            if matched != None:
                yytext = matched
                yyleng = len(yytext)
                token = lex_rule[1]()
                if token is None:
                    return self.get_next_token()

                if isinstance(token, list):
                    tokens_to_queue = token[1:]
                    token = token[0]
                    if len(tokens_to_queue) > 0:
                        self._tokens_queue.extend(tokens_to_queue)

                return self._to_token(token, yytext)

        raise Exception(
            'Unexpected token: "' + str(string[0]) + '" at ' +
            str(self._current_line) + ':' + str(self._current_column) + '.'
        )

    def _capture_location(self, matched):
        nl_re = _syntax_tool_re.compile("\n")

        # Absolute offsets.
        self.token_start_offset = self._cursor

        # Line-based locations, start.
        self.token_start_line = self._current_line
        self.token_start_column = self.token_start_offset - self._current_line_begin_offset

        # Extract `\n` in the matched token.
        for nl_match in nl_re.finditer(matched):
            self._current_line += 1
            self._current_line_begin_offset = self.token_start_offset + nl_match.start() + 1

        self.token_end_offset = self._cursor + len(matched)

        # Line-based locations, end.
        self.token_end_line = self._current_line
        self.token_end_column = self._current_column = (self.token_end_offset - self._current_line_begin_offset)

    def _to_token(self, token_type, yytext=''):
        return {
            'type': token_type,
            'value': yytext,
            'start_offset': self.token_start_offset,
            'end_offset': self.token_end_offset,
            'start_line': self.token_start_line,
            'end_line': self.token_end_line,
            'start_column': self.token_start_column,
            'end_column': self.token_end_column,
        }

    def is_eof(self):
        return self._string[self._cursor] == EOF and \
            self._cursor == len(self._string) - 1

    def has_more_tokens(self):
        return self._cursor < len(self._string)

    def _match(self, string, regexp):
        matched = _syntax_tool_re.search(regexp, string)

        if matched != None:
            self._capture_location(matched.group(0))
            self._cursor += matched.end()
            return matched.group(0)

        return None

_tokenizer = Tokenizer()
