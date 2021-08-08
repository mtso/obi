language features:

- trailing lambdas / func calls
- match expressions

- string parsing?
- concurrent/asynchrony syntax?
- error handling?
- module loading?
- ffi?
- comments included as part of ast?
- ast formatter?

- weirdnesses: resolve inconsistency in `:=` var dec with class property define/assign


```
http := load("http")

server := http.new()

server.get("/how")

PORT := Obi.env.get("PORT")
URL := "https://jsonplaceholder.typicode.com/todos/1"

server.on_accept { |req, resp|

  result := <~http.fetch(URL, {
    method: "GET",
  })
  json := <~result.json()
  resp.write(json)
}

~server.listen(PORT)
```

toy programs

- min spanning tree
- garden backend
- backend for emoji code (for zoo haus)

app.post("/collections/:name/:id", (req, res) => { const name = req.params.name;
const id = req.params.id; const doc = client.query(name, { _id: id }) });

app.get("/collections/:name", (req, res) => { const name = req.params.name;
const query = req.query; const results = client.query(name, query);
res.json(results); });

// emojicode.obi

server.get("/verify", (req, res) => { db.collection("emoji").find(#{ code:
req.params.code }) })

#{ }

how { () } type(v) : "function" | "string" | "number" | "compound"

#{ key1: value1 } | "matrix" |

match value v => (v) -> what

if (v) then do what

values 1 -> 1 2.0 -> 2.0 'a' -> 'a' asdf? -> id(asdf?) #{ foo: "bar" } -> JSON
[1, 2] -> tuple? / list?

map asdf {

}

http := load("http")

server := http.new()

server.get("/how")

URL = "https://jsonplaceholder.typicode.com/todos/1"

server.on_accept { |req, resp| fetch := ~http.fetch(URL, { method: "GET", })
result := <-fetch <~result.json()

result := <~http.fetch(URL, { method: "GET", }) json := <~result.json()
resp.write(json) }

match 5 ( 5 -> print("is 5"); 4 -> print("is 4"); );

5 :: ( 5 -> print("is 5"); 4 -> print("is 4"); );

match (a, b) ( 5, 3 -> )

Match expr | discriminants | patterns

Pattern expression a -> b

myBANF matchExpr : "match" expr+ "(" caseExpr+ ")" caseExpr : pattern "->"
statement pattern : literal

if (this.match(TT.MATCH)) { this.matchExpression(); } matchExpression(): Expr {
if () }

given x when y then z match 5 ( )

match fetch("/api") (

)

5 match ()

fetch("/api") match ( 5 -> )

match getN() { 5 -> } >

trailing(match 5 { 5 -> wot, _ -> other }, somethingElse) { what to do?? }

a := 5 match ( )

a == 5 match ( )

a := 5 == 4;

a == 5 match ( 5 -> print("5"); )

match 5 ( )

# edge cases with trailer and classes

foo.(bar)() {

}

foo.(Iter)() {

}

foo.iter() fun(item) { getStuff }

type Foo { init() {

} }

foo = Foo(a, b); foo.(b)() { what }

html() { what }

// html {

}

// trailer on method foo.html {

}

// chained GETs foo.route("/").handler("GET") {

}

html() { head() { link(1, 2); }; };

// trailing on init Foo() {

}

class Table { fields: Map<string, any>; methods: Map<string, any>; } fun Foo(a,
b) { _a := a; [ get a = fun() { _a; }, set a = fun(val) { _a = val; }, printA =
fun () { print(a); } ]; }

foo.printA(); foo.a = 5;

fun makeFoo() { kin Foo { print() { print("a"); } } Foo(); }





event loop
await



Promise(fun (resolve, reject) {
  
}).then(fun(result) {
  
});

class RtDelay extends Callable {
  arity(): number {
    return 1;
  }

  call(interpreter: Interpreter, args: any[]): any {
    const func = args[0] as ObiFunction; // expr.Function;
    // console.log(func);
    const by = args[1] as number;
    // const callee = new ObiFunction(func, interpreter.environment, false);

    const op = new Delayed(func, [], Date.now() + by * 1000);
    interpreter.queue.push(op);
    return null;
  }
}


delay(fun() {
  
}, 2);

delay(fun() {
  print("bye");
}, 2);
print("hi");
sleep(4);
print("what");
