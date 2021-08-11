import { delay as DenoDelay } from "https://deno.land/std@0.103.0/async/mod.ts";
import * as path from "https://deno.land/std@0.103.0/path/mod.ts";

import { expr, stmt } from "./ast.ts";
import * as runtime from "./runtime.ts";

class WaitGroup {
  count: number = 0;
  doneCount: number = 0;

  add(n: number) {
    this.count += n;
  }
  done() {
    this.doneCount += 1;
  }
  async wait(): Promise<void> {
    const self = this;
    return new Promise((resolve) => {
      (function wait_() {
        if (self.doneCount >= self.count) resolve();
        else setTimeout(wait_, 0);
      })();
    });
  }
}

type Expr = expr.Expr;
type Stmt = stmt.Stmt;

export enum TokenType {
  // Single-character tokens.
  LEFT_PAREN,
  RIGHT_PAREN,
  LEFT_BRACE,
  RIGHT_BRACE,
  LEFT_BRACKET,
  RIGHT_BRACKET,
  COMMA,
  DOT,
  PLUS,
  SEMICOLON,
  SLASH,
  STAR,
  TILDE,
  UNDERSCORE,

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
  COLON_EQUAL,

  MINUS,
  MINUS_LESS,

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
  MATCH,
  MOD,
  NIL,
  OR,
  PUB,
  RETURN,
  SUPER,
  THIS,
  TRUE,
  VAR,
  TEE,
  TAP,
  TYPE,

  NEWLINE,
  EOF,
}

export const TT = TokenType;

export class Token {
  type: TokenType;
  lexeme: string;
  literal: any; // Value | null;
  line: number;
  column: number;

  constructor(
    type: TokenType,
    lexeme: string,
    literal: any,
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
    const lexeme: string = this.lexeme === "\n" ? "<newline>" : this.lexeme;
    return `[${this.line}:${this.column}] ${
      TokenType[this.type]
    } '${lexeme}' ${this.literal && this.literal.toString()}`;
  }
}

export class Environment {
  enclosing: Environment | null;
  values: Map<string, any> = new Map<string, any>();

  constructor(enclosing?: Environment) {
    if (enclosing) {
      this.enclosing = enclosing;
    } else {
      this.enclosing = null;
    }
  }

  define(name: string, value: any) {
    this.values.set(name, value);
  }

  ancestor(distance: number): Environment {
    let environment: Environment = this;
    for (let i = 0; i < distance; i++) {
      environment = environment.enclosing as Environment;
    }
    return environment;
  }

  getAt(distance: number, name: string) {
    return this.ancestor(distance).values.get(name);
  }

  assignAt(distance: number, name: Token, value: any) {
    this.ancestor(distance).values.set(name.lexeme, value);
  }

  get(name: Token): any {
    if (this.values.has(name.lexeme)) {
      return this.values.get(name.lexeme);
    }
    if (this.enclosing !== null) {
      return this.enclosing.get(name);
    }
    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }

  assign(name: Token, value: any): any {
    if (this.values.has(name.lexeme)) {
      this.values.set(name.lexeme, value);
      return;
    }
    if (this.enclosing !== null) {
      return this.enclosing.assign(name, value);
    }
    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }
}

export type ObiCallable = {
  arity(): number;
  call(interpreter: Interpreter, args: any[]): any;
};

enum FunctionType {
  NONE,
  FUNCTION,
  METHOD,
  INITIALIZER,
}

export class ObiFunction implements ObiCallable {
  private declaration: expr.Function;
  private closure: Environment;
  isInitializer: boolean;

  constructor(
    declaration: expr.Function,
    closure: Environment,
    isInitializer: boolean,
  ) {
    this.declaration = declaration;
    this.closure = closure;
    this.isInitializer = isInitializer;
  }
  bind(instance: ObiInstance): ObiFunction {
    const environment = new Environment(this.closure);
    environment.define("this", instance);
    return new ObiFunction(this.declaration, environment, this.isInitializer);
  }
  bindTable(instance: ObiTable): ObiFunction {
    const environment = new Environment(this.closure);
    environment.define("this", instance);
    return new ObiFunction(this.declaration, environment, this.isInitializer);
  }
  call(interpreter: Interpreter, args: any[]): any {
    const environment = new Environment(this.closure);
    for (let i = 0; i < this.declaration.parameters.length; i++) {
      environment.define(this.declaration.parameters[i].lexeme, args[i]);
    }
    try {
      return interpreter.executeBlock(this.declaration.body, environment, this);
    } catch (err) {
      if (err instanceof Return) {
        return (err as Return).value;
      } else {
        throw err;
      }
    }
    return null;
  }
  arity(): number {
    return this.declaration.parameters.length;
  }
  toString(): string {
    if (null !== this.declaration.name) {
      return `<lambda ${this.declaration.name.lexeme}>`;
    } else {
      return `<lambda>`;
    }
  }
  getDeclaration(): expr.Function {
    return this.declaration;
  }
}

enum ClassType {
  NONE,
  CLASS,
  SUBCLASS,
}

export class ObiClass implements ObiCallable {
  name: string;
  where?: Token;
  private methods: Map<string, ObiFunction>;
  private superclass: ObiClass | null;
  constructor(
    name: string,
    superclass: ObiClass | null,
    methods: Map<string, ObiFunction>,
    where?: Token,
  ) {
    this.name = name;
    this.superclass = superclass;
    this.methods = methods;
    this.where = where;
  }
  findMethod(name: string): ObiFunction | null {
    if (this.methods.has(name)) {
      return this.methods.get(name) as ObiFunction;
    }
    if (null !== this.superclass) {
      return this.superclass.findMethod(name) as ObiFunction;
    }
    return null;
  }
  toString() {
    return this.name;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const instance = new ObiInstance(this);
    const initializer = this.findMethod("init");
    if (null !== initializer) {
      initializer.bind(instance).call(interpreter, args);
    }
    return instance;
  }
  arity(): number {
    const initializer = this.findMethod("init");
    if (null === initializer) {
      return 0;
    } else {
      return initializer.arity();
    }
  }
}

