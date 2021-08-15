import {
  Interpreter,
  ObiCallable,
  ObiFunction,
  ObiTable,
  RuntimeError,
  Token,
  TT,
} from "./obi.ts";

import * as path from "https://deno.land/std@0.103.0/path/mod.ts";
import {
  ensureDirSync,
  existsSync,
} from "https://deno.land/std@0.103.0/fs/mod.ts";

export class RtPrint implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    console.log(Interpreter.stringify(args[0]));
  }
  toString(): string {
    return "<native fn>";
  }
}

export class RtDelay implements ObiCallable {
  arity(): number {
    return 2;
  }

  call(interpreter: Interpreter, args: any[]): any {
    const by = args[0] as number;
    const func = args[1] as ObiFunction;

    const id = Math.random();
    interpreter.waitGroup.add(1);
    const timer = setTimeout(() => {
      func.call(interpreter, []);
      interpreter.waitGroup.done();
    }, by);
    interpreter.timers.set(id, timer);
    return id;
  }
}

export class RtStrslice implements ObiCallable {
  arity(): number {
    return 3;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const str = args[0];
    const start = args[1];
    const end = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError({} as Token, "Invalid arg to substr");
    }
    return str.substring(start, end);
  }
}

export class RtClearDelay implements ObiCallable {
  arity(): number {
    return 1;
  }

  call(interpreter: Interpreter, args: any[]): any {
    const id = args[0] as number;
    const timer = interpreter.timers.get(id);
    clearTimeout(timer);
  }
}

export class RtType implements ObiCallable {
  arity(): number {
    return 1;
  }

  call(interpreter: Interpreter, args: any[]): any {
    const e = args[0];
    if (e instanceof ObiFunction) {
      return "function";
    } else if (e instanceof Uint8Array) {
      return "array";
    } else if (e instanceof ObiTable) {
      return "table";
    } else if (e === null) {
      return "nil";
    } else if (typeof e === "string") {
      return "string";
    } else if (typeof e === "number") {
      return "number";
    } else if (typeof e === "boolean") {
      return "boolean";
    } else {
      return (typeof e);
    }
  }
}

export class RtKeys implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    if (args[0] instanceof ObiTable) {
      const o = args[0] as ObiTable;
      const array = new ObiTable();
      let i = 0;
      for (const key of o.getFields().keys()) {
        array.setDyn(i, key);
        i += 1;
      }
      // array.setDyn("len", i);
      return array;
    } else {
      throw new RuntimeError({} as Token, "Invalid type passed to 'keys'");
    }
  }
}

export class RtListenTcp implements ObiCallable {
  arity(): number {
    return 3;
  }

