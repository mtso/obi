import {
  Bytes,
  Interpreter,
  ObiCallable,
  ObiClass,
  ObiFunction,
  ObiInstance,
  RuntimeError,
  Token,
  TT,
} from "./obi.ts";

import * as path from "https://deno.land/std@0.103.0/path/mod.ts";

export class Print implements ObiCallable {
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
    if (e instanceof ObiInstance) {
      return e.toString().split(" instance")[0];
    } else if (e instanceof ObiFunction) {
      return "function";
    } else {
      return (typeof e);
    }
  }
}

export class RtKeys implements ObiCallable {
  obiArrayClass: ObiClass;
  constructor() {
    this.obiArrayClass = new ObiClass(
      "ObiArray",
      null,
      new Map<string, ObiFunction>(),
    );
  }
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const o = args[0] as ObiInstance;
    const fields = o.getFields();
    const array = new ObiInstance(this.obiArrayClass);
    let i = 0;
    for (const key of fields.keys()) {
      array.setDyn(
        i,
        key,
        new Token(TT.NUMBER, JSON.stringify(i), i, 0, 0),
      );
      i += 1;
    }
    array.setDyn("len", i, new Token(TT.IDENTIFIER, "len", null, 0, 0));
    return array;
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

      const connectionClass = new ObiClass(
        "Connection",
        null,
        new Map<string, ObiFunction>(),
      );

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
            const data = args[0] as Bytes;
            try {
              conn.write(data.bytes);
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
                receiver.call(interpreter, [new Bytes(bytes)]);
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

        const connectionInstance = new ObiInstance(connectionClass);
        connectionInstance.set(
          new Token(TT.IDENTIFIER, "write_string", null, 0, 0),
          new WriteString(),
        );
        connectionInstance.set(
          new Token(TT.IDENTIFIER, "on_data", null, 0, 0),
          new OnData(),
        );
        connectionInstance.set(
          new Token(TT.IDENTIFIER, "close", null, 0, 0),
          new Close(),
        );
        connectionInstance.set(
          new Token(TT.IDENTIFIER, "write", null, 0, 0),
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
    if (args[0] instanceof Bytes) {
      return (args[0] as Bytes).bytes.length;
    }
    if ("length" in thing) {
      return thing.length;
    }
    throw new RuntimeError({} as Token, "Invalid arg to len");
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
      return new Bytes(contents);
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
    const containerClass = new ObiClass(
      "RtArgContainer",
      null,
      new Map<string, ObiFunction>(),
    );
    const container = new ObiInstance(containerClass);
    for (let i = 0; i < runtimeArgs.length; i++) {
      container.setDyn(
        i,
        runtimeArgs[i],
        new Token(TT.NUMBER, "" + i, i, 0, 0),
      );
    }
    container.set(
      new Token(TT.STRING, "count", "count", 0, 0),
      runtimeArgs.length,
    );
    return container;
  }
}
export class RtMod implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const location = path.join(path.dirname(interpreter.entryFile), args[0]);
    const source = Deno.readTextFileSync(location);
    const module = interpreter.loadModule(source);
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
export class RtTextEncode implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const bytes = (new TextEncoder()).encode(args[0]);
    return new Bytes(bytes);
  }
}
export class RtTextDecode implements ObiCallable {
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    if (!(args[0] instanceof Bytes)) {
      throw new RuntimeError(
        {} as Token,
        `text_decode called on "${typeof args[0]}"`,
      );
    }
    return (new TextDecoder()).decode(args[0].bytes);
  }
}
export class RtBytesConcat implements ObiCallable {
  arity(): number {
    return 2;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const a = args[0];
    const b = args[1];
    if (!(a instanceof Bytes && b instanceof Bytes)) {
      throw new RuntimeError(
        new Token(TT.IDENTIFIER, "bytes_concat", null, 0, 0),
        "Expect both arguments to be Bytes",
      );
    }
    const result = new Uint8Array(a.bytes.length + b.bytes.length);
    for (let i = 0; i < a.bytes.length; i++) {
      result[i] = a.bytes[i];
    }
    for (let j = 0; j < b.bytes.length; j++) {
      result[a.bytes.length + j] = b.bytes[j];
    }
    return new Bytes(result);
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

export class RtLoadWasm implements ObiCallable {
  wasmClass: ObiClass;
  constructor() {
    this.wasmClass = new ObiClass(
      "WasmInstance",
      null,
      new Map<string, ObiFunction>(),
    );
  }
  arity(): number {
    return 1;
  }
  call(interpreter: Interpreter, args: any[]): any {
    const wasmCode = args[0] as Bytes;
    const wasmModule = new WebAssembly.Module(wasmCode.bytes);
    const wasmInstance = new WebAssembly.Instance(wasmModule);
    const obiWasmInstance = new ObiInstance(this.wasmClass);
    const keys = Object.keys(wasmInstance.exports);
    for (const key of keys) {
      if (key === "memory") {
        const memory = wasmInstance.exports[key] as WebAssembly.Memory;
        const view = new Bytes(new Uint8Array(memory.buffer));
        obiWasmInstance.setDyn(
          key,
          view,
          new Token(TT.IDENTIFIER, key, null, 0, 0),
        );
      } else {
        const func = wasmInstance.exports[key] as CallableFunction;
        obiWasmInstance.setDyn(
          key,
          new WasmFunction(func),
          new Token(TT.IDENTIFIER, key, null, 0, 0),
        );
      }
    }
    return obiWasmInstance;
  }
}
