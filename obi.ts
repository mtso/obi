import { expr, stmt } from "./ast.ts";

enum ValueType {
  STRING,
  NUMBER,
  CHARACTER,
  NIL,
  COMPOUND,
}

class Value {
  type: ValueType;
  value: any;

  constructor(type: ValueType, value: any) {
    this.type = type;
    this.value = value;
  }

  public toString(): String {
    return `${ValueType[this.type]}{${this.value}}`;
  }
}

enum TokenType {
  // Single-character tokens.
  LEFT_PAREN,
  RIGHT_PAREN,
  LEFT_BRACE,
  RIGHT_BRACE,
  COMMA,
  DOT,
  MINUS,
  PLUS,
  SEMICOLON,
  SLASH,
  STAR,
  TILDE,

  // One or two character tokens.
  BANG,
  BANG_EQUAL,
  EQUAL,
  EQUAL_EQUAL,
  GREATER,
  GREATER_EQUAL,
  LESS,
  LESS_EQUAL,

  COLON,
  COLON_COLON,

  // Literals.
  IDENTIFIER,
  STRING,
  NUMBER,
  COMMENT,

  // Keywords.
  AND,
  CLASS,
  ELSE,
  FALSE,
  FUN,
  FOR,
  IF,
  NIL,
  OR,
  PRINT,
  RETURN,
  SUPER,
  THIS,
  TRUE,
  VAR,
  WHILE,
  TEE,
  TAP,
  TYPE,

  EOF,
}

const TT = TokenType;

export class Token {
  type: TokenType;
  lexeme: string;
  literal: Value | null;
  line: number;
  column: number;

  constructor(
    type: TokenType,
    lexeme: string,
    literal: Value | null,
    line: number,
    column: number,
  ) {
    this.type = type;
    this.lexeme = lexeme;
    this.literal = literal;
    this.line = line;
    this.column = column;
  }

  public toString(): string {
    return `[${this.line}:${this.column}] ${
      TokenType[this.type]
    } '${this.lexeme}' ${this.literal && this.literal.toString()}`;
  }
}

class Scanner {
  source: string;
  tokens: Token[] = [];
  private start: number = 0;
  private current: number = 0;
  private line: number = 1;
  private column: number = 1;

  static keywords: Map<string, TokenType> = Scanner.initKeywords();

  private static initKeywords(): Map<string, TokenType> {
    const keywords = new Map<string, TokenType>();
    keywords.set("and", TT.AND);
    keywords.set("class", TT.CLASS);
    keywords.set("else", TT.ELSE);
    keywords.set("false", TT.FALSE);
    keywords.set("for", TT.FOR);
    keywords.set("fun", TT.FUN);
    keywords.set("if", TT.IF);
    keywords.set("nil", TT.NIL);
    keywords.set("or", TT.OR);
    keywords.set("print", TT.PRINT);
    keywords.set("return", TT.RETURN);
    keywords.set("super", TT.SUPER);
    keywords.set("this", TT.THIS);
    keywords.set("tee", TT.TEE);
    keywords.set("tap", TT.TAP);
    keywords.set("true", TT.TRUE);
    keywords.set("var", TT.VAR);
    keywords.set("while", TT.WHILE);
    return keywords;
  }

  constructor(source: string) {
    this.source = source;
  }

  scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    this.tokens.push(new Token(TT.EOF, "", null, this.line, this.column));
    return this.tokens;
  }

  private scanToken() {
    const ch = this.advance();
    switch (ch) {
      case "(":
        this.addToken(TT.LEFT_PAREN);
        this.column += 1;
        break;
      case ")":
        this.addToken(TT.RIGHT_PAREN);
        this.column += 1;
        break;
      case "{":
        this.addToken(TT.LEFT_BRACE);
        this.column += 1;
        break;
      case "}":
        this.addToken(TT.RIGHT_BRACE);
        this.column += 1;
        break;
      case ",":
        this.addToken(TT.COMMA);
        this.column += 1;
        break;
      case ".":
        this.addToken(TT.DOT);
        this.column += 1;
        break;
      case "-":
        this.addToken(TT.MINUS);
        this.column += 1;
        break;
      case "+":
        this.addToken(TT.PLUS);
        this.column += 1;
        break;
      case ";":
        this.addToken(TT.SEMICOLON);
        this.column += 1;
        break;
      case "*":
        this.addToken(TT.STAR);
        this.column += 1;
        break;
      case "~":
        this.addToken(TT.TILDE);
        this.column += 1;
        break;
      case "!":
        if (this.match("=")) {
          this.addToken(TT.BANG_EQUAL);
          this.column += 2;
        } else {
          this.addToken(TT.BANG);
          this.column += 1;
        }
        break;
      case "=":
        if (this.match("=")) {
          this.addToken(TT.EQUAL_EQUAL);
          this.column += 2;
        } else {
          this.addToken(TT.EQUAL);
          this.column += 1;
        }
        break;
      case "<":
        if (this.match("=")) {
          this.addToken(TT.LESS_EQUAL);
          this.column += 2;
        } else {
          this.addToken(TT.LESS);
          this.column += 1;
        }
        break;
      case ">":
        if (this.match("=")) {
          this.addToken(TT.GREATER_EQUAL);
          this.column += 2;
        } else {
          this.addToken(TT.GREATER);
          this.column += 1;
        }
        break;
      case "/":
        if (this.match("/")) {
          // A comment goes until the end of the line.
          while (this.peek() !== "\n" && !this.isAtEnd()) this.advance();
          const text = this.source.substring(this.start, this.current);
          this.addTokenLiteral(TT.COMMENT, new Value(ValueType.STRING, text));
          this.column += text.length; // handles unicode poorly
        } else {
          this.addToken(TT.SLASH);
          this.column += 1;
        }
        break;
      case ":":
        if (this.match(":")) {
          this.addToken(TT.COLON_COLON);
          this.column += 2;
        } else {
          this.addToken(TT.COLON);
          this.column += 1;
        }
        break;
      case "\t":
        // tabs allowed?
      // Obi.error(this.line, this.line, "Invalid character '\t'");
      case " ":
      case "\r":
        // Ignore whitespace.
        this.column += 1;
        break;

      case "\n":
        this.line++;
        this.column = 1;
        break;
      case '"':
        this.string();
        break;
      default:
        if (this.isDigit(ch)) {
          this.number();
        } else if (this.isAlpha(ch)) {
          this.identifier();
        } else {
          Obi.error(this.line, this.column, "Unexpected character.");
        }
        break;
    }
  }

  private identifier() {
    while (this.isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.substring(this.start, this.current);
    let typ: TokenType | null = Scanner.keywords.get(text) || null;
    if (typ === null) typ = TT.IDENTIFIER;
    this.addToken(typ);
  }

  private number() {
    while (this.isDigit(this.peek())) this.advance();

    // Look for a fractional part.
    if (this.peek() == "." && this.isDigit(this.peekNext())) {
      // Consume the "."
      this.advance();

      while (this.isDigit(this.peek())) this.advance();
    }

    const number = Number.parseFloat(
      this.source.substring(this.start, this.current),
    );
    this.addTokenLiteral(
      TT.NUMBER,
      new Value(ValueType.NUMBER, number),
    );
  }

  private unescape(source: string, transforms: string[][]) {
    const len = source.length;
    let start = 0;
    let end = 0;
    let result = "";

    for (var i = 0; i < len; i = i + 1) {
      let replaced = false;
      for (var j = 0; j < transforms.length; j++) {
        const [from, to] = transforms[j];
        const potential = source.substring(i, i + from.length);
        if (potential === from) {
          result = result + source.substring(start, end) + to;
          start = i + from.length;
          end = start;
          i = i + from.length - 1;
          replaced = true;
          break;
        }
      }
      if (!replaced) end = end + 1;
    }

    return result + source.substring(start, len);
  }

  private string() {
    while (this.peek() != '"' && !this.isAtEnd()) {
      if (this.peek() == "\n") this.line++;
      if (this.peek() == "\\") this.advance();
      this.advance();
    }

    if (this.isAtEnd()) {
      Obi.error(this.line, this.column, "Unterminated string.");
      return;
    }

    // The closing ".
    this.advance();

    // Trim the surrounding quotes.
    let value = this.source.substring(this.start + 1, this.current - 1);
    value = this.unescape(value, [
      ["\\0", "\0"],
      ["\\r", "\r"],
      ["\\\\", "\\"],
      ["\\n", "\n"],
      ["\\t", "\t"],
      ['\\"', '"'],
    ]);
    this.addTokenLiteral(TT.STRING, new Value(ValueType.STRING, value));
    this.column += (this.current - this.start); // handles unicode poorly
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;
    this.current++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source.charAt(this.current + 1);
  }

  private isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      c == "_";
  }

  private isIdPunctuation(c: string): boolean {
    return c == "-" || c == "?" || c == "!" || c == "@";
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c) || this.isIdPunctuation(c);
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private advance(): string {
    return this.source.charAt(this.current++);
  }

  private addToken(typ: TokenType) {
    this.addTokenLiteral(typ, null);
  }

  private addTokenLiteral(typ: TokenType, literal: Value | null) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(new Token(typ, text, literal, this.line, this.column));
  }

  isAtEnd(): boolean {
    return this.current >= this.source.length;
  }
}

module Obi {
  // export let interpreter: Interpreter = new Interpreter();
  export let hadError: boolean = false;
  export let hadRuntimeError: boolean = false;

  export const report = (
    line: number,
    column: number,
    where: string,
    message: string,
  ) => {
    console.error(`[line ${line}:${column || 0}] Error${where}: ${message}`);
    hadError = true;
  };

  export const error = (line: number, column: number, message: string) => {
    report(line, column, "", message);
  };

  export const errorToken = (token: Token, message: string) => {
    if (token.type == TT.EOF) {
      report(token.line, token.column, " at end", message);
    } else {
      report(token.line, token.column, ` at '${token.lexeme}'`, message);
    }
  };

  // export const runtimeError = (err: RuntimeError) => {
  //   console.error(err.message + `\n[line ${err.token.line}]`);
  //   hadRuntimeError = true;
  // };
}

const ENC = new TextEncoder();

function run(source: string) {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();

  for (const token of tokens) {
    console.log(token.toString());
  }

  // const parser = new Parser(tokens);
  // const statements = parser.parse();

  // if (Obi.hadError) return;

  // const resolver = new Resolver(Lox.interpreter);
  // resolver.resolveStmts(statements);

  // if (Obi.hadError) return;

  // Obi.interpreter.interpret(statements);
}

async function runFile(file: string) {
  const contents = await Deno.readTextFile(file);
  run(contents);

  if (Obi.hadError) Deno.exit(65);
  // if (Lox.hadRuntimeError) Deno.exit(70);
}

{
  const args = Deno.args;
  if (args.length > 1) {
    if (args[1] === "--") {
      await runFile(Deno.args[0]);
    } else {
      console.log(`Usage: deno run --allow-read lox.ts [script]`);
      Deno.exit(64);
    }
  } else if (args.length == 1) {
    await runFile(Deno.args[0]);
    // } else {
    //   await runPrompt();
  }
}
