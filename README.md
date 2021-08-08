# Obi

Obi is an experimental programming language.

Some of the things it currently implements:
- classes and dynamic property access
- trailing lambdas

## A Taste of Obi

```
class Markup {
    init() {
        this.buf = "";
    }

    text(string) {
        this.buf = this.buf + "<text>" + string + "</text>";
    }

    body(children) {
        this.buf = this.buf + "<body>";
        children();
        this.buf = this.buf + "</body>";
    }

    head(children) {
        this.buf = this.buf + "<head>";
        children();
        this.buf = this.buf + "</head>";
    }

    getMarkup() {
        return this.buf;
    }
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

print(m.getMarkup());
// expect: "<head><body><text>hi</text><text>bye</text></body></head>"
```

See the `tests/` folder for more examples.