  call(interpreter: Interpreter, args: any[]): any {
    const hostname = args[0] as string;
    const port = args[1] as number;
    const handler = args[2] as ObiFunction;

    async function readAll(reader: Deno.Reader) {
      const buf = new Uint8Array(4096);
      let data = "";
      let len = 4096;
      while (len >= 4096) {
        const read = await reader.read(buf);
        if (!read) break;
        len = read;
        data += (new TextDecoder()).decode(buf.slice(0, len));
      }
      return data;
    }
    async function readAllBytes(reader: Deno.Reader) {
      const buf = new Uint8Array(4096);
      let data = "";
      const CHUNK_SIZE = 4096;
      let len = CHUNK_SIZE;
      const chunks = [];
      while (len >= CHUNK_SIZE) {
        const read = await reader.read(buf);
        if (!read) break;
        len = read;
        chunks.push(buf.slice(0, len));
      }
      if (chunks.length < 1) {
        return new Uint8Array(0);
      }
      const totalSize = (chunks.length - 1) * CHUNK_SIZE +
        (chunks[chunks.length - 1].length);
      const result = new Uint8Array(totalSize);
      for (let i = 0; i < chunks.length; i++) {
        for (let j = 0; j < chunks[i].length; j++) {
          result[i * CHUNK_SIZE + j] = chunks[i][j];
        }
      }
      return result;
    }

    class R {
      bytes: Uint8Array;
      where: number = 0;
      done: boolean = false;
      constructor(bytes: Uint8Array) {
        this.bytes = bytes;
      }
      async read(to: Uint8Array): Promise<number | null> {
        if (this.done) return Promise.resolve(null);
        const len = to.length;
        for (let i = 0; i < this.bytes.length && i < len; i++) {
          to[i] = this.bytes[i];
        }
        this.done = true;
        return Promise.resolve(len);
      }
    }

    interpreter.waitGroup.add(1);

    (async function () {
      const listener = Deno.listen({ hostname, port });

      for await (const conn of listener) {
        let closed = false;

        class WriteString implements ObiCallable {
          arity(): number {
            return 1;
          }
          call(interpreter: Interpreter, args: any[]): any {
            if (closed) return;
            const data = args[0];
            const buf = (new TextEncoder()).encode(data);
            try {
              Deno.copy(new R(buf), conn);
            } catch (err) {
              console.log(err);
            }
          }
        }
        class Write implements ObiCallable {
          arity(): number {
            return 1;
          }
          call(interpreter: Interpreter, args: any[]): any {
            if (closed) return;
            const data = args[0] as Uint8Array;
            try {
              conn.write(data);
            } catch (err) {
              console.log(err);
            }
          }
        }

        class OnData implements ObiCallable {
          arity(): number {
            return 1;
          }

          call(interpreter: Interpreter, args: any[]): any {
            const receiver = args[0];

            (async function getData() {
              if (closed) return;
              try {
                const bytes = await readAllBytes(conn);
                receiver.call(interpreter, [bytes]);
              } catch (err) {
                if (err.name === "Interrupted") {
                  if (!closed) closed = true;
                } else {
                  console.error("Unhandled read error", err);
                }
              }
            })();
          }
        }

        class Close implements ObiCallable {
          arity(): number {
            return 0;
          }

          call(interpreter: Interpreter, args: any[]): any {
            if (closed) return;
            closed = true;
            setTimeout(() => conn.close(), 0);
          }
        }

        const connectionInstance = new ObiTable();
        connectionInstance.setDyn(
          "write_string",
          new WriteString(),
        );
        connectionInstance.setDyn(
          "on_data",
          new OnData(),
        );
        connectionInstance.setDyn(
          "close",
          new Close(),
        );
        connectionInstance.setDyn(
          "write",
          new Write(),
        );

        handler.call(interpreter, [connectionInstance]);
      }

      interpreter.waitGroup.done();
    })();
  }
}
export class RtStr implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return Interpreter.stringify(args[0]);
  }
}
export class RtStrlen implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const str = args[0];
    if (typeof str !== "string") {
      console.log(str);
      throw new RuntimeError({} as Token, "Invalid arg to strlen");
    }
    return str.length;
  }
}
export class RtLen implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const thing = args[0];
    if (thing && "length" in thing) {
      return thing.length;
    }
    if (thing instanceof ObiTable) {
      return Array.from((thing as ObiTable).getFields().keys()).length;
    }
    console.log(thing);
    throw new RuntimeError({} as Token, "Invalid arg to len");
  }
}

