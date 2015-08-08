//    Copyright (c) 2014-2015 Joe Lakhani. All rights reserved
//
//    See the file LICENSE for redistribution information.
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// -- This is the default web.* plugin for the framework, you should not need
// -- to modify this file unless you're fixing a problem with the default
// -- framework or expanding the utility of it.

var util = require('util');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

var focus_utils = require('./focus_utils');

var template_cache = {};

function Web(framework, env) {
    var self = this;

    self.env = env;
    self.framework = framework;
    self.localConfig = framework.config.localConfig;

    self.controller = self.env.controller || null;
    self.action = self.env.action || null;
    self.urlMap = self.env.urlMap || null;
    self.httpVersion = self.env.httpVersion || null;
    self.httpVersionMajor = self.env.httpVersionMajor || null;
    self.httpVersionMinor = self.env.httpVersionMinor || null;
    self.url = self.env.url || null;
    self.pathname = self.env.pathname || null;
    self.method = self.env.method || null;
    self.userAgent = self.env.userAgent || null;
    self.remoteAddress = self.env.remoteAddress || null;
    self.isAjax = self.env.isAjax || false;
    self.referer = self.env.referer || "none";
    self.cookies = self.env.cookies || {};
    self.post_data = self.env.post_data || {};
    self.query = self.env.query || {};
    self.authUser = self.env.authUser;
};

Web.prototype.validate = focus_utils.validate;
Web.prototype.cryptoEncode = focus_utils.cryptoEncode;
Web.prototype.cryptoDecode = focus_utils.cryptoDecode;
Web.prototype.isObject = focus_utils.isObject;
Web.prototype.isArray = focus_utils.isArray;
Web.prototype.isFunction = focus_utils.isFunction;
Web.prototype.isString = focus_utils.isString;
Web.prototype.isDate = focus_utils.isDate;
Web.prototype.copyObjectProperty = focus_utils.copyObjectProperty;

Web.prototype.getObject = function(input_json) {
    var self = this;
    input_json = input_json || null;

    if (!input_json) {
        return null
    }

    if (self.isString(input_json)) {
        try {
            var ret_object = JSON.parse(input_json);
            return ret_object;
        }
        catch (e) {
            return null;
        }
    }

    return null;
};

Web.prototype.cleanInput = function() {
    var self = this;

    for (var k in self.env.query) {
        if (self.env.query.hasOwnProperty(k)) {
            self.env.query[k] = focus_utils.clean(self.env.query[k]);
        }
    }

    for (var k in self.env.post_data) {
        if (self.env.post_data.hasOwnProperty(k)) {
            self.env.post_data[k] = focus_utils.clean(self.env.post_data[k]);
        }
    }
};

Web.prototype.getCookie = function(byName) {
    var self = this;
    byName = byName || null;

    if (!byName) {
        return null;
    }
    else {
        if (self.env.cookies[byName] !== undefined) {
            return self.env.cookies[byName];
        }

        return null;
    }
};

Web.prototype.getQuery = function(byName) {
    var self = this;
    byName = byName || null;

    if (!byName) {
        return null;
    }
    else {
        if (self.env.query[byName] !== undefined) {
            return self.env.query[byName];
        }

        return null;
    }
};

Web.prototype.getForm = function(byName) {
    var self = this;
    byName = byName || null;

    if (!byName) {
        return null;
    }
    else {
        if (self.env.post_data[byName] !== undefined) {
            return self.env.post_data[byName];
        }

        return null;
    }
};

Web.prototype.getPost = Web.prototype.getForm;

Web.prototype.sendFile = function(fileName, clientName, callback) {
    var self = this;
    var check_root = false;

    callback = callback || null;

    if (!focus_utils.isFunction(callback)) {
        throw new Error("Web.sendFile || Error: Callback required");
    }

    fileName = fileName || null;
    clientName = clientName || null;

    if (!fileName) {
        callback("Web.sendFile: file name required");
        return self;
    }
    if (!clientName) {
        callback("Web.sendFile: client name required");
        return self;
    }

    if (self.framework.config.fileRoot !== undefined) {
        check_root = true;
    }

    var root = path.resolve(fileName);

    if (check_root) {
        var root_jail = path.resolve(self.framework.config.fileRoot);

        if (root.indexOf(root_jail) == -1) {
            try {
                self.framework.sendHeaders(self.env, 404, 404, null);
            } catch(e) {
                callback("fileRoot violation ("+root_jail+")");
            }
            return self;
        }
    }

    fs.stat(root, function(err, stats) {
        if (!err) {
            try {
                fs.readFile(root, function(err, data) {
                    if (err) {
                        var msg = "";
                        if (err.message.indexOf('EISDIR') != -1) {
                            msg = '[ERROR]: Web.sendFile - Directory requested.';
                        } else {
                            msg = '[ERROR]: Web.sendFile - ' + err.message;
                        }

                        try {
                            self.framework.sendHeaders(self.env, 404, 404, null);
                        } catch(e) {
                            callback(msg);
                        }
                        return self;
                    }
                    else {
                        var headers = {};
                        headers['Date'] = new Date().toUTCString();
                        headers['Server'] = "Node.js Focus Framework/1.0";
                        headers['Last-Modified'] = stats.mtime.toUTCString();
                        headers['Cache-Control'] = "no-cache";
                        headers['Content-Transfer-Encoding'] = "binary";
                        headers['Content-Length'] = stats.size;
                        headers['Content-Disposition'] = 'attachment; filename=' + clientName;
                        headers['Content-Type'] = "application-download";
                        headers['Connection'] = "close";
                        headers['X-Requested'] = self.env.req.url;

                        self.framework.sendAndClose(self.env, 200, data, headers, function() {
                            callback(null, stats.size);
                        });
                    }
                });
            }
            catch(e) {
                console.error('[ERROR]: Web.sendFile - ' + e.message);
            }
        }
        else {
            try {
                self.framework.sendHeaders(self.env, 404, 404, null);
            } catch(e) {
                callback(err);  //sendHeaders will throw a _script_interrupt_ to short-circut execution, cb with err (above)
            }
        }
    });

    return self;
};

