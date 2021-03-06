// Usage: deno run generate_ast.ts > ast.ts

const defineVisitor = (baseName: string, types: string[]) => {
  console.log(`  export type Visitor<T> = {`);
  for (const typ of types) {
    const className = typ.split("=")[0].trim();
    console.log(`    visit${className}${baseName}: (exp: ${className}) => T;`);
  }
  console.log(`  };`);
};

const defineType = (baseName: string, className: string, fields: string[]) => {
  console.log(`  export class ${className} extends ${baseName} {`);
  for (const field of fields) {
    console.log(`    ${field};`);
  }
  console.log(`\n    constructor(${fields.join(", ")}) {
      super();`);
  for (const field of fields) {
    const name = field.split(": ")[0];
    console.log(`      this.${name} = ${name};`);
  }
  console.log(`    }`);
  console.log(`    accept<T>(visitor: Visitor<T>): T {
      return visitor.visit${className}${baseName}(this);
    }`);
  console.log(`  }`);
};

const defineAst = (baseName: string, types: string[]) => {
  console.log(`  export abstract class ${baseName} {
    abstract accept<T>(visitor: Visitor<T>): T;
  }`);

  defineVisitor(baseName, types);

  for (const typ of types) {
    const className = typ.split("=")[0].trim();
    const fields = typ.split("=")[1].trim().split(", ");
    defineType(baseName, className, fields);
  }
};

{
  console.log(`/* THIS FILE WAS GENERATED */\n`);
  console.log(`import { Case, Token } from "./obi.ts";`);
  console.log(`\nexport module expr {`);
  defineAst("Expr", [
    "Assign   = name: Token, value: Expr",
    "Binary   = left: Expr, operator: Token, right: Expr",
    "Block    = expressions: Expr[]",
    "Call     = callee: Expr, paren: Token, args: Expr[]",
    "Get      = object: Expr, name: Token",
    "GetDyn   = object: Expr, dot: Token, name: Expr",
    "Set      = object: Expr, name: Token, value: Expr",
    "SetDyn   = object: Expr, dot: Token, name: Expr, value: Expr",
    "Function = name: Token | null, parameters: Token[], body: Expr[], publish: boolean",
    "Grouping = expression: Expr",
    "Literal  = value: any",
    "Match    = where: Token, against: Expr, cases: Case[]",
    "Logical  = left: Expr, operator: Token, right: Expr",
    "Return   = keyword: Token, value: Expr | null",
    "Table    = values: Expr[]",
    "Unary    = operator: Token, right: Expr",
    "Var      = name: Token, initializer: Expr, publish: boolean",
    "Variable = name: Token",
  ]);
  console.log(`}`);
}
