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

var fs = require('fs');
var http = require('http');
var url = require('url');
var util = require('util');
var querystring = require('querystring');

var _ENCODING = 'utf8';
var _CACHECONTROL = 'Cache-Control';
var _CONTENTTYPE = 'Content-Type';
var _CONTENTLENGTH = 'Content-Length';
var _TEXTPLAIN = 'text/plain';
var _TEXTHTML = 'text/html';
var _COMPRESS_CONTENTTYPE = { 'text/plain': true, 'text/javascript': true, 'text/css': true, 'application/x-javascript': true, 'application/json': true, 'text/xml': true, 'image/svg+xml': true, 'text/x-markdown': true, 'text/html': true };
var _X_XSS_PROTECTION = 'X-XSS-Protection: 1; mode=block';

var isObject = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object Object]' )
};

function Framework(config) {
    var self = this;

    self.config = config;

    self.stats = {
        request: 0,
        pending: 0,
        web: 0,
        xhr: 0,
        file: 0,
        websocket: 0,
        get: 0,
        post: 0,
        put: 0,
        upload: 0,
        xss: 0,
        blocked: 0,
        notmodified: 0,
        error403: 0,
        error404: 0,
        error500: 0
    };
};

Framework.prototype.response = function(env, data, append_headers, callback) {
    var self = this;

    env = env || null; data = data || null; append_headers = append_headers || null; callback = callback || null;

    if (!env) {
        if (callback) {
            callback("Framework.response || Error: Environment missing");
        }
        return self;
    }

    var statusCode = env.res.statusCode;

    if (data) {
        if (env.httpVersionMinor) {
            if (callback) {
                self.sendData(env, data, statusCode, append_headers, function() {
                    callback(arguments);
                });
            }
            else {
                self.sendData(env, data, statusCode, append_headers);
            }
        }
        else {  //chunk the response and output all at once at end of request
            env.chunkedResponse += data;
            if (callback) {
                callback();
            }
        }
    }
    else {
        if (env.httpVersionMinor) {
            if (callback) {
                self.sendData(env, null, statusCode, append_headers, function() {
                    callback(arguments);
                });
            }
            else {
                self.sendData(env, null, statusCode, append_headers);
            }
        }
        else {
            if (callback) {
                self.sendAndClose(env, statusCode, env.chunkedResponse, append_headers, function() {
                    callback(arguments);
                });
            }
            else {
                self.sendAndClose(env, statusCode, env.chunkedResponse, append_headers);
            }
        }
    }

    return self;
}

Framework.prototype.sendAndClose = function(env, statusCode, body, append_headers, callback) {
    var self = this;

    env = env || null;
    statusCode = statusCode || null;
    body = body || null;
    append_headers = append_headers || null;

    if ( (!env) || (!statusCode) || (!body) ) {
        if (callback) {
            callback("Framework.sendAndClose || Error: Parameter missing");
        }
        return self;
    }

    var headers = {};

    if (!env.res._headerSent) {
        env.res.setHeader('Date', new Date().toUTCString());
        env.res.setHeader('Server', "Node.js Focus Framework/1.0");
        env.res.setHeader('Last-Modified', new Date().toUTCString());
        env.res.setHeader('Content-Length', body.length);
        env.res.setHeader('Connection', "close");
        env.res.setHeader('Content-Type', "text/html; charset=utf-8");
        env.res.setHeader('X-Requested', env.req.url);

        if (env.requestExtension) {
            env.res.setHeader('Content-Type', env.requestExtension);
        }

        var set_cookies_ = env.setCookie();

        if (Object.size(set_cookies_) > 0) {
            var make_join = [];
            for (k in set_cookies_) { if (set_cookies_.hasOwnProperty(k)) make_join.push(set_cookies_[k]); }
            env.res.setHeader("Set-Cookie", make_join);
        }

        if (isObject(append_headers)) {
            for (var k in append_headers) {
                if (append_headers.hasOwnProperty(k)) {
                    env.res.setHeader(k, append_headers[k]);
                }
            }
        }

        env.res.statusCode = statusCode;
    }
    else {
        console.error("Warning: Framework.sendAndClose() || Headers not written, headers away");
    }

    if (statusCode == 304) {
        env.connected = false;
        if (callback) {
            env.res.end(function() {
                callback();
            });
            return self;
        }

        env.res.end();
        return self;
    }
    else {
        env.connected = false;
        if (callback) {
            env.res.end(body, function() {
                callback();
            });
            return self;
        }

        env.res.end(body);
        return self;
    }
}