Web.prototype.redirect = function(loc) {
    var self = this;
    loc = loc || null;

    var loop = loc.split('/');
        loop.shift();

    if (loop.length == 2) {
        if ( (loop[0] == self.env.controller) && (loop[1] == self.env.action) ) {
            console.error('[ERROR]: Web.redirect - Redirect loop detected');
            self.framework.fatalError(self.env);
            return self;
        }
    }
    else if (loop.length == 1) {
        if ( (loop[0] == self.env.controller ) && (loop[1] == "index") ) {
            console.error('[ERROR]: Web.redirect - Redirect loop detected');
            self.framework.fatalError(self.env);
            return self;
        }
    }

    if (loc) {
        self.framework.sendHeaders(self.env, 303, 302, loc);
    }

    return self;
};

Web.prototype.setHeader = function(name, value) {
    var self = this;

    name = name || null;
    value = value || null;

    if ((name != null) && (value != null)) {
        self.framework.setHeader(self.env, name, value);
    }

    return self;
}

Web.prototype.setCookie = function(name, value, expires, domain, secure, httponly, path) {
    var self = this;

    name = name || null;
    value = value || null;
    expires = expires || null;
    domain = domain || null;
    secure = secure || null;
    path = path || null;

    if ((name != null) && (value != null)) {
        self.framework.setCookie(self.env, name, value, expires, domain, secure, httponly, path);
    }

    return self;
};

Web.prototype.clearCookie = function(name) {
    var self = this;

    if (name) {
        self.framework.setCookie(self.env, name);
    }

    return self;
}

Web.prototype.responseIsJSON = function() {
    var self = this;

    if (self.env.res._headerSent) {
        console.log("Warning: Cannot set response type (JSON). Headers away...");
    }
    else {
        self.env.requestExtension = "application/json; charset=utf-8";
    }

    return self;
};

Web.prototype.unauthorized = function(challenge) {
    var self = this;
    challenge = challenge || "Focus Framework";

    self.framework.sendHeaders(self.env, 401, 401, challenge);

    return self;
};

Web.prototype.authenticate = function(users) {
    var self = this;
    users = users || null;

    if ( (!focus_utils.isArray(users)) && (!focus_utils.isString(users)) ) {
        throw new Error("Web.authenticate || Error: User[s] required");
        return;
    }

    if (focus_utils.isString(users)) {
        users = [users];
    }

    var challenge = null;
    if (self.framework.config.authName !== undefined) {
        challenge = self.framework.config.authName;
    }
    if (!challenge) {
        challenge = "Focus Framework";
    }

    if (self.env.authUser !== false) {
        if (users.indexOf(self.env.authUser) != -1) {
            if (self.framework.config._auth_list[self.env.authUser] !== undefined) {
                var sha1 = crypto.createHash('sha1').update(self.env.authPass).digest("hex");
                if (sha1 == self.framework.config._auth_list[self.env.authUser]) {
                    return true;
                }
            }
        }
    }

    self.framework.authenticate(self.env, challenge);
    return;
};

Web.prototype.render = function(fileName, templateData, callback) {
    var self = this;

    fileName = fileName || null;
    templateData = templateData || null;
    callback = callback || null;

    if (focus_utils.isFunction(templateData)) {
        callback = templateData;
    }

    if (!callback) {
        return self;
    }

    if (!fileName) {
        callback("Web.render || File name required.");
    }

    fileName = self.framework.config.templates + '/' + fileName;

    fs.readFile(fileName, function(err, content) {
        if (err) {
            callback("Web.render || fs.readFile("+err.message+")");
            return;
        }

        var generator = render(content.toString('utf8'));

        if (focus_utils.isFunction(generator)) {
            try {
                var rendered = generator(templateData);
                callback(null, rendered);
            }
            catch(e) {
                console.log("ERROR: " + e.message);
                callback("Web.render || Unable to render: '" + e.message + "' from " + fileName);
            }
        }
        else {
            callback("Web.render || Unable to create template generator.");
            return;
        }
    });

    return self;
};

Web.prototype.echo = function() {
    var self = this;

    self.framework.response(self.env, util.format.apply(this, arguments));

    return self;
}

module.exports = Web;

function render(content) {
    var read = content.length;

    if (read) {
        var jsBlocks = /(<%[^=].*?%>)/g;
        var oneBlock = /(<%=.*?%>)/g;

        var jsBlocksCap = /<%[^=](.*?)%>/g;
        var oneBlockCap = /<%=(.*?)%>/g;

        var stack = [];

        content = content.replace(/[\r\t\n]/g, " ");

        var compile = "var tmpl = []; with(sandbox) { ";
        content.split(jsBlocks).forEach(function(segment) {
            segment.split(oneBlock).forEach(function(singlet) {
                if (singlet.match(oneBlock)) {
                    compile += "tmpl.push(" + singlet.split(oneBlockCap).join('') + ");\n";
                }
                else if (singlet.match(jsBlocks)) {
                    compile += singlet.split(jsBlocksCap).join('');
                }
                else {
                    compile += "tmpl.push('" + singlet.replace(/'/g, "\\'") + "');\n";
                }
            });
        });
        compile += "} return tmpl.join('');";

        return new Function("sandbox", compile);
    }
    else {
        return new Function("sandbox", "return function() { return ''; };");
    }
};

