<?php
/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 *
 * See `--custom-tokinzer` to skip this generation, and use a custom one.
 */

class __SyntaxToolTokenizer {
  private static $lexRules = <<LEX_RULES>>;

  private $string = '';
  private $cursor = 0;

  private static $EOF_TOKEN = array(
    'type' => yyparse::EOF,
    'value' => yyparse::EOF,
  );

  <<LEX_RULE_HANDLERS>>

  public function initString($string) {
    $this->string = $string.yyparse::EOF;
    $this->cursor = 0;
  }

  public function getNextToken() {
    if (!$this->hasMoreTokens()) {
      return self::$EOF_TOKEN;
    } else if ($this->isEOF()) {
      $this->cursor++;
      return self::$EOF_TOKEN;
    }

    $string = substr($this->string, $this->cursor);

    foreach (self::$lexRules as $lex_rule) {
      $matched = $this->match($string, $lex_rule[0]);
      if ($matched) {
        yyparse::$yytext = $matched;
        yyparse::$yyleng = strlen($matched);
        $token = forward_static_call(array('self', $lex_rule[1]));
        if (!$token) {
          return $this->getNextToken();
        }

        return array(
          'type' => $token,
          'value' => $matched
        );
      }
    }

    throw new \Exception('Unexpected token: ' . $string[0]);
  }

  public function isEOF() {
    return $this->string[$this->cursor] == yyparse::EOF &&
      $this->cursor == strlen($this->string) - 1;
  }

  public function hasMoreTokens() {
    return $this->cursor < strlen($this->string);
  }

  private function match($string, $regexp) {
    preg_match($regexp, $string, $matches);
    if (count($matches) > 0) {
      $this->cursor += strlen($matches[0]);
      return $matches[0];
    }
    return null;
  }
}

yyparse::setTokenizer(new __SyntaxToolTokenizer());