export class RtWritefile implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    try {
      const path = args[0];
      const contents = args[1];
      return Deno.writeFileSync(path, contents);
    } catch (err) {
      throw new RuntimeError(
        {} as Token,
        `Failed to write '${args[0]}': ` + err.message,
      );
    }
  }
}
export class RtReadfile implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    try {
      const contents = Deno.readTextFileSync(args[0]);
      return contents;
    } catch (err) {
      if (err.name === "NotFound") {
        return null;
      }
      throw new RuntimeError(
        {} as Token,
        `Failed to read '${args[0]}': ` + err.message,
      );
    }
  }
}
export class RtReadfileBytes implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    try {
      const contents = Deno.readFileSync(args[0]);
      return contents;
    } catch (err) {
      if (err.name === "NotFound") {
        return null;
      }
      throw new RuntimeError(
        {} as Token,
        `Failed to read '${args[0]}': ` + err.message,
      );
    }
  }
}
export class RtProcessArgs implements ObiCallable {
  arity(): number {
    return 0;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const runtimeArgs = Deno.args.slice(1);
    const container = new ObiTable();
    for (let i = 0; i < runtimeArgs.length; i++) {
      container.setDyn(
        i,
        runtimeArgs[i],
      );
    }
    container.setDyn(
      "count",
      runtimeArgs.length,
    );
    return container;
  }
}
export class RtMod implements ObiCallable {
  /// Relevant filenames:
  /// - .obi_tool/package_resolution.json obipub generated file containing mapping of package name to package location.
  /// - obiput.toml : package configuration file whose containing directory is considered the package root.
  packages: Map<string, string> | null = null;
  context: string | null = null;
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    if (args[0] === "builtins") {
      return this.loadBuiltins();
    }
    const location = this.findLocation(args[0], interpreter);
    const previousContext = this.context;
    this.context = path.dirname(location);
    const source = Deno.readTextFileSync(location);
    const module = interpreter.loadModule(source);
    this.context = previousContext;
    return module;
  }
  findLocation(name: string, interpreter: Interpreter): string {
    if (name.startsWith(".")) {
      const localPath = path.join(path.dirname(interpreter.entryFile), name);
      if (existsSync(localPath)) {
        return localPath;
      }
      if (this.context) {
        const libPath = path.join(this.context, name);
        if (existsSync(libPath)) {
          return libPath;
        }
      }
    }
    this.ensurePackages(interpreter);
    const pieces = name.split("/");
    const packageName = pieces[0];
    const packagePath = pieces.slice(1).join("/");
    return path.join(this.getPackage(packageName), packagePath);
  }
  getPackage(name: string): string {
    if (!this.packages) {
      throw new RuntimeError({} as Token, "Expect .packages to be loaded");
    }
    const location = this.packages.get(name);
    if (!location) {
      throw new RuntimeError({} as Token, "Invalid package name: " + name);
    } else {
      return location;
    }
  }
  // from the entry file
  //   search: search directory.
  //     if .obi-packages exists, use
  //     else move up one directory
  //   if up one directory
  //     if obipub.toml exists, mark root
  //     goto: search
  findObiPackageFile(from: string): string | null {
    let root: string | null = null;
    const search = (from: string): string | null => {
      for (const entry of Deno.readDirSync(from)) {
        if (entry.isDirectory && entry.name === ".obi_tool") {
          root = from;
          const resolutionFile = path.join(
            from,
            ".obi_tool",
            "package_resolution.json",
          );
          if (existsSync(resolutionFile)) {
            return resolutionFile;
          }
        }
        if (entry.isFile && entry.name === "obipub.toml") {
          root = from;
        }
      }
      if (root) {
        return null;
      } else {
        return search(path.dirname(from));
      }
    };
    return search(from);
  }
  ensurePackages(interpreter: Interpreter) {
    if (!this.packages) {
      const packagePath = this.findObiPackageFile(
        path.dirname(interpreter.entryFile),
      );
      if (!packagePath) {
        throw new RuntimeError(
          {} as Token,
          "Expected '.obi_tools/package_resolution.json' file at the package root, but did not find one. Have you run \`obi pub get\`?",
        );
      }
      if (existsSync(packagePath)) {
        const packageFile = Deno.readTextFileSync(packagePath);
        this.packages = this.parsePackageFile(packageFile);
      } else {
        this.packages = new Map<string, string>();
      }
    }
  }
  parsePackageFile(source: string): Map<string, string> {
    const packages = new Map<string, string>();
    const info = JSON.parse(source);
    for (const p of info.packages) {
      packages.set(p.name, p.archiveUri);
    }
    return packages;
  }
  loadBuiltins(): ObiTable {
    const module = new ObiTable();
    module.setDyn("print", new RtPrint());
    module.setDyn("clock", new RtClock());
    module.setDyn("delay", new RtDelay());
    module.setDyn("clear_delay", new RtClearDelay());
    module.setDyn("type", new RtType());
    module.setDyn("keys", new RtKeys());
    module.setDyn("str", new RtStr());
    module.setDyn("strlen", new RtStrlen());
    module.setDyn("strslice", new RtStrslice());
    module.setDyn("parse_float", new RtParseFloat());
    module.setDyn("listen_tcp", new RtListenTcp());
    module.setDyn("readfile", new RtReadfile());
    module.setDyn("readfile_bytes", new RtReadfileBytes());
    module.setDyn("bytes_concat", new RtBytesConcat());
    module.setDyn("process_args", new RtProcessArgs());
    module.setDyn("text_encode", new RtTextEncode());
    module.setDyn("text_decode", new RtTextDecode());
    module.setDyn("len", new RtLen());
    module.setDyn("mod", new RtMod());
    module.setDyn("load_wasm", new RtLoadWasm());
    return module;
  }
}

