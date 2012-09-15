# insert-stream

Output stream for DOM insertion

## Example

```
var elem = document.body
    , insert = require("insert-stream")
    , from = require("lazy-map-stream")

// insert them into elem with elem.insertBefore(data, null)
createInputNodes().pipe(
    insert(elem, null))

// Append them onto the elem
// meaning they will be the last child node of elem
createInputNodes().pipe(
    insert.append(elem))

// Prepend nodes onto the elem. 
// meaning they will be the first child node of elem
createInputNodes().pipe(
    insert.prepend(elem))

// Insert them before the elem
createInputNodes().pipe(
    insert.before(elem))

// Insert them after the elem
createInputNodes().pipe(
    insert.after(elem))

function createInputNodes() {
    var texts = ["one", "two", "three"]
        , nodes = texts.map(createItemContainer)

    return from(nodes)
}

function createItemContainer(text) {
    var div = document.createElement("div")
    div.textContent = text
    return div
}
```

## Installation

`npm install insert-stream`

## Contributors

 - Raynos

## MIT Licenced