export class ObiInstance {
  klass: ObiClass;
  private fields: Map<string, any> = new Map<string, any>();
  constructor(klass: ObiClass) {
    this.klass = klass;
  }
  toString() {
    return this.klass.name + " instance";
  }
  get(name: Token): any {
    if (this.fields.has(name.lexeme)) {
      return this.fields.get(name.lexeme);
    }
    const method = this.klass.findMethod(name.lexeme);
    if (null !== method) return method.bind(this);
    throw new RuntimeError(name, `Undefined property '${name.lexeme}'.`);
  }
  getDyn(name: any, where: Token): any {
    if (this.fields.has(name)) {
      return this.fields.get(name);
    }
    const method = this.klass.findMethod(name);
    if (null !== method) return method.bind(this);
    return null;
    // throw new RuntimeError(where, `Undefined property '${name}'.`);
  }
  set(name: Token, value: any) {
    this.fields.set(name.lexeme, value);
  }
  setDyn(name: any, value: any, where: Token): any {
    this.fields.set(name, value);
  }

  getFields(): Map<string, any> {
    return this.fields;
  }
}

export class ObiTable {
  private fields: Map<string, any> = new Map<string, any>();
  toString() {
    return "<table>";
  }
  get(name: Token): any {
    return this.getDyn(name.lexeme);
  }
  getDyn(name: any): any {
    if (this.fields.has(name)) {
      const value = this.fields.get(name);
      // Adds "this" recognition to functions on tables,
      // but in return the scopes must be matched (and fixed);
      // if (value instanceof ObiFunction) {
      //   const method = value as ObiFunction;
      //   return method.bindTable(this);
      // }
      return value;
    }
    return null;
  }
  set(name: Token, value: any) {
    this.setDyn(name.lexeme, value);
  }
  setDyn(name: any, value: any): any {
    this.fields.set(name, value);
  }
  getFields(): Map<string, any> {
    return this.fields;
  }
}

export class RuntimeError extends Error {
  token: Token;
  constructor(token: Token, message: string) {
    super(message);
    this.token = token;
  }
}
class Return extends Error {
  value: any;
  constructor(value: any) {
    super();
    this.value = value;
  }
}

class Resolver implements expr.Visitor<void>, stmt.Visitor<void> {
  private interpreter: Interpreter;
  private scopes: Map<string, boolean>[] = [];
  private currentFunction: FunctionType = FunctionType.NONE;
  private currentClass: ClassType = ClassType.NONE;

  constructor(interpreter: Interpreter) {
    this.interpreter = interpreter;
  }

  resolveStmts(statements: Stmt[]) {
    for (const statement of statements) {
      this.resolveStmt(statement);
    }
  }
  resolveStmt(stm: Stmt) {
    stm.accept(this);
  }
  resolveExpr(exp: Expr) {
    exp.accept(this);
  }
  resolveFunction(func: expr.Function, type: FunctionType) {
    const enclosingFunction = this.currentFunction;
    this.currentFunction = type;
    this.beginScope();
    for (const param of func.parameters) {
      this.declare(param);
      this.define(param);
    }
    this.resolveStmts(func.body);
    this.endScope();
    this.currentFunction = enclosingFunction;
  }

  beginScope() {
    this.scopes.push(new Map<string, boolean>());
  }
  endScope() {
    this.scopes.pop();
  }
  declare(name: Token) {
    if (this.scopes.length < 1) return;
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name.lexeme)) {
      Obi.errorToken(name, "Already a variable with this name in this scope.");
    }
    scope.set(name.lexeme, false);
  }
  define(name: Token) {
    if (this.scopes.length < 1) return;
    const scope = this.scopes[this.scopes.length - 1];
    scope.set(name.lexeme, true);
  }
  count: number = 0;
  resolveLocal(exp: Expr, name: Token) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name.lexeme)) {
        this.interpreter.resolve(exp, this.scopes.length - 1 - i);
        return;
      }
    }
  }
  resolveLocalTable(exp: Expr, name: Token) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name.lexeme)) {
        this.interpreter.resolve(exp, this.scopes.length - i);
        return;
      }
    }
  }

  visitBlockStmt(stm: stmt.Block) {
    this.beginScope();
    this.resolveStmts(stm.statements);
    this.endScope();
  }
  visitClassStmt(stm: stmt.Class) {
    const enclosingClass = this.currentClass;
    this.currentClass = ClassType.CLASS;

    this.declare(stm.name);
    this.define(stm.name);

    if (
      null !== stm.superclass && stm.name.lexeme === stm.superclass.name.lexeme
    ) {
      Obi.errorToken(stm.superclass.name, "A class can't inherit from itself.");
    }
    if (null !== stm.superclass) {
      this.currentClass = ClassType.SUBCLASS;
      this.resolveExpr(stm.superclass);
    }
    if (null !== stm.superclass) {
      this.beginScope();
      this.scopes[this.scopes.length - 1].set("super", true);
    }

    this.beginScope();
    this.scopes[this.scopes.length - 1].set("this", true);
    for (const method of stm.methods) {
      let declaration = FunctionType.METHOD;
      if (method.name && method.name.lexeme === "init") {
        declaration = FunctionType.INITIALIZER;
      }
      this.resolveFunction(method, declaration);
    }
    this.endScope();

    if (null !== stm.superclass) this.endScope();

    this.currentClass = enclosingClass;
  }
  visitExpressionStmt(stm: stmt.Expression) {
    this.resolveExpr(stm.expression);
  }
  visitReturnStmt(stm: stmt.Return) {
    if (this.currentFunction === FunctionType.NONE) {
      Obi.errorToken(stm.keyword, "Can't return from top-level code.");
    }
    if (stm.value !== null) {
      if (this.currentFunction === FunctionType.INITIALIZER) {
        Obi.errorToken(
          stm.keyword,
          "Can't return a value from an initializer.",
        );
      }
      this.resolveExpr(stm.value);
    }
  }
  visitVarStmt(stm: stmt.Var) {
    this.declare(stm.name);
    if (stm.initializer !== null) {
      this.resolveExpr(stm.initializer);
    }
    this.define(stm.name);
  }

  visitAssignExpr(exp: expr.Assign) {
    this.resolveExpr(exp.value);
    this.resolveLocal(exp, exp.name);
  }
  visitBinaryExpr(exp: expr.Binary) {
    this.resolveExpr(exp.left);
    this.resolveExpr(exp.right);
  }
  visitCallExpr(exp: expr.Call) {
    this.resolveExpr(exp.callee);
    for (const arg of exp.args) {
      this.resolveExpr(arg);
    }
  }
  visitFunctionExpr(exp: expr.Function) {
    if (null !== exp.name) {
      this.declare(exp.name);
      this.define(exp.name);
    }
    this.resolveFunction(exp, FunctionType.FUNCTION);
  }
  visitGetExpr(exp: expr.Get) {
    this.resolveExpr(exp.object);
  }
  visitGetDynExpr(exp: expr.GetDyn) {
    this.resolveExpr(exp.object);
    this.resolveExpr(exp.name);
  }
  visitGroupingExpr(exp: expr.Grouping) {
    this.resolveExpr(exp.expression);
  }
  visitSetExpr(exp: expr.Set) {
    this.resolveExpr(exp.value);
    this.resolveExpr(exp.object);
  }
  visitSetDynExpr(exp: expr.SetDyn) {
    this.resolveExpr(exp.value);
    this.resolveExpr(exp.name);
    this.resolveExpr(exp.object);
  }
  visitSuperExpr(exp: expr.Super) {
    if (this.currentClass === ClassType.NONE) {
      Obi.errorToken(exp.keyword, "Can't use 'super' outside of a class.");
    } else if (this.currentClass !== ClassType.SUBCLASS) {
      Obi.errorToken(
        exp.keyword,
        "Can't use 'super' in a class with no superclass.",
      );
    }
    this.resolveLocal(exp, exp.keyword);
  }
  visitLiteralExpr(exp: expr.Literal) {}
  visitLogicalExpr(exp: expr.Logical) {
    this.resolveExpr(exp.left);
    this.resolveExpr(exp.right);
  }
  visitMatchExpr(exp: expr.Match) {
    this.resolveExpr(exp.against);
    for (let i = 0; i < exp.cases.length; i++) {
      const case_ = exp.cases[i];
      if (case_.isDefault && i !== exp.cases.length - 1) {
        Obi.errorToken(
          exp.where,
          "Match branches after default case will never be reached.",
        );
      }
      if (null !== case_.pattern) this.resolveExpr(case_.pattern);
      this.resolveStmt(case_.branch);
    }
  }
  visitTableExpr(exp: expr.Table) {
    this.beginScope();
    for (const value of exp.values) {
      this.resolveExpr(value);
    }
    this.endScope();
  }
  visitThisExpr(exp: expr.This) {
    if (this.currentClass === ClassType.NONE) {
      Obi.errorToken(exp.keyword, "Can't use 'this' outside of a class.");
      return;
    }
    this.resolveLocal(exp, exp.keyword);
  }
  visitUnaryExpr(exp: expr.Unary) {
    this.resolveExpr(exp.right);
  }
  visitVariableExpr(exp: expr.Variable) {
    if (
      !(this.scopes.length < 1) &&
      (this.scopes[this.scopes.length - 1]).get(exp.name.lexeme) === false
    ) {
      Obi.errorToken(
        exp.name,
        "Can't read local variable in its own initializer.",
      );
    }
    this.resolveLocal(exp, exp.name);
  }
}