export class RtClock implements ObiCallable {
  arity(): number {
    return 0;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return Date.now();
  }
}
export class RtRandom implements ObiCallable {
  arity(): number {
    return 0;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return Math.random();
  }
}
export class RtTextEncode implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const bytes = (new TextEncoder()).encode(args[0]);
    return bytes;
  }
}
export class RtTextDecode implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    if (!(args[0] instanceof Uint8Array)) {
      throw new RuntimeError(
        {} as Token,
        `text_decode called on "${typeof args[0]}"`,
      );
    }
    return (new TextDecoder()).decode(args[0]);
  }
}
export class RtBytesConcat implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const a = args[0];
    const b = args[1];
    if (!(a instanceof Uint8Array && b instanceof Uint8Array)) {
      throw new RuntimeError(
        new Token(TT.IDENTIFIER, "bytes_concat", null, 0, 0),
        "Expect both arguments to be byte arrays.",
      );
    }
    const result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
  }
}
export class RtParseFloat implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const v = Number.parseFloat(args[0]);
    if (isNaN(v)) return null;
    return v;
  }
}
export class WasmFunction implements ObiCallable {
  func: CallableFunction;
  constructor(func: CallableFunction) {
    this.func = func;
  }
  arity(): number {
    return this.func.length;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return (this.func as any).apply(null, args);
  }
}

export class RtArrayMake implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return new Uint8Array(args[0]);
  }
}

export class RtAtob implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return atob(args[0]);
  }
}
export class RtBtoa implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return btoa(args[0]);
  }
}

export class RtStrcharcode implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return args[0].charCodeAt(args[1]);
  }
}

export class RtLoadWasm implements ObiCallable {
  arity(): number {
    return 2;
  }
  parseImport(table: ObiTable, interpreter: Interpreter): WebAssembly.Imports {
    const importObj = {
      env: <{ [key: string]: any }> {},
    };
    const env = table.getDyn("env");
    if (null !== env && env instanceof ObiTable) {
      const fields: Map<string, any> = (env as ObiTable).getFields();
      const keys = fields.keys();
      for (const key of keys) {
        const value = fields.get(key);
        if (value instanceof ObiFunction) {
          const fun = value as ObiFunction;
          importObj.env[key] = function () {
            const args: any[] = arguments as any;
            return fun.call(interpreter, args);
          };
        }
      }
    }
    return importObj;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const wasmCode = args[0] as Uint8Array;
    const importObj = args[1] as ObiTable;
    const wasmModule = new WebAssembly.Module(wasmCode);
    const wasmImportObj = this.parseImport(importObj, interpreter);
    const wasmInstance = new WebAssembly.Instance(wasmModule, wasmImportObj);
    const obiWasmInstance = new ObiTable();
    const keys = Object.keys(wasmInstance.exports);
    for (const key of keys) {
      if (key === "memory") {
        const memory = wasmInstance.exports[key] as WebAssembly.Memory;
        const view = new Uint8Array(memory.buffer);
        obiWasmInstance.setDyn(
          key,
          view,
        );
      } else {
        const func = wasmInstance.exports[key] as CallableFunction;
        obiWasmInstance.setDyn(
          key,
          new WasmFunction(func),
        );
      }
    }
    return obiWasmInstance;
  }
}