Framework.prototype.sendData = function(env, data, statusCode, append_headers, callback) {
    var self = this;

    env = env || null;
    statusCode = statusCode || null;
    data = data || null;
    append_headers = append_headers || null;

    if (!env) {
        if (callback) {
            callback("Framework.sendData || Error: Environment missing");
        }
        return self;
    }

    if (!env.connected) {
        console.error("Framework.sendData || Error: Not connected  ("+data.toString().substring(0, 20)+" ... ) [possible call to script.done() before web.render callback]");
        if (callback) {
            callback("Framework.sendData || Error: Not connected.");
        }
        return self;
    }

    if (!env.res._headerSent) {
        var headers  = {};

        env.res.setHeader('Date', new Date().toUTCString());
        env.res.setHeader('Server', "Node.js Focus Framework/1.0");
        env.res.setHeader('Last-Modified', new Date().toUTCString());
        env.res.setHeader('Cache-Control', "no-cache");
        env.res.setHeader('Transfer-Encoding', "chunked");
        env.res.setHeader('Content-Type', "text/html; charset=utf-8");
        env.res.setHeader('X-Requested', env.req.url);

        if (isObject(append_headers)) {
            for (var k in append_headers) {
                if (append_headers.hasOwnProperty(k)) {
                    env.res.setHeader(k, append_headers[k]);
                }
            }
        }

        if (env.requestExtension) {
            env.res.setHeader('Content-Type', env.requestExtension);
        }

        var set_cookies_ = env.setCookie();

        if (Object.size(set_cookies_) > 0) {
            var make_join = [];
            for (k in set_cookies_) { if (set_cookies_.hasOwnProperty(k)) make_join.push(set_cookies_[k]); }
            env.res.setHeader("Set-Cookie", make_join);
        }

        if (statusCode) {
            env.res.statusCode = statusCode;
        }
        else {
            env.res.statusCode = 200;
        }
    }

    if (data) {
        if (callback) {
            env.res.write(data, function(){
                callback();
            });
            return self;
        }

        env.res.write(data);
        return self;
    }
    else {
        env.connected = false;
        if (callback) {
            env.res.end(function() {
                callback();
            });
            return self;
        }

        env.res.end();
        return self;
    }
}

Framework.prototype.setHeader = function(env, name, value) {
    var self = this;

    env = env || null;
    name = name || null;
    value = value || null;

    if (!env) {
        console.error("Framework.setHeader || Error: Environment missing");
        return self;
    }
    if (!name) {
        console.error("Framework.setHeader || Error: Name missing");
        return self;
    }
    if (!value) {
        console.error("Framework.setHeader || Error: Value missing");
        return self;
    }
    if (env.res._headerSent) {
        console.error("Framework.setHeader || Error: Unable to set header. Headers away");
        return self;
    }

    env.res.setHeader(name, value);
}

//Send headers is "special". usually called as an interruptive mechanism, redirects
//auth messages, fatal, etc. This makes sure scripts don't continue
Framework.prototype.sendHeaders = function(env, http_one, http_zero, param) {
    var self = this;

    env = env || null;
    param = param || null;
    http_one = http_one || null;
    http_zero = http_zero || null;

    if (!env) {
        throw new Error("Framework.sendHeaders || Error: Environment missing");
    }

    if (env.res._headerSent) {
        throw new Error("Framework.sendHeaders || Error: Headers away (" + http_one +")");
    }
    else {
        var headers = {};
        env.res.setHeader('Date', new Date().toUTCString());
        env.res.setHeader('Server', "Node.js Focus Framework/1.0");
        env.res.setHeader('Last-Modified', new Date().toUTCString());
        env.res.setHeader('Connection', "close");
        env.res.setHeader('Cache-Control', "no-cache");
        env.res.setHeader('X-Requested', env.req.url);

        var set_cookies_ = env.setCookie();

        if (Object.size(set_cookies_) > 0) {
            var make_join = [];
            for (k in set_cookies_) { if (set_cookies_.hasOwnProperty(k)) make_join.push(set_cookies_[k]); }
            env.res.setHeader("Set-Cookie", make_join);
            set_cookies_ = [];
        }

        if (http_one == 303) {
            env.res.setHeader('Location', param);
        }

        if (env.httpVersionMinor > 0) {
            env.res.statusCode = http_one;
        }
        else {
            if (http_zero) {
                env.res.statusCode = http_zero;
            }
        }

        if (http_one == 401) {
            if (param) {
                env.res.setHeader('Content-Type', "text/html; charset=utf-8");
                env.res.setHeader('WWW-Authenticate', 'Basic realm="'+param+'"');
                env.res.write('<center><h1>Authentication required</h1></center><hr><center>Focus Framework</center>');
            }
        } else if (http_one == 500) {
            if (param) {
                env.res.setHeader('Content-Type', "text/html; charset=utf-8");
                env.res.write(param);
            }
        }

        throw new Error("_script_interrupt_");
        //this ensures that if we need to interrupt script execution for a 500 or some other reason
    }
}