const PRELUDE = `class Object {}

class List {
    init() {
        this._items = Object();
        this.len = 0;
    }
    add(item) {
        this._items.(this.len) = item;
        this.len = this.len + 1;
    }
    get(i) {
        return this._items.(i);
    }
    size() {
        return this.len;
    }
}

class Map {
    init() {
        this.items = Object();
        this.defined = Object();
    }
    get(key) {
        return match (this.defined.(key)) {
            true -> this.items.(key);
            _ -> nil;
        };
    }
    set(key, value) {
        this.items.(key) = value;
        this.defined.(key) = true;
    }
    has(key) {
        return match (this.defined.(key)) {
            true -> true;
            _ -> false;
        };
    }
    unset(key) {
        this.items.(key) = nil;
        this.defined.(key) = false;
    }
    keys() {
        result := Object();
        itemKeys := keys(this.items);
        resultLen := 0;
        i := 0; while() { i < itemKeys.len; } {
            match (this.defined.(itemKeys.(i))) {
                true -> {
                    result.(resultLen) = itemKeys.(i);
                    resultLen = resultLen + 1;
                }
                _ -> ();
            };
            i = i + 1;
        };
        result.("len") = resultLen;
        return result;
    }
}

fun while(p, f) {
    match (p()) {
        false -> return;
        _ -> ();
    };
    f();
    while(p, f);
}

fun each(list, fn) {
    i := 0;
    while(fun (){ i < list.len; }) {
        fn(list.get(i));
        i = i + 1;
    };
}`;

export class Bytes extends ObiInstance {
  bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    super(new ObiClass("Bytes", null, new Map<string, ObiFunction>()));
    this.bytes = bytes;
  }
  getDyn(name: any, where: Token): any {
    if (typeof name === "number") {
      return this.bytes[name] || null;
    }
    if (name === "len") {
      return this.bytes.length;
    }
    return super.getDyn(name, where);
  }
  setDyn(name: any, value: any, where: Token): any {
    if (typeof name === "number" && typeof value === "number") {
      this.bytes[name] = value;
      return;
    }
    return super.setDyn(name, value, where);
  }

  get(name: Token): any {
    if (name.lexeme === "len") {
      return this.bytes.length;
    }
    return super.get(name);
  }
}

export class Interpreter implements expr.Visitor<any>, stmt.Visitor<any> {
  entryFile: string = "";
  globals: Environment = new Environment();
  environment: Environment = this.globals;
  private locals: Map<Expr, number> = new Map<Expr, number>();

  waitGroup: WaitGroup = new WaitGroup();
  timers: Map<number, number> = new Map<number, number>();

  constructor() {
    this.globals.define("print", new runtime.Print());
    this.globals.define("clock", new runtime.RtClock());
    this.globals.define("delay", new runtime.RtDelay());
    this.globals.define("clearDelay", new runtime.RtClearDelay());
    this.globals.define("type", new runtime.RtType());
    this.globals.define("keys", new runtime.RtKeys());
    this.globals.define("str", new runtime.RtStr());
    this.globals.define("strlen", new runtime.RtStrlen());
    this.globals.define("strslice", new runtime.RtStrslice());
    this.globals.define("parse_float", new runtime.RtParseFloat());
    this.globals.define("listen_tcp", new runtime.RtListenTcp());
    this.globals.define("readfile", new runtime.RtReadfile());
    this.globals.define("readfile_bytes", new runtime.RtReadfileBytes());
    this.globals.define("bytes_concat", new runtime.RtBytesConcat());
    this.globals.define("process_args", new runtime.RtProcessArgs());
    this.globals.define("text_encode", new runtime.RtTextEncode());
    this.globals.define("text_decode", new runtime.RtTextDecode());
    this.globals.define("len", new runtime.RtLen());
    this.globals.define("mod", new runtime.RtMod());
    this.globals.define("load_wasm", new runtime.RtLoadWasm());
  }

