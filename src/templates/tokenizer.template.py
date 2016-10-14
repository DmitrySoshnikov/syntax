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

_string = '';
_cursor = 0;

EOF_TOKEN = {
  'type': EOF,
  'value': EOF
}

class _tokenizer(object):

    @staticmethod
    def init_string(string):
        global _string, _cursor
        _string = string + EOF
        _cursor = 0

    @staticmethod
    def get_next_token():
        global _string, _cursor

        if not _tokenizer.has_more_tokens():
            return EOF_TOKEN

        elif _tokenizer.is_eof():
            _cursor = _cursor + 1
            return EOF_TOKEN

        string = _string[_cursor:]

        for lex_rule in _lex_rules:
            matched = _tokenizer._match(string, lex_rule[0])
            if matched != None:
                yytext = matched
                yyleng = len(yytext)
                token = lex_rule[1]()
                if token is None:
                    return _tokenizer.get_next_token()

                return {
                    'type': token,
                    'value': yytext
                }

        raise Exception('Unexpected token: ' + str(string[0]))


    @staticmethod
    def is_eof():
        return _string[_cursor] == EOF and _cursor == len(_string) - 1

    @staticmethod
    def has_more_tokens():
        return _cursor < len(_string)

    @staticmethod
    def _match(string, regexp):
        global _cursor
        matched = _syntax_tool_re.search(regexp, string)

        if matched != None:
            _cursor += matched.end()
            return matched.group(0)

        return None
