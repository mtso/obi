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