  setEntryFile(entryFile: string) {
    this.entryFile = entryFile;
  }

  loadModule(source: string): ObiInstance {
    const module = new ObiInstance(MODULE_CLASS);

    const scanner = new Scanner(source);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens);
    const statements = parser.parse();
    const wrapped = new stmt.Block(statements);

    if (Obi.hadError) {
      throw new Error("Failed to load module");
    }

    const resolver = new Resolver(this);
    resolver.resolveStmts([wrapped]);

    const moduleEnvironment = new Environment(this.environment);

    if (Obi.hadError) {
      throw new Error("Failed to resolve prelude");
    }

    const result = this.executeBlock(statements, moduleEnvironment);

    moduleEnvironment.values.forEach((val, key) => {
      if (val instanceof ObiFunction) {
        const fn = val as ObiFunction;
        const name = fn.getDeclaration().name;
        if (!name) return;
        module.setDyn(name.lexeme, fn, name);
      } else if (val instanceof ObiClass) {
        const klass = val as ObiClass;
        if (!klass.where) return;
        module.setDyn(klass.name, klass, klass.where);
      }
    });

    return module;
  }

  async interpret(statements: Stmt[]) {
    try {
      for (const statement of statements) {
        const _ = this.execute(statement);
      }
    } catch (err) {
      if (err instanceof RuntimeError) {
        Obi.runtimeError(err);
      } else {
        throw err;
      }
    }

    await DenoDelay(0);
    await this.waitGroup.wait();
  }

  private evaluate(expr: Expr): any {
    return expr.accept(this);
  }
  private execute(stmt: Stmt): any {
    return stmt.accept(this);
  }
  resolve(exp: Expr, depth: number) {
    this.locals.set(exp, depth);
  }
  executeBlock(
    statements: Stmt[],
    environment: Environment,
    func?: ObiFunction | null,
  ): any {
    const previous = this.environment;
    let returnValue = null;
    try {
      this.environment = environment;
      if (this.isTailCall(statements, func)) {
        while (true) {
          for (const statement of statements.slice(0, statements.length - 1)) {
            returnValue = this.execute(statement);
          }
        }
      } else {
        for (const statement of statements) {
          returnValue = this.execute(statement);
        }
      }
    } finally {
      this.environment = previous;
    }
    return returnValue;
  }
  // Can we make this smarter by inspecting "last statement of all branches in function"?
  isTailCall(statements: Stmt[], func?: ObiFunction | null) {
    if (!func) return;

    const lastStmt = statements[statements.length - 1];
    if (
      !(lastStmt && lastStmt instanceof stmt.Expression &&
        (lastStmt as stmt.Expression).expression instanceof expr.Call)
    ) {
      return false;
    }

    const lastCall = (lastStmt as stmt.Expression).expression as expr.Call;
    if (lastCall.callee instanceof expr.Variable) {
      const varName = (lastCall.callee as expr.Variable).name;
      try {
        const variable = this.lookupVariable(varName, lastCall);
        if (variable === func) return true;
      } catch (err) {
        // Ignore if not found.
        if (err instanceof RuntimeError) return false;
        else throw err;
      }
    }

    return false;
  }

  visitBlockStmt(stm: stmt.Block): any {
    return this.executeBlock(stm.statements, new Environment(this.environment));
  }
  visitClassStmt(stm: stmt.Class) {
    let superclass = null;
    if (null !== stm.superclass) {
      superclass = this.evaluate(stm.superclass);
      if (!(superclass instanceof ObiClass)) {
        throw new RuntimeError(
          stm.superclass.name,
          "Superclass must be a class.",
        );
      }
    }

    this.environment.define(stm.name.lexeme, null);

    if (null !== superclass) {
      this.environment = new Environment(this.environment);
      this.environment.define("super", superclass);
    }

    const methods = new Map<string, ObiFunction>();
    for (const method of stm.methods) {
      const func = new ObiFunction(
        method,
        this.environment,
        !!method.name && method.name.lexeme === "init",
      );
      if (!method.name) {
        console.error("fixme: why is method name not defined");
        continue;
      }
      methods.set(method.name.lexeme, func);
    }
    const klass = new ObiClass(
      stm.name.lexeme,
      superclass,
      methods,
      stm.name,
    );

    if (null !== superclass) {
      this.environment = this.environment.enclosing as Environment;
    }

    this.environment.assign(stm.name, klass);
  }
  visitExpressionStmt(stm: stmt.Expression): any {
    return this.evaluate(stm.expression);
  }
  visitReturnStmt(stm: stmt.Return) {
    let value = null;
    if (stm.value !== null) value = this.evaluate(stm.value);
    throw new Return(value);
  }
  visitVarStmt(stm: stmt.Var): any {
    let value = null;
    if (stm.initializer != null) {
      value = this.evaluate(stm.initializer);
    }
    this.environment.define(stm.name.lexeme, value);
    return value;
  }

  visitAssignExpr(exp: expr.Assign): any {
    const value = this.evaluate(exp.value);
    const distance = this.locals.get(exp);
    if (distance !== null && distance !== undefined) {
      this.environment.assignAt(distance, exp.name, value);
    } else {
      this.globals.assign(exp.name, value);
    }
    return value;
  }
  visitBinaryExpr(exp: expr.Binary): any {
    const left = this.evaluate(exp.left);
    const right = this.evaluate(exp.right);
    switch (exp.operator.type) {
      case TT.BANG_EQUAL:
        return !this.isEqual(left, right);
      case TT.EQUAL_EQUAL:
        return this.isEqual(left, right);
      case TT.GREATER:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) > (right as number);
      case TT.GREATER_EQUAL:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) >= (right as number);
      case TT.LESS:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) < (right as number);
      case TT.LESS_EQUAL:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) <= (right as number);
      case TT.MINUS:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) - (right as number);
      case TT.PLUS:
        if (typeof left === "number" && typeof right === "number") {
          return (left as number) + (right as number);
        }
        if (typeof left === "string" && typeof right === "string") {
          return (left as string) + (right as string);
        }
        throw new RuntimeError(
          exp.operator,
          "Operands must be two numbers or two strings.",
        );
      case TT.SLASH:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) / (right as number);
      case TT.STAR:
        this.checkNumberOperands(exp.operator, left, right);
        return (left as number) * (right as number);
    }
    // Unreachable.
    return null;
  }
  visitCallExpr(exp: expr.Call): any {
    let callee = this.evaluate(exp.callee);
    const args: any[] = [];
    for (const arg of exp.args) {
      args.push(this.evaluate(arg));
    }
    if (!(callee && "arity" in callee && "call" in callee)) {
      throw new RuntimeError(exp.paren, "Can only call functions.");
    }
    const func = callee as ObiCallable;
    if (args.length !== func.arity()) {
      throw new RuntimeError(
        exp.paren,
        `Expected ${func.arity()} arguments but got ${args.length}.`,
      );
    }
    return func.call(this, args);
  }
  visitFunctionExpr(exp: expr.Function): any {
    const func = new ObiFunction(exp, this.environment, false);
    if (null !== exp.name) {
      this.environment.define(exp.name.lexeme, func);
    }
    return func;
  }
  visitGetExpr(exp: expr.Get): any {
    const object = this.evaluate(exp.object);
    if (object instanceof ObiInstance) {
      return (object as ObiInstance).get(exp.name);
    }
    if (object instanceof ObiTable) {
      return (object as ObiTable).get(exp.name);
    }
    if (object instanceof Uint8Array) {
      const name = exp.name;
      if (name.lexeme === "len") {
        return (object as Uint8Array).length;
      } else if (typeof (name.literal) === "number") {
        return (object as Uint8Array)[exp.name.literal];
      }
    }
    throw new RuntimeError(exp.name, "Only instances have properties.");
  }
  visitGetDynExpr(exp: expr.GetDyn): any {
    const object = this.evaluate(exp.object);
    const name = this.evaluate(exp.name);
    if (object instanceof ObiInstance) {
      return (object as ObiInstance).getDyn(name, exp.dot);
    }
    if (object instanceof ObiTable) {
      return (object as ObiTable).getDyn(name);
    }
    if (object instanceof Uint8Array) {
      if (name === "len") {
        return (object as Uint8Array).length;
      } else if (typeof (name) === "number") {
        return (object as Uint8Array)[name];
      }
    }
    throw new RuntimeError(exp.dot, "Only instances have properties.");
  }
  visitGroupingExpr(exp: expr.Grouping): any {
    const value = this.evaluate(exp.expression);
    return value;
  }
  visitLiteralExpr(exp: expr.Literal): any {
    return exp.value;
  }
  visitLogicalExpr(exp: expr.Logical): any {
    const left = this.evaluate(exp.left);
    if (exp.operator.type == TT.OR) {
      if (this.isTruthy(left)) return left;
    } else {
      if (!this.isTruthy(left)) return left;
    }
    return this.evaluate(exp.right);
  }
  visitSetExpr(exp: expr.Set): any {
    const object = this.evaluate(exp.object);
    if (!(object instanceof ObiInstance || object instanceof ObiTable)) {
      throw new RuntimeError(exp.name, "Only instances have fields.");
    }
    const value = this.evaluate(exp.value);
    if (object instanceof ObiTable) {
      (object as ObiTable).set(exp.name, value);
    } else {
      (object as ObiInstance).set(exp.name, value);
    }
    return value;
  }
  visitSetDynExpr(exp: expr.SetDyn): any {
    const object = this.evaluate(exp.object);
    if (
      !(object instanceof ObiInstance || object instanceof ObiTable ||
        object instanceof Uint8Array)
    ) {
      throw new RuntimeError(exp.dot, "Only instances have fields.");
    }
    const name = this.evaluate(exp.name);
    const value = this.evaluate(exp.value);
    if (object instanceof ObiTable) {
      (object as ObiTable).setDyn(name, value);
    } else if (object instanceof ObiInstance) {
      (object as ObiInstance).setDyn(name, value, exp.dot);
    } else if ((object as any) instanceof Uint8Array) {
      if (typeof name === "number") {
        (object as Uint8Array)[name] = value;
      }
    }
    return value;
  }
  visitSuperExpr(exp: expr.Super): any {
    const distance = this.locals.get(exp) as number;
    const superclass = this.environment.getAt(distance, "super") as ObiClass;
    const object = this.environment.getAt(distance - 1, "this") as ObiInstance;
    const method = superclass.findMethod(exp.method.lexeme);
    if (null === method) {
      throw new RuntimeError(
        exp.method,
        `Undefined property '${exp.method.lexeme}'.`,
      );
    }
    return method.bind(object);
  }
  visitMatchExpr(exp: expr.Match): any {
    const against = this.evaluate(exp.against);

    for (let i = 0; i < exp.cases.length; i++) {
      const case_ = exp.cases[i];
      if (case_.isDefault) {
        return this.execute(case_.branch);
      }
      if (!case_.pattern) continue; // obi error
      const pattern = this.evaluate(case_.pattern);
      if (this.isEqual(pattern, against)) {
        return this.execute(case_.branch);
      }
    }

    Obi.errorToken(exp.where, "Un-matched match block.");
    return null;
  }
  visitTableExpr(exp: expr.Table): any {
    const table = new ObiTable();
    let index = 0;

    this.environment = new Environment(this.environment);

    for (const value_ of exp.values) {
      if (value_ instanceof expr.Assign) {
        const assign = value_ as expr.Assign;
        const value = this.evaluate(assign.value);
        table.setDyn(assign.name.lexeme, value);
      } else {
        const value = this.evaluate(value_);
        table.setDyn(index as any, value);
        index += 1;
      }
    }

    this.environment = this.environment.enclosing as Environment;

    return table;
  }
  visitThisExpr(exp: expr.This): any {
    return this.lookupVariable(exp.keyword, exp);
  }
  visitUnaryExpr(exp: expr.Unary): any {
    const right = this.evaluate(exp.right);
    switch (exp.operator.type) {
      case TT.BANG:
        return !this.isTruthy(right);
      case TT.MINUS:
        if (typeof right !== "number") {
          throw new RuntimeError(exp.operator, "Operand must be a number.");
        }
        return -(right as number);
    }
    // :notsureif:
    return null;
  }
  visitVariableExpr(exp: expr.Variable): any {
    // if (exp.name.lexeme == "_defined") {
    //   console.log(this.environment, this.locals.get(exp), this.lookupVariable(exp.name, exp))
    // }
    return this.lookupVariable(exp.name, exp);
  }

  lookupVariable(name: Token, exp: Expr): any {
    const distance = this.locals.get(exp);
    if (distance !== null && distance !== undefined) {
      return this.environment.getAt(distance, name.lexeme);
    } else {
      return this.globals.get(name);
    }
  }

  private checkNumberOperands(op: Token, left: any, right: any) {
    if (typeof left === "number" && typeof right === "number") return;
    throw new RuntimeError(op, "Operands must be numbers.");
  }

  private isTruthy(object: any): boolean {
    if (null === object || undefined === object || false === object) {
      return false;
    }
    if (object instanceof Boolean) return object as boolean;
    return true;
  }

  public isEqual(a: any, b: any): boolean {
    if (null == a && null == b) return true;
    else if (null == a) return false;
    return a === b;
  }

  static stringify(object: any) {
    if (null === object) return "nil";
    if (typeof object === "number") {
      if (object === 0) {
        const bytes = Interpreter.doubleToByteArray(object);
        // Not really sure why this is expected...
        if (bytes[0] === -128) return "-0";
      }
      return JSON.stringify(object);
    }
    if (typeof object === "string") {
      return object;
    }
    if (object && object.toString) {
      return object.toString();
    }
    return JSON.stringify(object);
  }

  private static doubleToByteArray(num: number) {
    const buffer = new ArrayBuffer(8); // JS numbers are 8 bytes long, or 64 bits
    const longNum = new Float64Array(buffer); // so equivalent to Float64
    longNum[0] = num;
    return Array.from(new Int8Array(buffer)).reverse(); // reverse to get little endian
  }

  getEnvironment(): Environment {
    return this.environment;
  }
}