Framework.prototype.setCookie = function(env, name, value, expires, domain, secure, httponly, path) {
    var self = this;

    if (env.res._headerSent) {
        console.error("Warning: Framework.setCookie() || Cannot set cookie, headers away");
    }

    env.setCookie(name, value, expires, domain, secure, httponly, path);

    return self;
}

Framework.prototype.authenticate = function(env, prompt, callback) {
    var self = this;

    env = env || null;
    callback = callback || null;
    prompt = prompt || "Focus Framework";

    if (!env) {
        if (callback) {
            callback("Framework.authenticate || Error: Environment missing");
        }
        return self;
    }

    self.sendHeaders(env, 401, 401, prompt, function() {
        if (callback) {
            callback();
        }

        return self;
    });

    return self;
}

Framework.prototype.notFound = function(env, callback) {
    var self = this;

    var body = "";
    if (!self.config.Error404) {
        body = "Not Found (404) || Please set <i>config.Error404</i>";
    }

    self.stats.error404++;

    if (callback) {
        self.sendAndClose(env, 404, body, null, function() {
            callback();
        });

        return self;
    }

    self.sendAndClose(env, 404, body);
    return self;
}

Framework.prototype.forbidden = function(env, callback) {
    var self = this;

    var body = "";
    if (!self.config.Error403) {
        body = "Forbidden (403) || Please set <i>config.Error403</i>";
    }

    self.stats.error403++;

    if (callback) {
        self.sendAndClose(env, 403, body, null, function() {
            callback();
        });

        return self;
    }

    self.sendAndClose(env, 403, body);
    return self;
}

Framework.prototype.fatalError = function(env) {
    var self = this;

    var body = "";
    if (!self.config.Error500) {
        body = "Fatal Error (500) || Please set <i>config.Error500</i>";
    }

    self.stats.error500++;

    self.sendHeaders(env, 500, 500, body);
}

Framework.prototype.cacheFile = function(env, stats) {
    var self = this;

    return self;
}

Framework.prototype.staticFile = function(env, fileStats) {
    var self = this;

    try {
        fs.readFile(fileStats.resolved, function(err, data) {
            if (err) {
                if (err.message.indexOf('EISDIR') != -1) {
                    self.noDirListing(env);
                }
                else {
                    self.fatalError(env);
                }
            }
            else {
                var last_modified = {'Last-Modified': fileStats.stats.mtime.toUTCString()};

                var if_modified_since = ( (typeof env.req.headers != 'undefined') &&
                                          (typeof env.req.headers['if-modified-since'] != 'undefined')
                                          ? env.req.headers['if-modified-since'] : null);

                if (if_modified_since) {
                    var mod_date = new Date(if_modified_since);

                    if (fileStats.stats.mtime > mod_date) {
                        self.sendData(env, data, 200, last_modified, function(err) {
                            if (err) {
                                console.error('Focus Framework :: staticFile() [ERROR] during sendData: ' + err);
                                self.fatalError(env);
                                return;
                            }
                            self.sendData(env);
                        });
                    }
                    else {
                        self.notModified(env, last_modified);
                    }
                }
                else {
                    self.sendData(env, data, 200, last_modified, function(err) {
                        if (err) {
                            console.error('Focus Framework :: staticFile() [ERROR] during sendData: ' + err);
                            self.fatalError(env);
                            return;
                        }
                        self.sendData(env);
                    });
                }
            }
        });
    }
    catch (err) {
        console.error('Focus Framework :: staticFile() [ERROR] during fs.readFile: ' + err);
        self.notFound(env);
        return;
    }

    self.stats.file++;

    return self;
}

Framework.prototype.notModified = function(env, append_headers, callback) {
    var self = this;

    append_headers = append_headers || null;

    self.sendAndClose(env, 304, "notModified", append_headers);

    if (callback) {
        callback();
    }

    return self;
}

Framework.prototype.noDirListing = function(env, callback) {
    var self = this;

    var body = '<html><head></head><body><div style="margin: auto; text-align: center; margin-top: 25px;">';
        body += '<b>Forbidden</b><BR>You don\'t have permission to access ' + env.url + ' on this server.';
        body += '</div></body></html>';

    self.sendAndClose(env, 403, body);

    if (callback) {
        callback();
    }

    return self;
}

module.exports = function(config) {
    return new Framework(config);
}
