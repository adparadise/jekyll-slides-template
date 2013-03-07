var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
}

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
            return require(file, dirname);
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = { exports : {} };
        
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
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};
});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process){var process = module.exports = {};

process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();
});

require.define("/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"md_plus.js"}});

require.define("md-plus",function(require,module,exports,__dirname,__filename,process){
exports.Definition = require('./lib/definition.js').Definition;
exports.DomSpan = require('./lib/dom_span.js').DomSpan;
exports.DomTreeIterator = require('./lib/dom_tree_iterator.js').DomTreeIterator;
exports.Parser = require('./lib/parser.js').Parser;
exports.StackBuilder = require('./lib/stack_builder.js').StackBuilder;
exports.TreeBuilder = require('./lib/tree_builder.js').TreeBuilder;

});

require.define("/lib/definition.js",function(require,module,exports,__dirname,__filename,process){
var Definition = {};
Definition.Validation = require('./definition/validation.js');
Definition.Definition = require('./definition/definition.js').Definition;
Definition.Set = require('./definition/set.js').Set;
Definition.CandidatesBuilder = require('./definition/candidates_builder.js').CandidatesBuilder;
Definition.Builder = require('./definition/builder.js').Builder;

exports.Definition = Definition;});

require.define("/lib/definition/validation.js",function(require,module,exports,__dirname,__filename,process){var Info = require('./validation/info.js').Info;

exports.validate = function (definition) {
    var errors = new Info();
    var index, child, childErrors;

    if (!definition._description) {
        errors.push({
            message: 'No description provided'
        });
        return errors;
    }

    if (!definition._description.tag) {
        errors.push({
            field: 'tag',
            message: 'Missing tag declaration'
        });
    }
    if (definition._description.children) {
        if (typeof definition._description.children.length !== "number") {
            errors.push({
                field: 'children',
                message: 'Children should be an array: no length property found'
            });
        }
        for (index = definition._description.children.length; index--;) {
            child = definition._description.children[0];
            if (!child.validate) {
                errors.push({
                    field: 'children',
                    message: 'Child: ' + index + ' not a definition: didn\'t respond to validate'
                });
                continue;
            }
            childErrors = child.validate();
            if (childErrors.anyErrors()) {
                errors.push({
                    field: 'children',
                    message: 'Child: ' + index + ' is invalid',
                    isBubbledUp: true
                });
            }
        }
    }
    
    return errors;
};
});

require.define("/lib/definition/validation/info.js",function(require,module,exports,__dirname,__filename,process){
/**
 * A class to contain validation errors and warnings.
 */
exports.Info = function () {
    this.initialize = function () {
        this._errors = [];
    };

    // assumes an error of the form:
    // { 
    //   level: ['error'], 
    //   field: <field name of concern>,
    //   message: <human readable error message>
    // }
    this.push = function (error) {
        if (!error.level || error.level === 'error') {
            this._errors.push(error);
        }
    };

    this.errorCount = function () {
        return this._errors.length;
    };

    this.anyErrors = function () {
        return this._errors.length;
    };

    this.errorAtToString = function (index) {
        var error = this._errors[index];
        return error.field + ": " + error.message;
    };

    // Returns the first error marked for the field of concern.
    this.errorForField = function (field) {
        var index, error;
        var errorForField;
        for (index = this._errors.length; index--;) {
            error = this._errors[index];
            if (error.field === field) {
                errorForField = error;
                break;
            }
        }
        return errorForField;
    };

    this.initialize.apply(this, arguments);
};
});

require.define("/lib/definition/definition.js",function(require,module,exports,__dirname,__filename,process){var Validation = require('./validation.js');

/**
 * A container class to represent a translation from HTML entities to class instances.
 */
var Definition = function () {
    this.initialize = function (description) {
        this._description = description;
    };

    this.validate = function () {
        if (!this._validationInfo) {
            this._validationInfo = Validation.validate(this);
        }
        return this._validationInfo;
    };

    this.set = function(key, value) {
        this._description[key] = value;
    };

    this.setHandler = function (handler, context) {
        this.set('handler', handler);
        this.set('context', context);
    };

    this.get = function(key) {
        return this._description[key];
    };

    this.isValid = function () {
        return !this.validate().anyErrors();
    };

    this.getID = function () {
        return this._id;
    };

    this.getDepth = function () {
        return this._id.length
    };

    this.bakeIDs = function (id) {
        var offset, definitionCount = this.getDefinitionCount();
        var definition, subID;
        this._id = id;
        for (offset = 0; offset < definitionCount; offset++) {
            definition = this.getChildAt(offset);
            subID = id.slice(0);
            subID.push(offset);
            definition.bakeIDs(subID);
        }
        this.bakeTags();
    };

    this.bakeTags = function () {
        var tagsList;
        var index, tagListLength;
        var tagsRegexp;

        // Determine how tags were defined by the user
        if (typeof this._description.tag === "string") {
            tagsList = this._description.tag.split("|");
        } else if (this._description.tag.test) {
            tagsRegexp = this._description.tag;
        } else if (typeof this._description.tag === "object") {
            tagsList = this._description.tag;
        }

        // Assign the appropriate 'private' description.
        if (tagsList) {
            tagsListLength = tagsList.length;
            this._description._tags = [];
            for (index = 0; index < tagsListLength; index++) {
                this._description._tags.push(tagsList[index].toUpperCase());
            }
        } else {
            this._description._tagsRegexp = tagsRegexp;
        }
    };

    this.eachDefinition = function (callback) {
        var offset, childrenLength = this.getDefinitionCount();
        var childDefinition;

        callback(this);
        for (offset = 0; offset < childrenLength; offset++) {
            childDefinition = this.getChildAt(offset);
            childDefinition.eachDefinition(callback);
        }
    };

    this.consume = function (span) {
        if (!this.isValid()) {
            this.failValidation();
            return;
        }
        if (this._description.context) {
            this._description.handler.apply(this._description.context, [span, this]);
        } else {
            this._description.handler(span, this);
        }
    };

    this.failValidation = function () {
        var messageFragments = ["Invalid Definition"];
        var validation = this.validate();
        var index, info;
        for (index = validation.errorCount(); index--;) {
            messageFragments.push(validation.errorAtToString(index));
        }
        throw new Error(messageFragments.join("\n       "));
    };

    this.match = function (element) {
        if (!this.isValid()) {
            this.failValidation();
            return;
        }
        if (!this._tagMatches(element)) {
            return false;
        }
        
        if (!this._contentMatches(element)) {
            return false;
        }

        return true;
    };

    this._tagMatches = function (element) {
        var index, tagsLength;
        var tagName = element.tagName;

        if (this._description._tags) {
            tagsLength = this._description._tags.length;
            for (index = 0; index < tagsLength; index++) {
                if (tagName === this._description._tags[index]) {
                    return true;
                }
            }
        } else if (this._description._tagsRegexp) {
            return this._description._tagsRegexp.test(tagName);
        }
        return false;
    };

    this.getChildAt = function (offset) {
        if (!this._description || !this._description.children) {
            return;
        }
        return this._description.children[offset];
    };

    this.getDefinitionCount = function () {
        if (!this._description.children) {
            return 0;
        }
        return this._description.children.length;
    };

    this._contentMatches = function (element) {
        var textContent;
        var contentRegExp;

        if (!this._description.content) {
            return true;
        }

        textContent = element.textContent;
        if (this._description.content.test && this._description.content.test(textContent)) {
            return true;
        } else {
            contentRegExp = new RegExp(this._description.content);
            if (contentRegExp.test(textContent)) {
                return true;
            }
        }

        return false;
    };

    this.getTagName = function () {
        return this._description.tag.toUpperCase();
    };

    this.getContentPattern = function () {
        return this._description.content;
    };

    this.initialize.apply(this, arguments);
};

exports.Definition = Definition;});

require.define("/lib/definition/set.js",function(require,module,exports,__dirname,__filename,process){
var Info = require('./validation/info.js').Info;
var Set = function () {
    this.initialize = function (definitions) {
        this._definitions = definitions;
    };

    this.getID = function () {
        return [];
    };

    // Assumes refPath declares a unique path from the root.
    this.getDefinition = function (refPath) {
        var offset, definitionCount;
        var parent = this;
        var definition;
        var refs = refPath.split("/");
        var index, ref, refsLength = refs.length;
        var child;
        
        for (index = 0; index < refsLength; index++) {
            ref = refs[index];
            child = undefined;
            definitionCount = parent.getDefinitionCount()
            for (offset = 0; offset < definitionCount; offset++) {
                definition = parent.getChildAt(offset);
                if (definition.get('ref') === ref) {
                    child = definition;
                    break;
                }
            }
            if (!child) {
                // The trail is cold, we will return undefined.
                parent = undefined;
                break;
            }
            parent = child;
        }

        return parent;
    };

    this.setHandler = function (refPath, handler, context) {
        var definition = this.getDefinition(refPath);
        definition.setHandler(handler, context);
    };

    this.bakeIDs = function () {
        var offset, definitionCount = this.getDefinitionCount();
        var definition;
        for (offset = 0; offset < definitionCount; offset++) {
            definition = this.getChildAt(offset);
            definition.bakeIDs([offset]);
        }
    };

    this.validate = function () {
        if (!this._validationInfo) {
            this._validationInfo = Set.Validation.validate(this);
        }
        return this._validationInfo;
    };

    this.isValid = function () {
        return !this.validate().anyErrors();
    };

    this.getChildAt = function (offset) {
        if (!this._definitions || typeof this._definitions.length !== "number") {
            return;
        }
        return this._definitions[offset];
    };

    this.getDefinitionCount = function () {
        if (!this._definitions || typeof this._definitions.length !== "number") {
            return 0;
        }
        return this._definitions.length;
    };

    this.eachDefinition = function (callback) {
        var offset, definitionCount = this.getDefinitionCount();
        var definition;
        for (offset = 0; offset < definitionCount; offset++) {
            definition = this.getChildAt(offset);
            definition.eachDefinition(callback);
        }
    };

    this.initialize.apply(this, arguments);
};

Set.Validation = require('./set/validation.js');

exports.Set = Set;});

require.define("/lib/definition/set/validation.js",function(require,module,exports,__dirname,__filename,process){
var Info = require('../validation/info.js').Info;

exports.validate = function (set) {
    var index, error;
    var errors = new Info();
    if (!set._definitions) {
        errors.push({
            field: 'definitions',
            message: "No definitions provided"
        });
        return errors;
    }

    if (typeof set._definitions.length !== "number") {
        errors.push({
            field: 'definitions',
            message: "Definitions not an array"
        });
        return errors;
    }
        
    for (index = set._definitions.length; index--;) {
        if (!set._definitions[index].validate) {
            errors.push({
                field: 'definitions',
                message: 'Child: ' + index + ' not a definition: didn\'t respond to validate'
            });
        } else {
            error = set._definitions[index].validate();
            if (error.anyErrors()) {
                errors.push({
                    field: 'definitions',
                    message: 'Child: ' + index + ' is invalid'
                });
            }
        }
    }
    return errors;
}

});

require.define("/lib/definition/candidates_builder.js",function(require,module,exports,__dirname,__filename,process){

var CandidatesBuilder = function () {
    this.initialize = function (set) {
        if (!set) {
            throw new Error("No Definition Set provided");
        }
        this._set = set;
    };

    this.getCandidatesAt = function (id) {
        var candidates = []
        var popLength, idLength = id.length;
        for (popLength = 0; popLength <= idLength; popLength++) {
            this._addCandidatesPeerTo(id, popLength, candidates);
        }
        
        return candidates;
    }

    this._addCandidatesPeerTo = function (id, popLength, candidates) {
        var offset, definitionCount, definition;
        var currentDefinition = this.getDefinitionAtID(id, popLength);
        if (!currentDefinition) {
            return;
        }
        definitionCount = currentDefinition.getDefinitionCount();
        for (offset = 0; offset < definitionCount; offset++) {
            definition = currentDefinition.getChildAt(offset);
            if (definition) {
                candidates.push(definition);
            }
        }
    };

    this.getDefinitionAtID = function (id, popLength) {
        var definition = this._set;
        var index, idLength = id.length;
        popLength = popLength || 0;
        for (index = 0; index < idLength - popLength; index++) {
            definition = definition.getChildAt(id[index]);
        }

        return definition;
    };

    this.initialize.apply(this, arguments);
};

exports.CandidatesBuilder = CandidatesBuilder;});

require.define("/lib/definition/builder.js",function(require,module,exports,__dirname,__filename,process){
var Definition = require('./definition.js').Definition;
var Set = require('./set.js').Set;

var Builder = function () {
    this.build = function (declarations) {
        var set = new Set(this.buildDefinitionList(declarations));
        set.bakeIDs();

        return set;
    };

    this.buildDefinitionList = function (declarations) {
        var definitions = [];
        var index, declarationsLength, declaration;
        declarationsLength = declarations.length;
        for (index = 0; index < declarationsLength; index++) {
            declaration = declarations[index];
            definitions.push(this.buildDefinition(declaration));
        }

        return definitions;
    };

    this.buildDefinition = function (declaration) {
        var children;
        if (declaration.children) {
            children = this.buildDefinitionList(declaration.children);
            declaration.children = children;
        }
        return new Definition(declaration);
    };
}

exports.Builder = Builder;});

require.define("/lib/dom_span.js",function(require,module,exports,__dirname,__filename,process){

exports.DomSpan = function () {
    this.initialize = function (iterator) {
        this._iterator = iterator;
    };

    this.pushLocation = function (location) {
        this._low = this._high;
        this._high = location;
    };

    this.getMatchingElement = function () {
        return this._iterator.elementAtLocation(this._low);
    };
    
    this.getLow = function () {
        return this._low;
    };

    this.getHigh = function () {
        return this._high;
    };

    this.atEnd = function (location) {
        var index, locationLength;
        var atEnd;
        if (location.length != this._high.length) {
            return false;
        }

        atEnd = true;
        locationLength = location.length;
        for (index = 0; index < locationLength; index++) {
            if (location[index] !== this._high[index]) {
                atEnd = false;
                break;
            }
        }
        return atEnd;
    };

    this._eachIterator = function (handler, nextMethod) {
        var location = this._low;
        while (true) {
            if (location.length === 0 || this.atEnd(location)) {
                break;
            }
            var element = this._iterator.elementAtLocation(location);
            if (element) {
                handler(element);
            }
            location = this._iterator[nextMethod](location);
        }
    }

    this.each = function (handler) {
        this._eachIterator(handler, "next")
    };

    this.eachShallow = function (handler) {
        this._eachIterator(handler, "nextPeer")
    };

    this.eachMatching = function (predicate, handler) {
        this.each(function (element) {
            if (predicate(element)) {
                handler(element);
            }
        });
    };

    this.eachElementByTagName = function (tagName, handler) {
        this.eachMatching(function (element) {
            return element.tagName === tagName;
        }, handler);
    };

    this.isJSON = function (text) {
        var jsonPattern = /[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/;
        var replacement = /"(\\.|[^"\\])*"/g

        return !jsonPattern.test(text.replace(replacement, ''))
    }

    this.dataWithin = function (retainNodes) {
        var data = {};
        var isJSON = this.isJSON;
        var index, toRemove = [], element;

        this.eachElementByTagName('CODE', function (element) {
            var text = element.textContent.trim();
            var currentData = {};
            var key;
            if (isJSON(text)) {
                currentData = eval('(' + text + ')');
                
                for (key in currentData) {
                    if (currentData.hasOwnProperty(key)) {
                        data[key] = currentData[key];
                    }
                }

                if (!retainNodes) {
                    toRemove.push(element);
                }
            }
        });

        for (index = toRemove.length; index--;) {
            element = toRemove[index];
            element.parentNode.removeChild(element);
        }

        return data;
    };

    this.initialize.apply(this, arguments);
};});