export class Case {
  pattern: Expr | null;
  branch: Stmt;
  isDefault: boolean;

  constructor(pattern: Expr | null, branch: Stmt, isDefault: boolean) {
    this.pattern = pattern;
    this.branch = branch;
    this.isDefault = isDefault;
  }
}

class ParseError extends Error {
}

class Parser {
  tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.isAtEnd()) {
      const decl = this.declaration();
      if (decl) {
        statements.push(decl);
      }
    }
    return statements;
  }

  private expression(): Expr {
    return this.assignment();
  }

  private declaration(): Stmt | null {
    try {
      if (this.match(TT.CLASS)) return this.classDeclaration();
      if (this.match(TT.FUN)) {
        return new stmt.Expression(this.function("function"));
      }
      if (
        this.check(TT.IDENTIFIER) && this.peekNext().type === TT.COLON_EQUAL
      ) {
        return this.varDeclaration();
      }
      return this.statement();
    } catch (err) {
      if (err instanceof ParseError) {
        this.synchronize();
        return null;
      } else {
        throw err;
      }
    }
  }

  private classDeclaration(): Stmt {
    const name = this.consume(TT.IDENTIFIER, "Expect class name.");
    let superclass = null;
    if (this.match(TT.LESS)) {
      this.consume(TT.IDENTIFIER, "Expect superclass name.");
      superclass = new expr.Variable(this.previous());
    }

    this.consume(TT.LEFT_BRACE, "Expect '{' before class body.");

    const methods: expr.Function[] = [];
    while (!this.check(TT.RIGHT_BRACE) && !this.isAtEnd()) {
      methods.push(this.function("method"));
    }
    this.consume(TT.RIGHT_BRACE, "Expect '}' after class body.");
    return new stmt.Class(name, superclass, methods);
  }

  private statement(): Stmt {
    if (this.match(TT.RETURN)) return this.returnStatement();
    if (this.match(TT.LEFT_BRACE)) return new stmt.Block(this.block());
    return this.expressionStatement();
  }

  private returnStatement(): Stmt {
    const keyword = this.previous();
    let value = null;
    if (!this.check(TT.SEMICOLON)) {
      value = this.expression();
    }
    this.consume(TT.SEMICOLON, "Expect ';' after return value.");
    return new stmt.Return(keyword, value);
  }

  private varDeclaration() {
    const name = this.consume(TT.IDENTIFIER, "Expect variable name.");
    this.consume(TT.COLON_EQUAL, "Expect ':=' after variable declaration.");
    const initializer = this.expression();
    this.consume(TT.SEMICOLON, "Expect ';' after variable declaration.");
    return new stmt.Var(name, initializer);
  }

  private expressionStatement(): Stmt {
    const expr = this.expression();
    this.consume(TT.SEMICOLON, "Expect ';' after expression.");
    return new stmt.Expression(expr);
  }

  private function(kind: string): expr.Function {
    let name = null;
    if (this.match(TT.IDENTIFIER)) {
      name = this.previous();
    }
    this.consume(TT.LEFT_PAREN, `Expect '(' after ${kind} name.`);
    const params: Token[] = [];
    if (!this.check(TT.RIGHT_PAREN)) {
      do {
        if (params.length >= 255) {
          this.error(this.peek(), "Can't have more than 255 parameters.");
        }
        params.push(this.consume(TT.IDENTIFIER, "Expect parameter name."));
      } while (this.match(TT.COMMA));
    }
    this.consume(TT.RIGHT_PAREN, "Expect ')' after parameters.");
    this.consume(TT.LEFT_BRACE, `Expect '{' before ${kind} body.`);
    const body = this.block();
    return new expr.Function(name, params, body);
  }

  private block(): Stmt[] {
    const statements = [];
    while (!this.check(TT.RIGHT_BRACE) && !this.isAtEnd()) {
      const decl = this.declaration();
      if (decl) {
        statements.push(decl);
      }
    }
    this.consume(TT.RIGHT_BRACE, "Expect '}' after block.");
    return statements;
  }

  private anonymousFunction(): Expr {
    this.consume(TT.LEFT_BRACE, "Expect '{' to begin anonymous function.");
    const body = this.block();
    return new expr.Function(null, [], body);
  }

  private assignment(): Expr {
    const exp = this.or();
    if (this.match(TT.EQUAL)) {
      const equals = this.previous();
      const value = this.assignment();
      if (exp instanceof expr.Variable) {
        const name = (exp as expr.Variable).name;
        return new expr.Assign(name, value);
      } else if (exp instanceof expr.Get) {
        const get = exp as expr.Get;
        return new expr.Set(get.object, get.name, value);
      } else if (exp instanceof expr.GetDyn) {
        const get = exp as expr.GetDyn;
        return new expr.SetDyn(get.object, get.dot, get.name, value);
      }
      this.error(equals, "Invalid assignment target.");
    }
    return exp;
  }

  private or(): Expr {
    let exp = this.and();
    while (this.match(TT.OR)) {
      const op = this.previous();
      const right = this.and();
      exp = new expr.Logical(exp, op, right);
    }
    return exp;
  }

  private and(): Expr {
    let exp = this.equality();
    while (this.match(TT.AND)) {
      const op = this.previous();
      const right = this.equality();
      exp = new expr.Logical(exp, op, right);
    }
    return exp;
  }

  private equality(): Expr {
    let exp = this.comparison();

    while (this.match(TT.BANG_EQUAL, TT.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      exp = new expr.Binary(exp, operator, right);
    }

    return exp;
  }

  private comparison(): Expr {
    let exp = this.term();
    while (this.match(TT.GREATER, TT.GREATER_EQUAL, TT.LESS, TT.LESS_EQUAL)) {
      const op = this.previous();
      const right = this.term();
      exp = new expr.Binary(exp, op, right);
    }
    return exp;
  }

  private term(): Expr {
    let exp = this.factor();
    while (this.match(TT.MINUS, TT.PLUS)) {
      const op = this.previous();
      const right = this.factor();
      exp = new expr.Binary(exp, op, right);
    }
    return exp;
  }

  private factor(): Expr {
    let exp = this.unary();
    while (this.match(TT.SLASH, TT.STAR)) {
      const op = this.previous();
      const right = this.unary();
      exp = new expr.Binary(exp, op, right);
    }
    return exp;
  }

  private unary(): Expr {
    if (this.match(TT.BANG, TT.MINUS)) {
      const op = this.previous();
      const right = this.unary();
      return new expr.Unary(op, right);
    }
    return this.call();
  }

  private finishCall(callee: Expr): Expr {
    const args: Expr[] = [];
    if (!this.check(TT.RIGHT_PAREN)) {
      do {
        if (args.length >= 255) {
          this.error(this.peek(), "Can't have more than 255 arguments.");
        }
        args.push(this.expression());
      } while (this.match(TT.COMMA));
    }
    const paren = this.consume(TT.RIGHT_PAREN, "Expect ')' after arguments.");

    while (this.check(TT.LEFT_BRACE, TT.FUN)) {
      if (args.length >= 255) {
        this.error(this.peek(), "Can't have more than 255 arguments.");
      }

      if (this.match(TT.FUN)) {
        const trailing = this.function("function");
        args.push(trailing);
      } else if (this.check(TT.LEFT_BRACE)) {
        const trailing = this.anonymousFunction();
        args.push(trailing);
      }
    }

    return new expr.Call(callee, paren, args);
  }

  private call(): Expr {
    let exp = this.primary();
    while (true) {
      if (this.match(TT.LEFT_PAREN)) {
        exp = this.finishCall(exp);
      } else if (this.match(TT.DOT)) {
        if (this.match(TT.LEFT_PAREN)) {
          const dot = this.previous();
          const name = this.expression();
          this.consume(TT.RIGHT_PAREN, "Expect ')' after expression.");
          exp = new expr.GetDyn(exp, dot, name);
        } else {
          // Converts identifier-property accesses into dynamic
          // get, but dynamic get handler also returns nil
          // for not-found properties.
          // const name = this.consume(
          //   TT.IDENTIFIER,
          //   "Expect property name after '.'.",
          // );
          // const propName = new expr.Literal(name.lexeme);
          // exp = new expr.GetDyn(exp, name, propName);

          const name = this.consume(
            TT.IDENTIFIER,
            "Expect property name after '.'.",
          );
          exp = new expr.Get(exp, name);
        }
      } else {
        break;
      }
    }
    return exp;
  }

  private table(): expr.Table {
    const values: Expr[] = [];
    let index = 0;
    while (true) {
      if (this.isAtEnd()) {
        break;
      } else if (this.match(TT.RIGHT_BRACKET)) {
        return new expr.Table(values);
      } else {
        const value = this.expression();
        values.push(value);
        if (this.peek().type !== TT.RIGHT_BRACKET) {
          this.consume(TT.COMMA, "Expect ',' after value in table literal.");
        }
      }
    }
    throw this.error(this.peek(), "Unterminated table literal.");
  }

  private primary(): Expr {
    if (this.match(TT.FALSE)) return new expr.Literal(false);
    if (this.match(TT.TRUE)) return new expr.Literal(true);
    if (this.match(TT.NIL)) return new expr.Literal(null);

    if (this.match(TT.NUMBER)) return new expr.Literal(this.previous().literal);
    if (this.match(TT.STRING)) return new expr.Literal(this.previous().literal);

    if (this.match(TT.LEFT_BRACKET)) {
      return this.table();
    }

    if (this.match(TT.SUPER)) {
      const keyword = this.previous();
      this.consume(TT.DOT, "Expect '.' after 'super'.");
      const method = this.consume(
        TT.IDENTIFIER,
        "Expect superclass method name.",
      );
      return new expr.Super(keyword, method);
    }

    if (this.match(TT.THIS)) {
      return new expr.This(this.previous());
    }

    if (this.match(TT.IDENTIFIER)) {
      return new expr.Variable(this.previous());
    }

    if (this.match(TT.LEFT_PAREN)) {
      if (this.match(TT.RIGHT_PAREN)) {
        return new expr.Grouping(new expr.Literal(null)); // do we even need the grouping?
      }
      const exp = this.expression();
      this.consume(TT.RIGHT_PAREN, "Expect ')' after expression.");
      return new expr.Grouping(exp);
    }

    if (this.match(TT.FUN)) {
      return this.function("function");
    }

    if (this.match(TT.MATCH)) {
      return this.matchExpression();
    }

    throw this.error(this.peek(), "Expect expression.");
  }

  private matchExpression(): Expr {
    const where = this.previous();
    const against = this.expression();
    this.consume(
      TT.LEFT_BRACE,
      "Expect '{' after discriminant in match statement.",
    );
    if (this.peek().type === TT.RIGHT_BRACE) {
      throw this.error(this.previous(), "Expect non-empty match expression.");
    }
    const cases = [];
    while (!this.check(TT.RIGHT_BRACE)) {
      cases.push(this.case_());
    }
    this.consume(TT.RIGHT_BRACE, "Expect '}' after match cases.");
    return new expr.Match(where, against, cases);
  }

  // Parse case statement.
  private case_(): Case {
    if (this.match(TT.UNDERSCORE)) {
      this.consume(TT.MINUS_LESS, "Expect '->' after pattern in case.");
      const branch = this.statement();
      return new Case(null, branch, true);
    }
    const pattern = this.expression();
    this.consume(TT.MINUS_LESS, "Expect '->' after pattern in case.");
    const branch = this.statement();
    return new Case(pattern, branch, false);
  }

  private pattern(): Expr {
    if (this.match(TT.NUMBER, TT.STRING, TT.FALSE, TT.TRUE, TT.NIL)) {
      return new expr.Literal(this.previous().literal);
    }

    throw this.error(this.peek(), "Expect scalar in pattern.");
  }

  private match(...types: TokenType[]): boolean {
    for (const typ of types) {
      if (this.check(typ)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private check(...types: TokenType[]): boolean {
    if (this.isAtEnd()) return false;
    const next = this.peek().type;
    return types.some((t) => t === next);
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TT.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token {
    if (this.isAtEnd()) return this.tokens[this.tokens.length - 1];
    return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private error(token: Token, message: string): ParseError {
    Obi.errorToken(token, message);
    return new ParseError();
  }

  private synchronize() {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type == TT.SEMICOLON) return;
      switch (this.peek().type) {
        case TT.CLASS:
        case TT.RETURN:
          return;
      }
      this.advance();
    }
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
    keywords.set("_", TT.UNDERSCORE);
    keywords.set("and", TT.AND);
    keywords.set("class", TT.CLASS);
    keywords.set("else", TT.ELSE);
    keywords.set("false", TT.FALSE);
    keywords.set("for", TT.FOR);
    keywords.set("fun", TT.FUN);
    keywords.set("if", TT.IF);
    keywords.set("match", TT.MATCH);
    // keywords.set("mod", TT.MOD);
    keywords.set("nil", TT.NIL);
    keywords.set("or", TT.OR);
    keywords.set("pub", TT.PUB);
    keywords.set("return", TT.RETURN);
    keywords.set("super", TT.SUPER);
    keywords.set("this", TT.THIS);
    keywords.set("tee", TT.TEE);
    keywords.set("tap", TT.TAP);
    keywords.set("true", TT.TRUE);
    keywords.set("var", TT.VAR);
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
      case "[":
        this.addToken(TT.LEFT_BRACKET);
        this.column += 1;
        break;
      case "]":
        this.addToken(TT.RIGHT_BRACKET);
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
      // case "_":
      //   this.addToken(TT.UNDERSCORE);
      //   this.column += 1;
      //   break;
      case "-":
        if (this.match(">")) {
          this.addToken(TT.MINUS_LESS);
          this.column += 2;
        } else {
          this.addToken(TT.MINUS);
          this.column += 1;
        }
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
          // this.addTokenLiteral(TT.COMMENT, text);
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
        } else if (this.match("=")) {
          this.addToken(TT.COLON_EQUAL);
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
        // add back in for formatter
        // this.addToken(TT.NEWLINE);
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
    let type: TokenType | null = Scanner.keywords.get(text) || null;
    if (type === null) type = TT.IDENTIFIER;
    this.addToken(type);
    this.column += (this.current - this.start);
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
      number,
    );
    this.column += (this.current - this.start);
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
    this.addTokenLiteral(TT.STRING, value);
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
    return c == "-" || c == "?" || c == "!" || c == "@" || c == "'";
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

  private addTokenLiteral(typ: TokenType, literal: any) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(new Token(typ, text, literal, this.line, this.column));
  }

  isAtEnd(): boolean {
    return this.current >= this.source.length;
  }
}

module Obi {
  export let interpreter: Interpreter = new Interpreter();
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

  export const runtimeError = (err: RuntimeError) => {
    console.error(err.message + `\n[line ${err.token.line}]`);
    hadRuntimeError = true;
  };
}

const ENC = new TextEncoder();

export const MODULE_CLASS = new ObiClass(
  "Module",
  null,
  new Map<string, ObiFunction>(),
);

function loadPrelude(source: string) {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  const statements = parser.parse();

  if (Obi.hadError) {
    throw new Error("Failed to load prelude");
  }

  const resolver = new Resolver(Obi.interpreter);
  resolver.resolveStmts(statements);

  if (Obi.hadError) {
    throw new Error("Failed to resolve prelude");
  }

  Obi.interpreter.interpret(statements);
}

async function run(source: string) {
  loadPrelude(PRELUDE);

  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  const statements = parser.parse();

  if (Obi.hadError) return;

  // Also resolve async modules?
  // Also verify modules are at top-level?
  const resolver = new Resolver(Obi.interpreter);
  resolver.resolveStmts(statements);

  if (Obi.hadError) return;

  await Obi.interpreter.interpret(statements);
}

async function runFile(file: string) {
  Obi.interpreter.setEntryFile(file);

  const contents = await Deno.readTextFile(file);
  run(contents);

  if (Obi.hadError) Deno.exit(65);
  if (Obi.hadRuntimeError) Deno.exit(70);
}

{
  const args = Deno.args;

  if (args.length >= 1) {
    const obiFile = args[0] as string;
    if (!obiFile.endsWith(".obi")) {
      console.error(
        `Usage: deno run --allow-all obi.ts [path to obi source] [other args...]`,
      );
      Deno.exit(65);
    }

    await runFile(obiFile);
  } else {
    console.error(
      `Usage: deno run --allow-all obi.ts [path to obi source] [other args...]`,
    );
  }
}
