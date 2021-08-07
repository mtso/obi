/* THIS FILE WAS GENERATED */

import { Token } from "./obi.ts";

export module expr {
  export abstract class Expr {
    abstract accept<T>(visitor: Visitor<T>): T;
  }
  export type Visitor<T> = {
    visitAssignExpr: (exp: Assign) => T;
    visitBinaryExpr: (exp: Binary) => T;
    visitCallExpr: (exp: Call) => T;
    visitFunctionExpr: (exp: Function) => T;
    visitGroupingExpr: (exp: Grouping) => T;
    visitLiteralExpr: (exp: Literal) => T;
    visitUnaryExpr: (exp: Unary) => T;
    visitVariableExpr: (exp: Variable) => T;
  };
  export class Assign extends Expr {
    name: Token;
    value: Expr;

    constructor(name: Token, value: Expr) {
      super();
      this.name = name;
      this.value = value;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitAssignExpr(this);
    }
  }
  export class Binary extends Expr {
    left: Expr;
    operator: Token;
    right: Expr;

    constructor(left: Expr, operator: Token, right: Expr) {
      super();
      this.left = left;
      this.operator = operator;
      this.right = right;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitBinaryExpr(this);
    }
  }
  export class Call extends Expr {
    callee: Expr;
    paren: Token;
    args: Expr[];

    constructor(callee: Expr, paren: Token, args: Expr[]) {
      super();
      this.callee = callee;
      this.paren = paren;
      this.args = args;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitCallExpr(this);
    }
  }
  export class Function extends Expr {
    name: Token | null;
    parameters: Token[];
    body: stmt.Stmt[];

    constructor(name: Token | null, parameters: Token[], body: stmt.Stmt[]) {
      super();
      this.name = name;
      this.parameters = parameters;
      this.body = body;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitFunctionExpr(this);
    }
  }
  export class Grouping extends Expr {
    expression: Expr;

    constructor(expression: Expr) {
      super();
      this.expression = expression;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitGroupingExpr(this);
    }
  }
  export class Literal extends Expr {
    value: any;

    constructor(value: any) {
      super();
      this.value = value;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitLiteralExpr(this);
    }
  }
  export class Unary extends Expr {
    operator: Token;
    right: Expr;

    constructor(operator: Token, right: Expr) {
      super();
      this.operator = operator;
      this.right = right;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitUnaryExpr(this);
    }
  }
  export class Variable extends Expr {
    name: Token;

    constructor(name: Token) {
      super();
      this.name = name;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitVariableExpr(this);
    }
  }
}

export module stmt {
  type Expr = expr.Expr;
  export abstract class Stmt {
    abstract accept<T>(visitor: Visitor<T>): T;
  }
  export type Visitor<T> = {
    visitBlockStmt: (exp: Block) => T;
    visitExpressionStmt: (exp: Expression) => T;
    visitVarStmt: (exp: Var) => T;
  };
  export class Block extends Stmt {
    statements: Stmt[];

    constructor(statements: Stmt[]) {
      super();
      this.statements = statements;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitBlockStmt(this);
    }
  }
  export class Expression extends Stmt {
    expression: Expr;

    constructor(expression: Expr) {
      super();
      this.expression = expression;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitExpressionStmt(this);
    }
  }
  export class Var extends Stmt {
    name: Token;
    initializer: Expr;

    constructor(name: Token, initializer: Expr) {
      super();
      this.name = name;
      this.initializer = initializer;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitVarStmt(this);
    }
  }
}