require.define("/lib/dom_tree_iterator.js",function(require,module,exports,__dirname,__filename,process){

/**
 * A class for working with trees of DOM Elements in a linear fashion.
 */
exports.DomTreeIterator = function () {
    this.initialize = function (container) {
        this._container = container;
    };

    this.next = function (location) {
        var nextLocation = location.slice(0);
        var locationLength = nextLocation.length
        var childElementOffset;

        childElementOffset = this._firstChildElementOffset(nextLocation);
        if (childElementOffset || childElementOffset === 0) {
            nextLocation.push(childElementOffset);
            return nextLocation;
        }

        for (index = locationLength; index--;) {
            peerElementOffset = this._nextPeerElementOffset(nextLocation);
            if (peerElementOffset || peerElementOffset === 0) {
                nextLocation[nextLocation.length - 1] = peerElementOffset;
                return nextLocation;
            } else {
                nextLocation.pop();
            }
        }

        return [];
    };

    this.nextPeer = function (location) {
        var nextLocation = location.slice(0);
        var locationLength = nextLocation.length
        var childElementOffset;

        for (index = locationLength; index--;) {
            peerElementOffset = this._nextPeerElementOffset(nextLocation);
            if (peerElementOffset || peerElementOffset === 0) {
                nextLocation[nextLocation.length - 1] = peerElementOffset;
                return nextLocation;
            }
        }

        return [];
    };

    this._firstChildElementOffset = function (location) {
        var element = this.elementAtLocation(location);
        var index, childCount = element.childNodes.length;
        var childElementOffset;
        for (offset = 0; offset < childCount; offset++) {
            if (element.childNodes[offset].nodeType === 1) {
                childElementOffset = offset;
                break;
            }
        }
        return childElementOffset;
    };

    this._nextPeerElementOffset = function (location) {
        var parent = this.elementAtLocation(location, 1);
        var selfOffset = location.slice(-1)[0];
        var index, childCount = parent.childNodes.length;
        var peerElementOffset;
        for (offset = selfOffset + 1; offset < childCount; offset++) {
            if (parent.childNodes[offset].nodeType === 1) {
                peerElementOffset = offset;
                break;
            }
        }
        return peerElementOffset;
    };

    this.elementAtLocation = function (location, popLength) {
        var index, locationLength = location.length;
        var currentElement = this._container;
        popLength = popLength || 0
        for (index = 0; index < locationLength - popLength; index++) {
            currentElement = currentElement.childNodes[location[index]];
        }
        return currentElement;
    };

    this.initialize.apply(this, arguments);
};});

