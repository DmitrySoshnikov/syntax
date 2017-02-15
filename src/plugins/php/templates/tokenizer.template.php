<?php
/**
 * Generic tokenizer used by the parser in the Syntax tool.
 *
 * https://www.npmjs.com/package/syntax-cli
 *
 * See `--custom-tokinzer` to skip this generation, and use a custom one.
 */

class Tokenizer {
  private static $lexRules = <<LEX_RULES>>;
  private static $lexRulesByConditions = <<LEX_RULES_BY_START_CONDITIONS>>;

  private $states = array();
  private $string = '';
  private $originalString = '';
  private $cursor = 0;
  private $tokensQueue = array();

  /**
   * Line-based location tracking.
   */
  private $currentLine = 1;
  private $currentColumn = 0;
  private $currentLineBeginOffset = 0;

  /**
   * Location data of a matched token.
   */
  private $tokenStartOffset = 0;
  private $tokenEndOffset = 0;
  private $tokenStartLine = 0;
  private $tokenEndLine = 0;
  private $tokenStartColumn = 0;
  private $tokenEndColumn = 0;

  private static $EOF_TOKEN = array(
    'type' => yyparse::EOF,
    'value' => yyparse::EOF,
  );

  <<LEX_RULE_HANDLERS>>

  public function initString($string) {
    $this->originalString = $string;
    $this->states = array('INITIAL');
    $this->string = $string.yyparse::EOF;
    $this->cursor = 0;
    $this->tokensQueue = array();

    $this->currentLine = 1;
    $this->currentColumn = 0;
    $this->currentLineBeginOffset = 0;

    /**
     * Location data of a matched token.
     */
    $this->tokenStartOffset = 0;
    $this->tokenEndOffset = 0;
    $this->tokenStartLine = 0;
    $this->tokenEndLine = 0;
    $this->tokenStartColumn = 0;
    $this->tokenEndColumn = 0;
  }

  public function getStates() {
    return $this->states;
  }

  public function getCurrentState() {
    return $this->states[count($this->states) - 1];
  }

  public function pushState($state) {
    $this->states[] = $state;
  }

  public function begin($state) {
    $this->pushState(state);
  }

  public function popState() {
    if (count($this->states) > 1) {
      return array_pop($this->states);
    }
    return $this->states[0];
  }

  public function getNextToken() {
    if (count($this->tokensQueue) > 0) {
      return $this->toToken(array_shift($this->tokensQueue));
    }

    if (!$this->hasMoreTokens()) {
      return self::$EOF_TOKEN;
    } else if ($this->isEOF()) {
      $this->cursor++;
      return self::$EOF_TOKEN;
    }

    $string = substr($this->string, $this->cursor);
    $lexRulesForState = static::$lexRulesByConditions[$this->getCurrentState()];

    foreach ($lexRulesForState as $lex_rule_index) {
      $lex_rule = self::$lexRules[$lex_rule_index];

      $matched = $this->match($string, $lex_rule[0]);
      if ($matched) {
        yyparse::$yytext = $matched;
        yyparse::$yyleng = strlen($matched);
        $token = call_user_func(array($this, $lex_rule[1]));
        if (!$token) {
          return $this->getNextToken();
        }

        // If multiple tokens are returned, save them to return
        // on next `getNextToken` call.
        if (is_array($token)) {
          $tokens_to_queue = array_slice($token, 1);
          $token = $token[0];
          if (count($tokens_to_queue) > 0) {
            array_unshift($this->tokensQueue, ...$tokens_to_queue);
          }
        }

        return $this->toToken($token, $matched);
      }
    }

    $this->throwUnexpectedToken(
      $string[0],
      $this->currentLine,
      $this->currentColumn
    );
  }

  /**
   * Throws default "Unexpected token" exception, showing the actual
   * line from the source, pointing with the ^ marker to the bad token.
   * In addition, shows `line:column` location.
   */
  public function throwUnexpectedToken($symbol, $line, $column) {
    $line_source = explode("\n", $this->originalString)[$line - 1];
    $line_data = '';

    if ($line_source) {
      $pad = str_repeat(' ', $column);
      $line_data = "\n\n" . $line_source . "\n" . $pad . "^\n";
    }

    throw new SyntaxException(
      $line_data . 'Unexpected token: "' . $symbol . '" at ' .
      $line . ':' . $column . '.'
    );
  }

  private function captureLocation($matched) {
    // Absolute offsets.
    $this->tokenStartOffset = $this->cursor;

    // Line-based locations, start.
    $this->tokenStartLine = $this->currentLine;
    $this->tokenStartColumn = $this->tokenStartOffset - $this->currentLineBeginOffset;

    // Extract `\n` in the matched token.
    preg_match_all('/\n/', $matched, $nl_matches, PREG_OFFSET_CAPTURE);
    $nl_match = $nl_matches[0];

    if (count($nl_match) > 0) {
      foreach ($nl_match as $nl_match_data) {
        $this->currentLine++;
        // Offset is at index 1.
        $this->currentLineBeginOffset = $this->tokenStartOffset +
          $nl_match_data[1] + 1;
      }
    }

    $this->tokenEndOffset = $this->cursor + strlen($matched);

    // Line-based locations, end.
    $this->tokenEndLine = $this->currentLine;
    $this->tokenEndColumn = $this->currentColumn =
      ($this->tokenEndOffset - $this->currentLineBeginOffset);
  }

  private function toToken($token, $yytext = '') {
    return array(
      'type' => $token,
      'value' => $yytext,
      'startOffset' => $this->tokenStartOffset,
      'endOffset' => $this->tokenEndOffset,
      'startLine' => $this->tokenStartLine,
      'endLine' => $this->tokenEndLine,
      'startColumn' => $this->tokenStartColumn,
      'endColumn' => $this->tokenEndColumn,
    );
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
      $matched = $matches[0];
      $this->captureLocation($matched);
      $this->cursor += strlen($matched);
      return $matched;
    }
    return null;
  }
}

yyparse::setTokenizer(new Tokenizer());
