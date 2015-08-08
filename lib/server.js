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
var util = require('util');
var path = require('path');
var child_process = require('child_process');
var url = require('url');
var crypto = require('crypto');

var exiting = false;
var debug = true;

var mypid = process.pid;
var pidfile = null;

var RESOLVE_JSBIN = 1;
var RESOLVE_STATIC = 2;

var start = function(config) {
    var abs_staticPath = path.resolve(config.staticPath);
    var abs_jsbinPath = path.resolve(config.jsbinPath);
    pidfile = config.pidFile;

    var Framework = require('./focus_web')(config);
    var Worker = require('./worker');
    var Environment = require('./env');

    var plugin_list = require('./plugins');
    var plugins = {};
    try {
        for (var p in plugin_list) {
            if (plugin_list.hasOwnProperty(p)) {
                plugins[p] = require(plugin_list[p]);
            }
        }
    }
    catch(e) {
        console.log("Unable to load plugin: " + e.message);
        console.log(e.stack);
        process.exit();
    }

    var auth_list = {};
    Framework.config._auth_list = {};
    if (config.authUserFile !== undefined) {
        var _l = 0;
        if (config.authUserFile.length) {
            try {
                var auf = fs.readFileSync(config.authUserFile, 'utf8');
                var lines = auf.split(/\n|\r\n|\r/g).filter(function(l) { if (l.length) return true; });

                lines.forEach(function(line, idx) {
                    if (line.indexOf(':') != 0) {
                        var _u = line.split(':')[0];
                        var _p = line.split(':')[1];

                        if ((_u.length) && (_p.length)) {
                            auth_list[_u] = _p;
                            _l++;
                        }
                    }
                });
            }
            catch(e) {
                console.error("Unable to read config.authUserFile: " + config.authUserFile);
            }
        }
        if (_l) {
            Framework.config._auth_list = auth_list;
            console.error("Server Started: " + _l + " users from: " + config.authUserFile);
        }
    }

    function onRequest(req, res) {
        var _end = res.end;
        var _chunk = '';
        res.end = function() {
            this.emit('end');
            _end.apply(this, arguments);
        };

        res.on('end', function() {
            var remoteAddress = ( (typeof req.headers != 'undefined') && (typeof req.headers['x-forwarded-for'] != 'undefined') ? req.headers['x-forwarded-for'] : req.connection.remoteAddress);
            var log_line = util.format("%s %s [%s] \"%s %s HTTP/%s\" %s", remoteAddress,
                                                                          "-",
                                                                          new Date().toUTCString(),
                                                                          req.method,
                                                                          req.url,
                                                                          req.httpVersion,
                                                                          res.statusCode);
            console.log(log_line);
            return;
        });

        var resolver = function(env, cb) {
            env = env || null;

            if (!env) {
                return false;
            }

            var stat_target = function(target, t_cb) {
                fs.stat(target, function(err, stats) {
                    if (err) {
                        if (err.message.indexOf("ENOENT") != -1) {
                            t_cb({errno: 404, message: 'Error, Not Found (404)'}, null);
                            return;
                        }
                        t_cb({errno: 500, message: 'Error, Directory listing forbidden'}, null);
                        return;
                    }

                    t_cb(null, stats);
                    return;
                });
            };

            if (env.controller != null) {
                var jsbin_resolver = path.resolve(abs_jsbinPath + "/" + env.controller + ".js");
                var static_resolver = path.resolve(abs_staticPath + "/" + env.pathname);

                var jsbin_jail = jsbin_resolver.indexOf(abs_jsbinPath);
                var static_jail = static_resolver.indexOf(abs_staticPath);

                if ( (jsbin_jail == -1) || (static_jail == -1) ) {
                    cb({errno: 500, message: 'Error, directory traversal violation'}, null);
                    return;
                }

                //Resolution starts with static first, then js-bin
                stat_target(static_resolver, function(err, stats) {
                    if (err) {
                        if (err.errno == 404) {
                            stat_target(jsbin_resolver, function(err, stats) {
                                if (err) {
                                    cb(err, null);
                                    return;
                                }
                                cb(null, {status: RESOLVE_JSBIN, resolved: jsbin_resolver, stats: stats});
                                return;
                            });
                        }
                        else {
                            cb (err, null);
                            return;
                        }
                    }
                    else {
                        cb(null, {status: RESOLVE_STATIC, resolved: static_resolver, stats: stats});
                        return;
                    }
                });
            }
            else {
                if (config.staticIndex !== undefined) {
                    var index_resolver = path.resolve(abs_staticPath + "/" + config.staticIndex);
                    if (index_resolver.indexOf(abs_staticPath) == -1) {
                        res.statusCode = 500;
                        res.end('Error (500) || Please set config.staticIndex');
                    }
                    else {
                        stat_target(index_resolver, function(err, stats) {
                            if (err) {
                                cb(err, null);
                                return;
                            }
                            else {
                                cb(null, {status: RESOLVE_STATIC, resolved: index_resolver, stats: stats});
                                return;
                            }
                        });
                    }
                }
                else {
                    res.setHeader("Content-Type", "text/html");
                    res.statusCode = 404;
                    res.end('Not Found (404) || Please set <i>config.staticIndex</i>');
                }
            }
        };

        req.on('data', function(chunk) {
            _chunk += chunk.toString('binary');
        }).on('end', function() {
            new Environment(req, res, _chunk, function(env) {
                resolver(env, function(err, stats) {
                    if (err) {
                        switch (err.errno) {
                            case 404:
                                Framework.notFound(env);
                            break;

                            default:
                                try {
                                    Framework.fatalError(env);
                                }
                                catch(e) {
                                    console.error("Server || Script Execution: " + env.controller + ".js ["+util.inspect(err)+"]");
                                    env.res.end();
                                }
                        }
                    }
                    else {
                        switch(stats.status) {
                            case RESOLVE_STATIC:
                                Framework.staticFile(env, stats);
                            break;

                            case RESOLVE_JSBIN:
                                var init_plugins = {};
                                for (var k in plugins) {
                                    if (plugins.hasOwnProperty(k)) {
                                        init_plugins[k] = new plugins[k](Framework, env);
                                    }
                                }

                                var worker = new Worker(env, init_plugins).process_request(stats);
                            break;

                            default:
                                try {
                                    Framework.fatalError(env);
                                }
                                catch(e) {
                                    console.error("Server || Script Execution: " + env.controller + ".js [Invalid status returned from resolver()]");
                                    env.res.end();
                                }
                        }
                    }

                    return;
                });
            });
        });
    } //onRequest

    setTimeout(function() {
        try {
            http.createServer(onRequest).listen(config.port);
            console.log("Server Started: " + config.port);

            if (config.pidFile !== undefined) {
                try {
                    var json = {pid: mypid};
                    var pid = "module.exports = " + JSON.stringify(json);

                    fs.writeFileSync(config.pidFile, pid);
                }
                catch(e) {
                    console.error("Unable to write pid file: " + e);
                }
            }
        }
        catch(e) {
            console.log("Unable to start: " + e);
        }
    }, 100);
};

module.exports.start = exports = start;

process.on('SIGINT', function() {
    if (!exiting)
    {
        console.log("Exiting. . . ");

        setTimeout(function(){
            if (pidfile) {
                var pid;
                try {
                    pid = require(pidfile);
                }
                catch(e) {
                    pid = null;
                }

                if (pid) {
                    if (pid.pid == mypid) {
                        fs.unlinkSync(pidfile);
                    }
                    else {
                        console.error("Warning: focus.pid file / running process mismatch");
                    }
                }
            }

            process.exit();
        }, 1000);

        exiting = true;
    }
    else
    {
        console.log("Shutdown in progress. Please wait.");
    }
});

//Daemon mode
if (!module.parent) {
    try {
        var config = JSON.parse(process.env.config);
        module.exports.start(config);
    }
    catch (e) {
        console.log("server.js | No configuration received (" + e + ")");
        process.exit();
    }
}