require.define("/lib/parser.js",function(require,module,exports,__dirname,__filename,process){
DomTreeIterator = require('./dom_tree_iterator.js').DomTreeIterator;
Definition = require('./definition.js').Definition;
DomSpan = require('./dom_span.js').DomSpan;

exports.Parser = function () {
    this.initialize = function (container, definition) {
        this._container = container;
        this._definition = definition;
    };

    this.parse = function () {
        var iterator = new DomTreeIterator(this._container);
        var candidatesBuilder = new Definition.CandidatesBuilder(this._definition);
        var span = new DomSpan(iterator);
        var candidates;
        var priorMatchDefinition;
        var currentMatchDefinition;
        var currentLocation = [];
        var element;

        candidates = candidatesBuilder.getCandidatesAt([]);
        while (true) {
            element = iterator.elementAtLocation(currentLocation);

            currentMatchDefinition = this._findMatchInCandidates(element, candidates);
            if (currentMatchDefinition) {
                span.pushLocation(currentLocation);
                if (priorMatchDefinition) {
                    priorMatchDefinition.consume(span);
                }

                priorMatchDefinition = currentMatchDefinition;
                candidates = candidatesBuilder.getCandidatesAt(currentMatchDefinition.getID());
            }

            currentLocation = iterator.next(currentLocation);
            if (currentLocation.length === 0) {
                break;
            }
        }

        if (priorMatchDefinition) {
            span.pushLocation([]);
            priorMatchDefinition.consume(span);
        }

    };

    this._findMatchInCandidates = function (element, candidates) {
        var index, candidatesLength = candidates.length;
        var definition;
        var matchedDefinition;

        for (index = 0; index < candidatesLength; index++) {
            definition = candidates[index];

            if (definition.match(element)) {
                matchedDefinition = definition;
                break;
            }
        }

        return matchedDefinition;
    }
    
    this.initialize.apply(this, arguments);
};});

