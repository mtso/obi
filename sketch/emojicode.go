http := load("./http")

app := http.new()

app.addRoute(.GET, "/check", fun(req, res) {
  res.send
})
