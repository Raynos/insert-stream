(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    
    require.define = function (filename, fn) {
        if (require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",Function(['require','module','exports','__dirname','__filename','process'],"function filter (xs, fn) {\n    var res = [];\n    for (var i = 0; i < xs.length; i++) {\n        if (fn(xs[i], i, xs)) res.push(xs[i]);\n    }\n    return res;\n}\n\n// resolves . and .. elements in a path array with directory names there\n// must be no slashes, empty elements, or device names (c:\\) in the array\n// (so also no leading and trailing slashes - it does not distinguish\n// relative and absolute paths)\nfunction normalizeArray(parts, allowAboveRoot) {\n  // if the path tries to go above the root, `up` ends up > 0\n  var up = 0;\n  for (var i = parts.length; i >= 0; i--) {\n    var last = parts[i];\n    if (last == '.') {\n      parts.splice(i, 1);\n    } else if (last === '..') {\n      parts.splice(i, 1);\n      up++;\n    } else if (up) {\n      parts.splice(i, 1);\n      up--;\n    }\n  }\n\n  // if the path is allowed to go above the root, restore leading ..s\n  if (allowAboveRoot) {\n    for (; up--; up) {\n      parts.unshift('..');\n    }\n  }\n\n  return parts;\n}\n\n// Regex to split a filename into [*, dir, basename, ext]\n// posix version\nvar splitPathRe = /^(.+\\/(?!$)|\\/)?((?:.+?)?(\\.[^.]*)?)$/;\n\n// path.resolve([from ...], to)\n// posix version\nexports.resolve = function() {\nvar resolvedPath = '',\n    resolvedAbsolute = false;\n\nfor (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {\n  var path = (i >= 0)\n      ? arguments[i]\n      : process.cwd();\n\n  // Skip empty and invalid entries\n  if (typeof path !== 'string' || !path) {\n    continue;\n  }\n\n  resolvedPath = path + '/' + resolvedPath;\n  resolvedAbsolute = path.charAt(0) === '/';\n}\n\n// At this point the path should be resolved to a full absolute path, but\n// handle relative paths to be safe (might happen when process.cwd() fails)\n\n// Normalize the path\nresolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {\n    return !!p;\n  }), !resolvedAbsolute).join('/');\n\n  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';\n};\n\n// path.normalize(path)\n// posix version\nexports.normalize = function(path) {\nvar isAbsolute = path.charAt(0) === '/',\n    trailingSlash = path.slice(-1) === '/';\n\n// Normalize the path\npath = normalizeArray(filter(path.split('/'), function(p) {\n    return !!p;\n  }), !isAbsolute).join('/');\n\n  if (!path && !isAbsolute) {\n    path = '.';\n  }\n  if (path && trailingSlash) {\n    path += '/';\n  }\n  \n  return (isAbsolute ? '/' : '') + path;\n};\n\n\n// posix version\nexports.join = function() {\n  var paths = Array.prototype.slice.call(arguments, 0);\n  return exports.normalize(filter(paths, function(p, index) {\n    return p && typeof p === 'string';\n  }).join('/'));\n};\n\n\nexports.dirname = function(path) {\n  var dir = splitPathRe.exec(path)[1] || '';\n  var isWindows = false;\n  if (!dir) {\n    // No dirname\n    return '.';\n  } else if (dir.length === 1 ||\n      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {\n    // It is just a slash or a drive letter with a slash\n    return dir;\n  } else {\n    // It is a full dirname, strip trailing slash\n    return dir.substring(0, dir.length - 1);\n  }\n};\n\n\nexports.basename = function(path, ext) {\n  var f = splitPathRe.exec(path)[2] || '';\n  // TODO: make this comparison case-insensitive on windows?\n  if (ext && f.substr(-1 * ext.length) === ext) {\n    f = f.substr(0, f.length - ext.length);\n  }\n  return f;\n};\n\n\nexports.extname = function(path) {\n  return splitPathRe.exec(path)[3] || '';\n};\n\n//@ sourceURL=path"));

require.define("__browserify_process",Function(['require','module','exports','__dirname','__filename','process'],"var process = module.exports = {};\n\nprocess.nextTick = (function () {\n    var queue = [];\n    var canPost = typeof window !== 'undefined'\n        && window.postMessage && window.addEventListener\n    ;\n    \n    if (canPost) {\n        window.addEventListener('message', function (ev) {\n            if (ev.source === window && ev.data === 'browserify-tick') {\n                ev.stopPropagation();\n                if (queue.length > 0) {\n                    var fn = queue.shift();\n                    fn();\n                }\n            }\n        }, true);\n    }\n    \n    return function (fn) {\n        if (canPost) {\n            queue.push(fn);\n            window.postMessage('browserify-tick', '*');\n        }\n        else setTimeout(fn, 0);\n    };\n})();\n\nprocess.title = 'browser';\nprocess.browser = true;\nprocess.env = {};\nprocess.argv = [];\n\nprocess.binding = function (name) {\n    if (name === 'evals') return (require)('vm')\n    else throw new Error('No such module. (Possibly not yet loaded)')\n};\n\n(function () {\n    var cwd = '/';\n    var path;\n    process.cwd = function () { return cwd };\n    process.chdir = function (dir) {\n        if (!path) path = require('path');\n        cwd = path.resolve(dir, cwd);\n    };\n})();\n//@ sourceURL=__browserify_process"));

require.define("vm",Function(['require','module','exports','__dirname','__filename','process'],"module.exports = require(\"vm-browserify\")\n//@ sourceURL=vm"));

require.define("/node_modules/vm-browserify/package.json",Function(['require','module','exports','__dirname','__filename','process'],"module.exports = {\"main\":\"index.js\"}\n//@ sourceURL=/node_modules/vm-browserify/package.json"));

require.define("/node_modules/vm-browserify/index.js",Function(['require','module','exports','__dirname','__filename','process'],"var Object_keys = function (obj) {\n    if (Object.keys) return Object.keys(obj)\n    else {\n        var res = [];\n        for (var key in obj) res.push(key)\n        return res;\n    }\n};\n\nvar forEach = function (xs, fn) {\n    if (xs.forEach) return xs.forEach(fn)\n    else for (var i = 0; i < xs.length; i++) {\n        fn(xs[i], i, xs);\n    }\n};\n\nvar Script = exports.Script = function NodeScript (code) {\n    if (!(this instanceof Script)) return new Script(code);\n    this.code = code;\n};\n\nScript.prototype.runInNewContext = function (context) {\n    if (!context) context = {};\n    \n    var iframe = document.createElement('iframe');\n    if (!iframe.style) iframe.style = {};\n    iframe.style.display = 'none';\n    \n    document.body.appendChild(iframe);\n    \n    var win = iframe.contentWindow;\n    \n    forEach(Object_keys(context), function (key) {\n        win[key] = context[key];\n    });\n     \n    if (!win.eval && win.execScript) {\n        // win.eval() magically appears when this is called in IE:\n        win.execScript('null');\n    }\n    \n    var res = win.eval(this.code);\n    \n    forEach(Object_keys(win), function (key) {\n        context[key] = win[key];\n    });\n    \n    document.body.removeChild(iframe);\n    \n    return res;\n};\n\nScript.prototype.runInThisContext = function () {\n    return eval(this.code); // maybe...\n};\n\nScript.prototype.runInContext = function (context) {\n    // seems to be just runInNewContext on magical context objects which are\n    // otherwise indistinguishable from objects except plain old objects\n    // for the parameter segfaults node\n    return this.runInNewContext(context);\n};\n\nforEach(Object_keys(Script.prototype), function (name) {\n    exports[name] = Script[name] = function (code) {\n        var s = Script(code);\n        return s[name].apply(s, [].slice.call(arguments, 1));\n    };\n});\n\nexports.createScript = function (code) {\n    return exports.Script(code);\n};\n\nexports.createContext = Script.createContext = function (context) {\n    // not really sure what this one does\n    // seems to just make a shallow copy\n    var copy = {};\n    if(typeof context === 'object') {\n        forEach(Object_keys(context), function (key) {\n            copy[key] = context[key];\n        });\n    }\n    return copy;\n};\n\n//@ sourceURL=/node_modules/vm-browserify/index.js"));

require.define("/package.json",Function(['require','module','exports','__dirname','__filename','process'],"module.exports = {\"main\":\"index\"}\n//@ sourceURL=/package.json"));

require.define("/index.js",Function(['require','module','exports','__dirname','__filename','process'],"var to = require(\"write-stream\")\n\ninsert.append = append\ninsert.prepend = prepend\ninsert.before = before\ninsert.after = after\n\nmodule.exports = insert\n\nfunction insert(parent, reference) {\n    if (typeof reference === \"function\") {\n        return to(insertFunc)\n    } else {\n        return to(insertNode)\n    }\n\n    function insertFunc(elem) {\n        parent.insertBefore(elem, reference(parent))\n    }\n\n    function insertNode(elem) {\n        parent.insertBefore(elem, reference)\n    }\n}\n\nfunction append(parent) {\n    return insert(parent, null)\n}\n\nfunction prepend(parent) {\n    return insert(parent, firstChild)\n\n    function firstChild(parent) {\n        return parent.firstChild\n    }\n}\n\nfunction before(node) {\n    return insert(node.parentNode, node)\n}\n\nfunction after(node) {\n    return insert(node.parentNode, nextChild)\n\n    function nextChild() {\n        return node.nextSibling\n    }\n}\n//@ sourceURL=/index.js"));

require.define("/node_modules/write-stream/package.json",Function(['require','module','exports','__dirname','__filename','process'],"module.exports = {\"main\":\"index\"}\n//@ sourceURL=/node_modules/write-stream/package.json"));

require.define("/node_modules/write-stream/index.js",Function(['require','module','exports','__dirname','__filename','process'],"\"use strict\";\n\nvar Stream = require(\"stream\")\n\nto.end = defaultEnd\n\nmodule.exports = to\n\nfunction to(write, end) {\n    if (Array.isArray(write)) {\n        return to(writeArray, endArray)\n    }\n\n    var stream = new Stream()\n        , ended = false\n\n    end = end || defaultEnd\n\n    stream.readable = false\n    stream.writable = true\n\n    stream.write = handleWrite\n    stream.end = handleEnd\n\n    return stream\n\n    function writeArray(chunk) {\n        write.push(chunk)\n    }\n\n    function endArray() {\n        end.call(this)\n        this.emit(\"end\")\n    }\n\n    function handleWrite(chunk) {\n        var result = write.call(stream, chunk)\n        return result === false ? false : true\n    }\n\n    function handleEnd(chunk) {\n        if (ended) {\n            return\n        }\n        ended = true\n        if (arguments.length) {\n            stream.write(chunk)\n        }\n        this.writable = false\n        end.call(stream)\n    }\n}\n\nfunction defaultEnd() {\n    this.emit(\"end\")\n}\n//@ sourceURL=/node_modules/write-stream/index.js"));

require.define("stream",Function(['require','module','exports','__dirname','__filename','process'],"var events = require('events');\nvar util = require('util');\n\nfunction Stream() {\n  events.EventEmitter.call(this);\n}\nutil.inherits(Stream, events.EventEmitter);\nmodule.exports = Stream;\n// Backwards-compat with node 0.4.x\nStream.Stream = Stream;\n\nStream.prototype.pipe = function(dest, options) {\n  var source = this;\n\n  function ondata(chunk) {\n    if (dest.writable) {\n      if (false === dest.write(chunk) && source.pause) {\n        source.pause();\n      }\n    }\n  }\n\n  source.on('data', ondata);\n\n  function ondrain() {\n    if (source.readable && source.resume) {\n      source.resume();\n    }\n  }\n\n  dest.on('drain', ondrain);\n\n  // If the 'end' option is not supplied, dest.end() will be called when\n  // source gets the 'end' or 'close' events.  Only dest.end() once, and\n  // only when all sources have ended.\n  if (!dest._isStdio && (!options || options.end !== false)) {\n    dest._pipeCount = dest._pipeCount || 0;\n    dest._pipeCount++;\n\n    source.on('end', onend);\n    source.on('close', onclose);\n  }\n\n  var didOnEnd = false;\n  function onend() {\n    if (didOnEnd) return;\n    didOnEnd = true;\n\n    dest._pipeCount--;\n\n    // remove the listeners\n    cleanup();\n\n    if (dest._pipeCount > 0) {\n      // waiting for other incoming streams to end.\n      return;\n    }\n\n    dest.end();\n  }\n\n\n  function onclose() {\n    if (didOnEnd) return;\n    didOnEnd = true;\n\n    dest._pipeCount--;\n\n    // remove the listeners\n    cleanup();\n\n    if (dest._pipeCount > 0) {\n      // waiting for other incoming streams to end.\n      return;\n    }\n\n    dest.destroy();\n  }\n\n  // don't leave dangling pipes when there are errors.\n  function onerror(er) {\n    cleanup();\n    if (this.listeners('error').length === 0) {\n      throw er; // Unhandled stream error in pipe.\n    }\n  }\n\n  source.on('error', onerror);\n  dest.on('error', onerror);\n\n  // remove all the event listeners that were added.\n  function cleanup() {\n    source.removeListener('data', ondata);\n    dest.removeListener('drain', ondrain);\n\n    source.removeListener('end', onend);\n    source.removeListener('close', onclose);\n\n    source.removeListener('error', onerror);\n    dest.removeListener('error', onerror);\n\n    source.removeListener('end', cleanup);\n    source.removeListener('close', cleanup);\n\n    dest.removeListener('end', cleanup);\n    dest.removeListener('close', cleanup);\n  }\n\n  source.on('end', cleanup);\n  source.on('close', cleanup);\n\n  dest.on('end', cleanup);\n  dest.on('close', cleanup);\n\n  dest.emit('pipe', source);\n\n  // Allow for unix-like usage: A.pipe(B).pipe(C)\n  return dest;\n};\n\n//@ sourceURL=stream"));

require.define("events",Function(['require','module','exports','__dirname','__filename','process'],"if (!process.EventEmitter) process.EventEmitter = function () {};\n\nvar EventEmitter = exports.EventEmitter = process.EventEmitter;\nvar isArray = typeof Array.isArray === 'function'\n    ? Array.isArray\n    : function (xs) {\n        return Object.prototype.toString.call(xs) === '[object Array]'\n    }\n;\n\n// By default EventEmitters will print a warning if more than\n// 10 listeners are added to it. This is a useful default which\n// helps finding memory leaks.\n//\n// Obviously not all Emitters should be limited to 10. This function allows\n// that to be increased. Set to zero for unlimited.\nvar defaultMaxListeners = 10;\nEventEmitter.prototype.setMaxListeners = function(n) {\n  if (!this._events) this._events = {};\n  this._events.maxListeners = n;\n};\n\n\nEventEmitter.prototype.emit = function(type) {\n  // If there is no 'error' event listener then throw.\n  if (type === 'error') {\n    if (!this._events || !this._events.error ||\n        (isArray(this._events.error) && !this._events.error.length))\n    {\n      if (arguments[1] instanceof Error) {\n        throw arguments[1]; // Unhandled 'error' event\n      } else {\n        throw new Error(\"Uncaught, unspecified 'error' event.\");\n      }\n      return false;\n    }\n  }\n\n  if (!this._events) return false;\n  var handler = this._events[type];\n  if (!handler) return false;\n\n  if (typeof handler == 'function') {\n    switch (arguments.length) {\n      // fast cases\n      case 1:\n        handler.call(this);\n        break;\n      case 2:\n        handler.call(this, arguments[1]);\n        break;\n      case 3:\n        handler.call(this, arguments[1], arguments[2]);\n        break;\n      // slower\n      default:\n        var args = Array.prototype.slice.call(arguments, 1);\n        handler.apply(this, args);\n    }\n    return true;\n\n  } else if (isArray(handler)) {\n    var args = Array.prototype.slice.call(arguments, 1);\n\n    var listeners = handler.slice();\n    for (var i = 0, l = listeners.length; i < l; i++) {\n      listeners[i].apply(this, args);\n    }\n    return true;\n\n  } else {\n    return false;\n  }\n};\n\n// EventEmitter is defined in src/node_events.cc\n// EventEmitter.prototype.emit() is also defined there.\nEventEmitter.prototype.addListener = function(type, listener) {\n  if ('function' !== typeof listener) {\n    throw new Error('addListener only takes instances of Function');\n  }\n\n  if (!this._events) this._events = {};\n\n  // To avoid recursion in the case that type == \"newListeners\"! Before\n  // adding it to the listeners, first emit \"newListeners\".\n  this.emit('newListener', type, listener);\n\n  if (!this._events[type]) {\n    // Optimize the case of one listener. Don't need the extra array object.\n    this._events[type] = listener;\n  } else if (isArray(this._events[type])) {\n\n    // Check for listener leak\n    if (!this._events[type].warned) {\n      var m;\n      if (this._events.maxListeners !== undefined) {\n        m = this._events.maxListeners;\n      } else {\n        m = defaultMaxListeners;\n      }\n\n      if (m && m > 0 && this._events[type].length > m) {\n        this._events[type].warned = true;\n        console.error('(node) warning: possible EventEmitter memory ' +\n                      'leak detected. %d listeners added. ' +\n                      'Use emitter.setMaxListeners() to increase limit.',\n                      this._events[type].length);\n        console.trace();\n      }\n    }\n\n    // If we've already got an array, just append.\n    this._events[type].push(listener);\n  } else {\n    // Adding the second element, need to change to array.\n    this._events[type] = [this._events[type], listener];\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.on = EventEmitter.prototype.addListener;\n\nEventEmitter.prototype.once = function(type, listener) {\n  var self = this;\n  self.on(type, function g() {\n    self.removeListener(type, g);\n    listener.apply(this, arguments);\n  });\n\n  return this;\n};\n\nEventEmitter.prototype.removeListener = function(type, listener) {\n  if ('function' !== typeof listener) {\n    throw new Error('removeListener only takes instances of Function');\n  }\n\n  // does not use listeners(), so no side effect of creating _events[type]\n  if (!this._events || !this._events[type]) return this;\n\n  var list = this._events[type];\n\n  if (isArray(list)) {\n    var i = list.indexOf(listener);\n    if (i < 0) return this;\n    list.splice(i, 1);\n    if (list.length == 0)\n      delete this._events[type];\n  } else if (this._events[type] === listener) {\n    delete this._events[type];\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.removeAllListeners = function(type) {\n  // does not use listeners(), so no side effect of creating _events[type]\n  if (type && this._events && this._events[type]) this._events[type] = null;\n  return this;\n};\n\nEventEmitter.prototype.listeners = function(type) {\n  if (!this._events) this._events = {};\n  if (!this._events[type]) this._events[type] = [];\n  if (!isArray(this._events[type])) {\n    this._events[type] = [this._events[type]];\n  }\n  return this._events[type];\n};\n\n//@ sourceURL=events"));

require.define("util",Function(['require','module','exports','__dirname','__filename','process'],"var events = require('events');\n\nexports.print = function () {};\nexports.puts = function () {};\nexports.debug = function() {};\n\nvar formatRegExp = /%[sdj%]/g;\nexports.format = function(f) {\n  if (typeof f !== 'string') {\n    var objects = [];\n    for (var i = 0; i < arguments.length; i++) {\n      objects.push(inspect(arguments[i]));\n    }\n    return objects.join(' ');\n  }\n\n  var i = 1;\n  var args = arguments;\n  var len = args.length;\n  var str = String(f).replace(formatRegExp, function(x) {\n    if (x === '%%') return '%';\n    if (i >= len) return x;\n    switch (x) {\n      case '%s': return String(args[i++]);\n      case '%d': return Number(args[i++]);\n      case '%j': return JSON.stringify(args[i++]);\n      default:\n        return x;\n    }\n  });\n  for (var x = args[i]; i < len; x = args[++i]) {\n    if (x === null || typeof x !== 'object') {\n      str += ' ' + x;\n    } else {\n      str += ' ' + inspect(x);\n    }\n  }\n  return str;\n};\n\n\n/**\n * Echos the value of a value. Trys to print the value out\n * in the best way possible given the different types.\n *\n * @param {Object} obj The object to print out.\n * @param {Boolean} showHidden Flag that shows hidden (not enumerable)\n *    properties of objects.\n * @param {Number} depth Depth in which to descend in object. Default is 2.\n * @param {Boolean} colors Flag to turn on ANSI escape codes to color the\n *    output. Default is false (no coloring).\n */\nfunction inspect(obj, showHidden, depth, colors) {\n  var ctx = {\n    showHidden: showHidden,\n    seen: [],\n    stylize: colors ? stylizeWithColor : stylizeNoColor\n  };\n  return formatValue(ctx, obj, (typeof depth === 'undefined' ? 2 : depth));\n}\nexports.inspect = inspect;\n\n\n// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics\nvar colors = {\n  'bold' : [1, 22],\n  'italic' : [3, 23],\n  'underline' : [4, 24],\n  'inverse' : [7, 27],\n  'white' : [37, 39],\n  'grey' : [90, 39],\n  'black' : [30, 39],\n  'blue' : [34, 39],\n  'cyan' : [36, 39],\n  'green' : [32, 39],\n  'magenta' : [35, 39],\n  'red' : [31, 39],\n  'yellow' : [33, 39]\n};\n\n// Don't use 'blue' not visible on cmd.exe\nvar styles = {\n  'special': 'cyan',\n  'number': 'yellow',\n  'boolean': 'yellow',\n  'undefined': 'grey',\n  'null': 'bold',\n  'string': 'green',\n  'date': 'magenta',\n  // \"name\": intentionally not styling\n  'regexp': 'red'\n};\n\n\nfunction stylizeWithColor(str, styleType) {\n  var style = styles[styleType];\n\n  if (style) {\n    return '\\u001b[' + colors[style][0] + 'm' + str +\n           '\\u001b[' + colors[style][1] + 'm';\n  } else {\n    return str;\n  }\n}\n\n\nfunction stylizeNoColor(str, styleType) {\n  return str;\n}\n\n\nfunction arrayToHash(array) {\n  var hash = {};\n\n  array.forEach(function(val, idx) {\n    hash[val] = true;\n  });\n\n  return hash;\n}\n\n\nfunction formatValue(ctx, value, recurseTimes) {\n  // Provide a hook for user-specified inspect functions.\n  // Check that value is an object with an inspect function on it\n  if (value && typeof value.inspect === 'function' &&\n      // Filter out the util module, it's inspect function is special\n      value.inspect !== exports.inspect &&\n      // Also filter out any prototype objects using the circular check.\n      !(value.constructor && value.constructor.prototype === value)) {\n    return String(value.inspect(recurseTimes));\n  }\n\n  // Primitive types cannot have properties\n  var primitive = formatPrimitive(ctx, value);\n  if (primitive) {\n    return primitive;\n  }\n\n  // Look up the keys of the object.\n  var keys = Object_keys(value);\n  var visibleKeys = arrayToHash(keys);\n\n  if (ctx.showHidden) {\n    keys = Object_getOwnPropertyNames(value);\n  }\n\n  // Some type of object without properties can be shortcutted.\n  if (keys.length === 0) {\n    if (typeof value === 'function') {\n      var name = value.name ? ': ' + value.name : '';\n      return ctx.stylize('[Function' + name + ']', 'special');\n    }\n    if (isRegExp(value)) {\n      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');\n    }\n    if (isDate(value)) {\n      return ctx.stylize(Date.prototype.toString.call(value), 'date');\n    }\n    if (isError(value)) {\n      return formatError(value);\n    }\n  }\n\n  var base = '', array = false, braces = ['{', '}'];\n\n  // Make Array say that they are Array\n  if (isArray(value)) {\n    array = true;\n    braces = ['[', ']'];\n  }\n\n  // Make functions say that they are functions\n  if (typeof value === 'function') {\n    var n = value.name ? ': ' + value.name : '';\n    base = ' [Function' + n + ']';\n  }\n\n  // Make RegExps say that they are RegExps\n  if (isRegExp(value)) {\n    base = ' ' + RegExp.prototype.toString.call(value);\n  }\n\n  // Make dates with properties first say the date\n  if (isDate(value)) {\n    base = ' ' + Date.prototype.toUTCString.call(value);\n  }\n\n  // Make error with message first say the error\n  if (isError(value)) {\n    base = ' ' + formatError(value);\n  }\n\n  if (keys.length === 0 && (!array || value.length == 0)) {\n    return braces[0] + base + braces[1];\n  }\n\n  if (recurseTimes < 0) {\n    if (isRegExp(value)) {\n      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');\n    } else {\n      return ctx.stylize('[Object]', 'special');\n    }\n  }\n\n  ctx.seen.push(value);\n\n  var output;\n  if (array) {\n    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);\n  } else {\n    output = keys.map(function(key) {\n      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);\n    });\n  }\n\n  ctx.seen.pop();\n\n  return reduceToSingleString(output, base, braces);\n}\n\n\nfunction formatPrimitive(ctx, value) {\n  switch (typeof value) {\n    case 'undefined':\n      return ctx.stylize('undefined', 'undefined');\n\n    case 'string':\n      var simple = '\\'' + JSON.stringify(value).replace(/^\"|\"$/g, '')\n                                               .replace(/'/g, \"\\\\'\")\n                                               .replace(/\\\\\"/g, '\"') + '\\'';\n      return ctx.stylize(simple, 'string');\n\n    case 'number':\n      return ctx.stylize('' + value, 'number');\n\n    case 'boolean':\n      return ctx.stylize('' + value, 'boolean');\n  }\n  // For some reason typeof null is \"object\", so special case here.\n  if (value === null) {\n    return ctx.stylize('null', 'null');\n  }\n}\n\n\nfunction formatError(value) {\n  return '[' + Error.prototype.toString.call(value) + ']';\n}\n\n\nfunction formatArray(ctx, value, recurseTimes, visibleKeys, keys) {\n  var output = [];\n  for (var i = 0, l = value.length; i < l; ++i) {\n    if (Object.prototype.hasOwnProperty.call(value, String(i))) {\n      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,\n          String(i), true));\n    } else {\n      output.push('');\n    }\n  }\n  keys.forEach(function(key) {\n    if (!key.match(/^\\d+$/)) {\n      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,\n          key, true));\n    }\n  });\n  return output;\n}\n\n\nfunction formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {\n  var name, str, desc;\n  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };\n  if (desc.get) {\n    if (desc.set) {\n      str = ctx.stylize('[Getter/Setter]', 'special');\n    } else {\n      str = ctx.stylize('[Getter]', 'special');\n    }\n  } else {\n    if (desc.set) {\n      str = ctx.stylize('[Setter]', 'special');\n    }\n  }\n  if (!visibleKeys.hasOwnProperty(key)) {\n    name = '[' + key + ']';\n  }\n  if (!str) {\n    if (ctx.seen.indexOf(desc.value) < 0) {\n      if (recurseTimes === null) {\n        str = formatValue(ctx, desc.value, null);\n      } else {\n        str = formatValue(ctx, desc.value, recurseTimes - 1);\n      }\n      if (str.indexOf('\\n') > -1) {\n        if (array) {\n          str = str.split('\\n').map(function(line) {\n            return '  ' + line;\n          }).join('\\n').substr(2);\n        } else {\n          str = '\\n' + str.split('\\n').map(function(line) {\n            return '   ' + line;\n          }).join('\\n');\n        }\n      }\n    } else {\n      str = ctx.stylize('[Circular]', 'special');\n    }\n  }\n  if (typeof name === 'undefined') {\n    if (array && key.match(/^\\d+$/)) {\n      return str;\n    }\n    name = JSON.stringify('' + key);\n    if (name.match(/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)) {\n      name = name.substr(1, name.length - 2);\n      name = ctx.stylize(name, 'name');\n    } else {\n      name = name.replace(/'/g, \"\\\\'\")\n                 .replace(/\\\\\"/g, '\"')\n                 .replace(/(^\"|\"$)/g, \"'\");\n      name = ctx.stylize(name, 'string');\n    }\n  }\n\n  return name + ': ' + str;\n}\n\n\nfunction reduceToSingleString(output, base, braces) {\n  var numLinesEst = 0;\n  var length = output.reduce(function(prev, cur) {\n    numLinesEst++;\n    if (cur.indexOf('\\n') >= 0) numLinesEst++;\n    return prev + cur.length + 1;\n  }, 0);\n\n  if (length > 60) {\n    return braces[0] +\n           (base === '' ? '' : base + '\\n ') +\n           ' ' +\n           output.join(',\\n  ') +\n           ' ' +\n           braces[1];\n  }\n\n  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];\n}\n\n\nfunction isArray(ar) {\n  return ar instanceof Array ||\n         Array.isArray(ar) ||\n         (ar && ar !== Object.prototype && isArray(ar.__proto__));\n}\n\n\nfunction isRegExp(re) {\n  return re instanceof RegExp ||\n    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');\n}\n\n\nfunction isDate(d) {\n  if (d instanceof Date) return true;\n  if (typeof d !== 'object') return false;\n  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);\n  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);\n  return JSON.stringify(proto) === JSON.stringify(properties);\n}\n\nfunction isError(e) {\n  return typeof e === 'object' && objectToString(e) === '[object Error]';\n}\nexports.isError = isError;\n\nfunction objectToString(o) {\n  return Object.prototype.toString.call(o);\n}\n\n\nfunction pad(n) {\n  return n < 10 ? '0' + n.toString(10) : n.toString(10);\n}\n\nvar months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',\n              'Oct', 'Nov', 'Dec'];\n\n// 26 Feb 16:19:34\nfunction timestamp() {\n  var d = new Date();\n  var time = [pad(d.getHours()),\n              pad(d.getMinutes()),\n              pad(d.getSeconds())].join(':');\n  return [d.getDate(), months[d.getMonth()], time].join(' ');\n}\n\nexports.log = function (msg) {};\n\nexports.pump = null;\n\nvar Object_keys = Object.keys || function (obj) {\n    var res = [];\n    for (var key in obj) res.push(key);\n    return res;\n};\n\nvar Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {\n    var res = [];\n    for (var key in obj) {\n        if (Object.hasOwnProperty.call(obj, key)) res.push(key);\n    }\n    return res;\n};\n\nvar Object_create = Object.create || function (prototype, properties) {\n    // from es5-shim\n    var object;\n    if (prototype === null) {\n        object = { '__proto__' : null };\n    }\n    else {\n        if (typeof prototype !== 'object') {\n            throw new TypeError(\n                'typeof prototype[' + (typeof prototype) + '] != \\'object\\''\n            );\n        }\n        var Type = function () {};\n        Type.prototype = prototype;\n        object = new Type();\n        object.__proto__ = prototype;\n    }\n    if (typeof properties !== 'undefined' && Object.defineProperties) {\n        Object.defineProperties(object, properties);\n    }\n    return object;\n};\n\nexports.inherits = function(ctor, superCtor) {\n  ctor.super_ = superCtor;\n  ctor.prototype = Object_create(superCtor.prototype, {\n    constructor: {\n      value: ctor,\n      enumerable: false,\n      writable: true,\n      configurable: true\n    }\n  });\n};\n\n//@ sourceURL=util"));

require.define("/node_modules/read-stream/package.json",Function(['require','module','exports','__dirname','__filename','process'],"module.exports = {\"main\":\"index\"}\n//@ sourceURL=/node_modules/read-stream/package.json"));

require.define("/node_modules/read-stream/index.js",Function(['require','module','exports','__dirname','__filename','process'],"\"use strict\";\n\nvar Stream = require(\"readable-stream\")\n\nfrom.end = defaultEnd\n\nmodule.exports = from\n\nfunction from(read, end, state) {\n    if (Array.isArray(read)) {\n        return from(readArray)\n    }\n\n    if (typeof end !== \"function\") {\n        state = end\n        end = null\n    }\n\n    var stream = new Stream()\n        , ended = false\n\n    end = end || defaultEnd\n    state = state || []\n\n    stream.readable = true\n    stream.writable = false\n\n    stream.read = handleRead\n    stream.end = handleEnd\n\n    return stream\n\n    function readArray(bytes) {\n        if (read.length) {\n            return read.shift()\n        } else {\n            this.emit(\"end\")\n        }\n    }\n\n    function handleRead(bytes) {\n        if (ended) {\n            return null\n        }\n        var result = read.call(stream, bytes, state)\n\n        return result === undefined ? null : result\n    }\n\n    function handleEnd() {\n        if (ended) {\n            return\n        }\n        ended = true\n        end.call(stream)\n        stream.readable = false\n    }\n}\n\nfunction defaultEnd() {\n    this.emit(\"end\")\n}\n//@ sourceURL=/node_modules/read-stream/index.js"));

require.define("/node_modules/read-stream/node_modules/readable-stream/package.json",Function(['require','module','exports','__dirname','__filename','process'],"module.exports = {\"main\":\"readable.js\"}\n//@ sourceURL=/node_modules/read-stream/node_modules/readable-stream/package.json"));

require.define("/node_modules/read-stream/node_modules/readable-stream/readable.js",Function(['require','module','exports','__dirname','__filename','process'],"\"use strict\";\n\nmodule.exports = Readable;\n\nvar Stream = require('stream');\nvar util = require('util');\n\nutil.inherits(Readable, Stream);\n\nfunction Readable(stream) {\n  if (stream) this.wrap(stream);\n  Stream.apply(this);\n}\n\n// override this method.\nReadable.prototype.read = function(n) {\n  return null;\n};\n\nReadable.prototype.pipe = function(dest, opt) {\n  if (!(opt && opt.end === false || dest === process.stdout ||\n        dest === process.stderr)) {\n    this.on('end', dest.end.bind(dest));\n  }\n\n  dest.emit('pipe', this);\n\n  flow.call(this);\n\n  function flow() {\n    var chunk;\n    while (chunk = this.read()) {\n      var written = dest.write(chunk);\n      if (!written) {\n        dest.once('drain', flow.bind(this));\n        return;\n      }\n    }\n    this.once('readable', flow);\n  }\n};\n\n// kludge for on('data', fn) consumers.  Sad.\n// This is *not* part of the new readable stream interface.\n// It is an ugly unfortunate mess of history.\nReadable.prototype.on = function(ev, fn) {\n  if (ev === 'data') emitDataEvents(this);\n  return Stream.prototype.on.call(this, ev, fn);\n};\nReadable.prototype.addListener = Readable.prototype.on;\n\nfunction emitDataEvents(stream) {\n  var paused = false;\n  var readable = false;\n\n  // convert to an old-style stream.\n  stream.readable = true;\n  stream.pipe = Stream.prototype.pipe;\n  stream.on = stream.addEventListener = Stream.prototype.on;\n\n  stream.on('readable', function() {\n    readable = true;\n    var c;\n    while (!paused && (c = stream.read())) {\n      stream.emit('data', c);\n    }\n    if (c === null) readable = false;\n  });\n\n  stream.pause = function() {\n    paused = true;\n  };\n\n  stream.resume = function() {\n    paused = false;\n    if (readable) stream.emit('readable');\n  };\n}\n\n// wrap an old-style stream\n// This is *not* part of the readable stream interface.\n// It is an ugly unfortunate mess of history.\nReadable.prototype.wrap = function(stream) {\n  this._buffer = [];\n  this._bufferLength = 0;\n  var paused = false;\n  var ended = false;\n\n  stream.on('end', function() {\n    ended = true;\n    if (this._bufferLength === 0) {\n      this.emit('end');\n    }\n  }.bind(this));\n\n  stream.on('data', function(chunk) {\n    this._buffer.push(chunk);\n    this._bufferLength += chunk.length;\n    this.emit('readable');\n    // if not consumed, then pause the stream.\n    if (this._bufferLength > 0 && !paused) {\n      paused = true;\n      stream.pause();\n    }\n  }.bind(this));\n\n  // proxy all the other methods.\n  // important when wrapping filters and duplexes.\n  for (var i in stream) {\n    if (typeof stream[i] === 'function' &&\n        typeof this[i] === 'undefined') {\n      this[i] = function(method) { return function() {\n        return stream[method].apply(stream, arguments);\n      }}(i);\n    }\n  }\n\n  // proxy certain important events.\n  var events = ['error', 'close', 'destroy', 'pause', 'resume'];\n  events.forEach(function(ev) {\n    stream.on(ev, this.emit.bind(this, ev));\n  }.bind(this));\n\n  // consume some bytes.  if not all is consumed, then\n  // pause the underlying stream.\n  this.read = function(n) {\n    var ret;\n\n    if (this._bufferLength === 0) {\n      ret = null;\n    } else if (!n || n >= this._bufferLength) {\n      // read it all\n      ret = Buffer.concat(this._buffer);\n      this._bufferLength = 0;\n      this._buffer.length = 0;\n    } else {\n      // read just some of it.\n      if (n < this._buffer[0].length) {\n        // just take a part of the first buffer.\n        var buf = this._buffer[0];\n        ret = buf.slice(0, n);\n        this._buffer[0] = buf.slice(n);\n      } else if (n === this._buffer[0].length) {\n        // first buffer is a perfect match\n        ret = this._buffer.shift();\n      } else {\n        // complex case.\n        ret = new Buffer(n);\n        var c = 0;\n        for (var i = 0; i < this._buffer.length && c < n; i++) {\n          var buf = this._buffer[i];\n          var cpy = Math.min(n - c, buf.length);\n          buf.copy(ret, c, 0, cpy);\n          if (cpy < buf.length) {\n            this._buffer[i] = buf.slice(cpy);\n            this._buffer = this._buffer.slice(i);\n          }\n          n -= cpy;\n        }\n      }\n      this._bufferLength -= n;\n    }\n\n    if (this._bufferLength === 0) {\n      if (paused) {\n        stream.resume();\n        paused = false;\n      }\n      if (ended) {\n        process.nextTick(this.emit.bind(this, 'end'));\n      }\n    }\n    return ret;\n  };\n};\n\n//@ sourceURL=/node_modules/read-stream/node_modules/readable-stream/readable.js"));

require.define("/example/index.js",Function(['require','module','exports','__dirname','__filename','process'],"var insert = require(\"../index\")\n    , from = require(\"read-stream\")\n    , body = document.body\n\ncreateInputNodes().pipe(\n    insert(createContainer(\"insert\"), null))\n\ncreateInputNodes().pipe(\n    insert.append(createContainer(\"append\")))\n\ncreateInputNodes().pipe(\n    insert.prepend(createContainer(\"prepend\")))\n\ncreateInputNodes().pipe(\n    insert.before(createContainer(\"before\")))\n\ncreateInputNodes().pipe(\n    insert.after(createContainer(\"after\")))\n\nfunction createInputNodes() {\n    var texts = [\"one\", \"two\", \"three\"]\n        , nodes = texts.map(createItemContainer)\n\n    return from(nodes)\n}\n\nfunction createContainer(name) {\n    var container = document.createElement(\"div\")\n\n    container.appendChild(createTextContainer(name))\n    body.appendChild(container)\n    var list = document.createElement(\"ul\")\n    container.appendChild(list)\n    return list\n}\n\nfunction createItemContainer(text) {\n    var li = document.createElement(\"li\")\n    li.textContent = text\n    return li\n}\n\nfunction createTextContainer(text) {\n    var div = document.createElement(\"div\")\n    div.textContent = text\n    return div\n}\n//@ sourceURL=/example/index.js"));
require("/example/index.js");
})();