require.define("/lib/stack_builder.js",function(require,module,exports,__dirname,__filename,process){/**
 * A class to maintain a history of objects which implies a hierarchy.
 */
var StackBuilder = function () {
    this.initialize = function () {
        this._stack = [];
    };
    
    this.setSequence = function (sequence) {
        this._sequence = sequence;
    };

    this.handle = function (set, refPath) {
        var definition = set.getDefinition(refPath);
        definition.setHandler(this.handler, this);
    };

    this.setContentHandler = function (contentHandler) {
        this._contentHandler = contentHandler;
    };

    this.getStack = function () {
        return this._stack;
    };

    this._getDepth = function (span, definition) {
        var tagName;
        var depth = 0;
        if (this._sequence.apply) {
            depth = this._sequence(span, definition);
        } else if (this._sequence.indexOf) {
            tagName = span.getMatchingElement().tagName;
            depth = this._sequence.indexOf(tagName);
        }
        return depth;
    };
    
    this._popStackToDepth = function (depth) {
        var index, stackLength = this._stack.length;
        for (index = stackLength; index > depth; index--) {
            this._stack.pop();
        }
    };

    this._getContents = function (span, definition) {
        var content;
        if (this._contentHandler) {
            content = this._contentHandler(span, definition);
        } else {
            content = span.getMatchingElement().textContent;
        }
        return content;
    };

    this.handler = function (span, definition) {
        var depth = this._getDepth(span, definition);
        var content = this._getContents(span, definition);

        this._popStackToDepth(depth);
        this._stack.push(content);
    };

    this.initialize.apply(this, arguments);
}
StackBuilder.HEADERS = ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9"];

exports.StackBuilder = StackBuilder;});

