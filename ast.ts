/* THIS FILE WAS GENERATED */

import { Case, Token } from "./obi.ts";

export module expr {
  export abstract class Expr {
    abstract accept<T>(visitor: Visitor<T>): T;
  }
  export type Visitor<T> = {
    visitAssignExpr: (exp: Assign) => T;
    visitBinaryExpr: (exp: Binary) => T;
    visitCallExpr: (exp: Call) => T;
    visitGetDynExpr: (exp: GetDyn) => T;
    visitGetExpr: (exp: Get) => T;
    visitSetExpr: (exp: Set) => T;
    visitSetDynExpr: (exp: SetDyn) => T;
    visitSuperExpr: (exp: Super) => T;
    visitThisExpr: (exp: This) => T;
    visitFunctionExpr: (exp: Function) => T;
    visitGroupingExpr: (exp: Grouping) => T;
    visitLiteralExpr: (exp: Literal) => T;
    visitMatchExpr: (exp: Match) => T;
    visitLogicalExpr: (exp: Logical) => T;
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
  export class GetDyn extends Expr {
    object: Expr;
    dot: Token;
    name: Expr;

    constructor(object: Expr, dot: Token, name: Expr) {
      super();
      this.object = object;
      this.dot = dot;
      this.name = name;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitGetDynExpr(this);
    }
  }
  export class Get extends Expr {
    object: Expr;
    name: Token;

    constructor(object: Expr, name: Token) {
      super();
      this.object = object;
      this.name = name;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitGetExpr(this);
    }
  }
  export class Set extends Expr {
    object: Expr;
    name: Token;
    value: Expr;

    constructor(object: Expr, name: Token, value: Expr) {
      super();
      this.object = object;
      this.name = name;
      this.value = value;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitSetExpr(this);
    }
  }
  export class SetDyn extends Expr {
    object: Expr;
    dot: Token;
    name: Expr;
    value: Expr;

    constructor(object: Expr, dot: Token, name: Expr, value: Expr) {
      super();
      this.object = object;
      this.dot = dot;
      this.name = name;
      this.value = value;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitSetDynExpr(this);
    }
  }
  export class Super extends Expr {
    keyword: Token;
    method: Token;

    constructor(keyword: Token, method: Token) {
      super();
      this.keyword = keyword;
      this.method = method;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitSuperExpr(this);
    }
  }
  export class This extends Expr {
    keyword: Token;

    constructor(keyword: Token) {
      super();
      this.keyword = keyword;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitThisExpr(this);
    }
  }
  export class Function extends Expr {
    name: Token | null;
    parameters: Token[];
    body: stmt.Stmt[];
    isAsync: boolean;

    constructor(name: Token | null, parameters: Token[], body: stmt.Stmt[], isAsync: boolean) {
      super();
      this.name = name;
      this.parameters = parameters;
      this.body = body;
      this.isAsync = isAsync;
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
  export class Match extends Expr {
    where: Token;
    against: Expr;
    cases: Case[];

    constructor(where: Token, against: Expr, cases: Case[]) {
      super();
      this.where = where;
      this.against = against;
      this.cases = cases;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitMatchExpr(this);
    }
  }
  export class Logical extends Expr {
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
      return visitor.visitLogicalExpr(this);
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
    visitClassStmt: (exp: Class) => T;
    visitExpressionStmt: (exp: Expression) => T;
    visitReturnStmt: (exp: Return) => T;
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
  export class Class extends Stmt {
    name: Token;
    superclass: expr.Variable | null;
    methods: expr.Function[];

    constructor(name: Token, superclass: expr.Variable | null, methods: expr.Function[]) {
      super();
      this.name = name;
      this.superclass = superclass;
      this.methods = methods;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitClassStmt(this);
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
  export class Return extends Stmt {
    keyword: Token;
    value: Expr | null;

    constructor(keyword: Token, value: Expr | null) {
      super();
      this.keyword = keyword;
      this.value = value;
    }
    accept<T>(visitor: Visitor<T>): T {
      return visitor.visitReturnStmt(this);
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