export class RtFdOpen implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const path = args[0];
    const opts = args[1];
    const read = !!(opts & 0x0001);
    const write = !!(opts & 0x0002);
    const append = !!(opts & 0x0004);
    const create = !!(opts & 0x0008);
    const truncate = !!(opts & 0x0010);
    const file = Deno.openSync(path, { read, write, append, create, truncate });
    return file.rid;
  }
}
export class RtFdClose implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const rid = args[0];
    return Deno.close(rid);
  }
}
export class RtFdSeek implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const rid = args[0];
    const offset = args[1];
    return Deno.seekSync(rid, offset, Deno.SeekMode.Start);
  }
}
export class RtFdRead implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const rid = args[0];
    const buffer = args[1];
    return Deno.readSync(rid, buffer);
  }
}
export class RtFdWrite implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const rid = args[0];
    const data = args[1];
    return Deno.writeSync(rid, data);
  }
}
export class RtFdFdatasync implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const rid = args[0];
    return Deno.fdatasyncSync(rid);
  }
}
export class RtFdSize implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const rid = args[0];
    return Deno.fstatSync(rid).size;
  }
}
export class RtFileExists implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const path = args[0];
    try {
      Deno.statSync(path);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return 0;
      }
    }
    return 1;
  }
}
export class RtProcessExit implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const code = args[0];
    Deno.exit(code);
  }
}

function toJson(table: ObiTable): object {
  const result: { [key: string]: any } = {};
  for (const k of table.getFields().keys()) {
    const v = table.getFields().get(k);
    if (v instanceof ObiTable) {
      result[k] = toJson(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// function toTable(json: any): ObiTable {
//   const result = new ObiTable();
//   if ()
//   for (const k of Object.keys(json)) {
//     const v = json[k];
//     if (Array.isArray(v)) {
//       let i = 0;
//       for (const e of v) {
//         result.setDyn(i++, e);
//       }
//     }
//     if (typeof v === "object") {

//     }
//   }
// }

function parseHeaders(headers: Headers): ObiTable {
  const result = new ObiTable();
  for (const pair of headers.entries()) {
    result.setDyn(pair[0], pair[1]);
  }
  return result;
}

export class RtFetch implements ObiCallable {
  arity(): number {
    return 4;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const url = args[0];
    const method = args[1];
    let body: object | null;
    if (method === "GET") {
      body = null;
    } else {
      body = toJson(args[2]);
    }
    const callback = args[3];
    interpreter.waitGroup.add(1);
    (async () => {
      const res: Response = await fetch(url, {
        method,
        body: body && JSON.stringify(body),
      });
      const info = new ObiTable();
      info.setDyn("headers", parseHeaders(res.headers));
      info.setDyn("redirected", !!res.redirected);
      info.setDyn("url", res.url.toString());
      info.setDyn("status", res.status);

      const data = new Uint8Array(await res.arrayBuffer());
      interpreter.waitGroup.done();
      callback.call(interpreter, [data, info]);
    })();
  }
}
function toArray(table: ObiTable): string[] {
  const result = [];
  const tableLen = table.getFields().size;
  for (let i = 0; i < tableLen; i++) {
    const key = i as unknown;
    result.push(table.getFields().get(key as string) as string);
  }
  return result;
}
export class RtProcessRun implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    interpreter.waitGroup.add(1);
    const p = Deno.run({
      cmd: toArray(args[0]),
      stdout: "piped",
      stderr: "piped",
    });
    const callback = args[1];
    (async () => {
      const output = await p.output();
      const stderrOutput = await p.stderrOutput();
      const result = new ObiTable();
      result.setDyn("output", output);
      result.setDyn("stderrOutput", stderrOutput);
      callback.call(interpreter, [result]);
      interpreter.waitGroup.done();
    })();
  }
}
export class RtProcessEnv implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return Deno.env.get(args[0]);
  }
}
export class RtEnsureDir implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    return ensureDirSync(args[0]);
  }
}
export class RtListSort implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    if (args[0] instanceof ObiTable) {
      const table = args[0] as ObiTable;
      const values = new Array(table.getFields().size);
      let i = 0;
      for (const value of table.getFields().values()) {
        values[i] = value;
        i += 1;
      }
      const sorted = values.sort();
      const result = new ObiTable();
      i = 0;
      for (let i = 0; i < sorted.length; i++) {
        result.setDyn(i, sorted[i]);
      }
      return result;
    }
  }
}