require.define("/lib/tree_builder.js",function(require,module,exports,__dirname,__filename,process){

var TreeBuilder = function () {
    this.initialize = function (options, set) {
        this._options = options || {};
        this._set = set;

        this._rootObject = [];
        this._objectStack = [this._rootObject];
    };

    this.getObjects = function () {
        return this._rootObject;
    };

    this.getOverridden = function (key, definition, defaultValue) {
        var value = definition.get(key);
        if (value === undefined) {
            value = this.get(key);
        }
        if (value === undefined) {
            value = defaultValue;
        }
        return value;
    }

    this.get = function (key) {
        return this._options[key];
    };

    this.bakeDefinitions = function () {
        var treeBuilder = this;
        this._set.eachDefinition(function (definition) {
            var definedHandler = definition.get('handler');
            if (definedHandler) {
                // Allow the existing handler to stand.
                return;
            }
            definition.set('context', treeBuilder);
            definition.set('handler', treeBuilder._matchHandler);
        });
        this._set.bakeIDs();
    };

    this._popObjectStackTo = function (depth) {
        var index, stackLength = this._objectStack.length;
        for (index = stackLength; index > depth; index--) {
            this._objectStack.pop();
        }
    };

    this._createInstance = function (definition) {
        var classRef = this.getOverridden('classRef', definition);
        return new classRef();
    };

    this._delegateToInstance = function (instance, span, definition) {
        instance.build(span, definition);
    };

    this._appendToParent = function (parent, instance, definition) {
        var appendMethodName;
        if (definition.getDepth() === 1) {
            parent.push(instance);
        } else {
            var appendMethodName = this.getOverridden('appendMethodName', definition, 'push');
            parent[appendMethodName](instance);
        }
    };

    this._matchHandler = function (span, definition) {
        var depth = definition.getDepth();
        var instance = this._createInstance(definition);

        // Allow this instance to build itself from the parser.
        this._delegateToInstance(instance, span, definition);
        
        // Find the correct parent for this new instance.
        this._popObjectStackTo(depth);

        // Add instance to parent and to the object stack.
        this._appendToParent(this._objectStack[depth - 1], instance, definition);
        this._objectStack.push(instance);
    };

    this.initialize.apply(this, arguments);
};

TreeBuilder.callbackWrap = function (instance, methodName) {
    var method = instance[methodName];
    return function () {
        return method.apply(instance, arguments);
    };
};

exports.TreeBuilder = TreeBuilder;});
