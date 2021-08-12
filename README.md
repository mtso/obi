# 🎗 Obi

Obi is an experimental programming language.

Some of the things it currently implements:

- trailing lambdas
- match expressions for control flow
- classes and dynamic property access

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/mtso/obi/main/install.sh | sh
```

### Usage

```sh
obi [path to obi file]
```

## A Taste of Obi

```
fun Markup() {
    _buf := "";
    return [
        head = fun(children) {
            _buf = _buf + "<head>";
            children();
            _buf = _buf + "</head>";
        },
        body = fun(children) {
            _buf = _buf + "<body>";
            children();
            _buf = _buf + "</body>";
        },
        text = fun(string) {
            _buf = _buf + "<text>" + string + "</text>";
        },
        render = fun() {
            return _buf;
        },
    ];
}

m := Markup();
head := m.head;
body := m.body;
text := m.text;

head() {
    body() {
        text("hi");
        text("bye");
    };
};

print(m.render());
// expect: "<head><body><text>hi</text><text>bye</text></body></head>"
```

See the `tests/` folder for more examples.
