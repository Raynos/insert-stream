var to = require("write-stream")

insert.append = append
insert.prepend = prepend
insert.before = before
insert.after = after

module.exports = insert

function insert(parent, reference) {
    if (typeof reference === "function") {
        return to(insertFunc)
    } else {
        return to(insertNode)
    }

    function insertFunc(elem) {
        parent.insertBefore(elem, reference(parent))
    }

    function insertNode(elem) {
        parent.insertBefore(elem, reference)
    }
}

function append(parent) {
    return insert(parent, null)
}

function prepend(parent) {
    return insert(parent, firstChild)

    function firstChild(parent) {
        return parent.firstChild
    }
}

function before(node) {
    return insert(node.parentNode, node)
}

function after(node) {
    return insert(node.parentNode, nextChild)

    function nextChild() {
        return node.nextSibling
    }
}