var insert = require("../index")
    , from = require("read-stream")
    , body = document.body

createInputNodes().pipe(
    insert(createContainer("insert"), null))

createInputNodes().pipe(
    insert.append(createContainer("append")))

createInputNodes().pipe(
    insert.prepend(createContainer("prepend")))

createInputNodes().pipe(
    insert.before(createContainer("before")))

createInputNodes().pipe(
    insert.after(createContainer("after")))

function createInputNodes() {
    var texts = ["one", "two", "three"]
        , nodes = texts.map(createItemContainer)

    return from(nodes)
}

function createContainer(name) {
    var container = document.createElement("div")

    container.appendChild(createTextContainer(name))
    body.appendChild(container)
    var list = document.createElement("ul")
    container.appendChild(list)
    return list
}

function createItemContainer(text) {
    var li = document.createElement("li")
    li.textContent = text
    return li
}

function createTextContainer(text) {
    var div = document.createElement("div")
    div.textContent = text
    return div
}