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

var util = require('util');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

var isFunction = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object Function]' )
};


Object.size = function(obj) {
    var s = 0, k;
    for (k in obj) { if (obj.hasOwnProperty(k)) s++; }
    return s;
};

function Worker(env, plugins) {
    var self = this;

    plugins = plugins || null;
    self.plugins = {};

    if (plugins) {
        if (Object.size(plugins) > 0) {
            for (var k in plugins) {
                self.plugins[k] = plugins[k];
            }
        }
    }
    self.env = env;
    self.stats = {
        callbacks: 0
    };
};

Worker.prototype.process_request = function(fileStats) {
    var self = this;

    fileStats = fileStats || null;

    try {
        var load_controller = require(fileStats.resolved);

        self.env.action = self.env.action || 'index';

        if (['_enter_', '_exit_'].indexOf(self.env.action) != -1) {
            self.env.action = 'index';
        }

        self.plugins.web.requestStorage = {};  //object only lives during single request.
                                              //web.localConfig is inherited from Web plugin creation. (passed through the framework)

        if (isFunction(load_controller[self.env.action])) {
            var load_set = [];
            var load_dbg = [];
            var finish_set = [];

            for (var k in self.plugins) {
                if (self.plugins.hasOwnProperty(k)) {
                    if (isFunction(self.plugins[k]['_init_'])) {
                        load_set.push(function() { self.plugins[k]['_init_'].apply(self.plugins[k], [self.plugins]) });
                        load_dbg.push(""+k+": _init_");
                    }
                }
            }

            if (isFunction(load_controller['_enter_'])) {
                load_set.push(function(){load_controller['_enter_'].apply(self, [self.plugins])});
                load_dbg.push("_enter_");
            }

            load_set.push(function(){ load_controller[self.env.action].apply(self, [self.plugins]) } );
            load_dbg.push(self.env.action);

            if (isFunction(load_controller['_exit_'])) {
                load_set.push(function(){load_controller['_exit_'].apply(self, [self.plugins])});
                load_dbg.push("_exit_");
            }

            for (var k in self.plugins) {
                if (self.plugins.hasOwnProperty(k)) {
                    if (isFunction(self.plugins[k]['_finish_'])) {
                        finish_set.push(function() { self.plugins[k]['_finish_'].apply(self.plugins[k], [self.plugins]) });
                        load_dbg.push(""+k+": _finish_");
                    }
                }
            }

            var runner = function(func, extract_dbg, callback) {
                self.plugins.script = {};

                var watchdog = setTimeout(function() {
                    console.error("Worker || Script Execution: " + self.env.controller + ".js [module.exports." + extract_dbg + "]" + " ended prematurely with watchdog timeout. Possibly missing script.done()");
                    callback(false);
                }, 2000);

                self.plugins.script.done = function() {
                    clearTimeout(watchdog);
                    watchdog = null;
                    callback(true);
                };

                self.plugins.script.wait = function() {
                    if (watchdog) {
                        clearTimeout(watchdog);
                        watchdog = setTimeout(function() {
                            callback(false);
                        }, 5000);
                    } else {
                        console.error("Worker || Script Execution: " + self.env.controller + ".js [module.exports." + extract_dbg + "]" + " script.wait() non effictive - script.done() has already been called.");
                    }
                };

                self.plugins.script.log = function(logLevel, message) {
                    var env = self.env;

                    logLevel = logLevel || null;
                    message = message || null;

                    if (!logLevel) {
                        return;
                    }
                    else {
                        if (!message) {
                            message = logLevel;
                            logLevel = "info";        //error, debug, info
                        }

                        switch(logLevel.toLowerCase()) {
                            case "info":
                                logLevel = "[INFO]";
                            break;

                            case "error":
                                logLevel = "[ERROR]";
                            break;

                            case "debug":
                                logLevel = "[DEBUG]";
                                message = "\n" + util.inspect(message);
                            break;

                            default:
                                logLevel = "[INFO]"
                        }

                        var controller = (env.controller !== undefined) ? env.controller : "-";
                        var action = (env.action !== undefined) ? env.action : "-";

                        var log_line = util.format("%s - [%s] \"%s %s\" Controller: %s || Action: %s <%s> %s",
                                                                                    env.remoteAddress,
                                                                                    new Date().toUTCString(),
                                                                                    env.method.toUpperCase(),
                                                                                    env.url,
                                                                                    controller,
                                                                                    action,
                                                                                    logLevel,
                                                                                    message);
                        console.log(log_line);
                    }
                };

                try {
                    func();
                }
                catch(e) {
                    clearTimeout(watchdog);
                    if (e.message.indexOf('_script_interrupt_') == -1) {
                        console.error("Worker || Script Execution: " + self.env.controller + ".js [module.exports." + extract_dbg + "]" + " ended: " + e.message);
                        console.error(e.stack);
                    }
                    callback(false);
                }
            };

            var finish = function(fset) {
                if (fset.length === 0) {
                    if (self.env.connected) {
                        self.plugins.web.framework.response(self.env);
                        return;
                    }
                    else {
                        self.env.res.end();
                        return;
                    }
                }
                else {
                    var extracted = fset.splice(0, 1)[0];
                    var extract_dbg = load_dbg.splice(0, 1)[0];

                    runner(extracted, extract_dbg, function(connected) {
                        if (!connected) {
                            self.env.connected = false;
                        }

                        process.nextTick(function() {
                            finish(fset);
                        });
                    });
                }
            };

            (function local_iterate() {
                if (load_set.length === 0) {        //request finished here. process all the plugin _finish_ calls.
                    finish(finish_set);
                }
                else if (self.env.connected) {
                    var extracted = load_set.splice(0, 1)[0];
                    var extract_dbg = load_dbg.splice(0, 1)[0];

                    runner(extracted, extract_dbg, function(run_next) {
                        if (run_next) {
                            process.nextTick(function() {
                                local_iterate();
                            });
                        }
                        else {
                            self.env.connected = false;
                            finish(finish_set);
                        }
                    });
                }
            })();
        }
        else {
            self.plugins.web.framework.notFound(self.env);
        }
    }
    catch(e) {
        console.error('Error during process_request: ' + e.message); //e.g. Cannot find module 'stats'
        console.error(e.stack);
        self.env.res.end();
        self.env.connected = false;
    }

    return self;
}

module.exports = Worker;
