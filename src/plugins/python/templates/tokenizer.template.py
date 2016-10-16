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

class _tokenizer(object):
    _string = None
    _cursor = 0

    @staticmethod
    def init_string(string):
        _tokenizer._string = string + EOF
        _tokenizer._cursor = 0

    @staticmethod
    def get_next_token():
        if not _tokenizer.has_more_tokens():
            return EOF_TOKEN

        elif _tokenizer.is_eof():
            _tokenizer._cursor = _tokenizer._cursor + 1
            return EOF_TOKEN

        string = _tokenizer._string[_tokenizer._cursor:]

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
        return _tokenizer._string[_tokenizer._cursor] == EOF and \
            _tokenizer._cursor == len(_tokenizer._string) - 1

    @staticmethod
    def has_more_tokens():
        return _tokenizer._cursor < len(_tokenizer._string)

    @staticmethod
    def _match(string, regexp):
        matched = _syntax_tool_re.search(regexp, string)

        if matched != None:
            _tokenizer._cursor += matched.end()
            return matched.group(0)

        return None
