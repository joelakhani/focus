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

var focus_utils = require('./focus_utils');

var ioredis = require('ioredis');
var redisConfig = {
    port: 6379,
    host: '127.0.0.1',
    db: 9,             //This plugin will flush the db it connects to, change if conflict
    password: null,
    autoResendUnfulfilledCommands: false,
    retryStrategy: function(times) {
        if (times < 5) {
            return 1000;
        }
        else {
            console.error("session_redis :: FATAL! Unable to connect to redis.");
        }
    }
};

var _redis = new ioredis(redisConfig).on('error', function(e) {
    if (e.code == 'ECONNREFUSED') {
        console.error("session_redis :: Unable to connect to redis. Retrying...");
    }
}).once('ready', function() {
    _redis.flushdb();
});

function Session(framework, env) {
    var self = this;

    self.env = env;
    self.framework = framework;
    self.localConfig = framework.config.localConfig;

    self.config = {};
    self.config.cookie_name = 'focus_session_id';
    self.config.expires = 86400; //1 day.
    self.config.path = '/';
    self.config.domain = null;
    self.config.httpOnly = true;
    self.config.secure = false;
    self.config.check_ip = true;
    self.config.secret_key = 'fLuXc@p@c170r';

    self.ip = env.remoteAddress;

    self.sessionId = null;
    self.sessionStore = {};
};

Session.prototype._init_ = function(plugins) {
    var self = this;
    var script = plugins.script;

    var finish_init = function(output) {
        output = output || "";

        if (output.length) {
            script.log(output);
        }
        script.done();
        return;
    };

    //This engages redis if they are presenting a cookie
    if (self.env.cookies[self.config.cookie_name] !== undefined) {
        var session_sha;
        try {
            session_sha = focus_utils.cryptoDecode(self.env.cookies[self.config.cookie_name], self.config.secret_key);
        }
        catch(e) {
            self.sessionId = null;
            self.sessionStore = {};
            self.framework.setCookie(self.env, self.config.cookie_name);
            return finish_init("session_redis :: _init_() Invalid cookie. Asking client to clear.");
        }

        if (_redis.status == "ready") {
            _redis.get(session_sha, function(err, result) {
                if (err) {
                    return finish_init("session_redis :: _init_() Unable to retrieve session_sha ("+err+")");
                }
                if (result == null) {
                    self.framework.setCookie(self.env, self.config.cookie_name);

                    self.sessionStore = {};
                    self.sessionId = null;

                    return finish_init("session_redis :: _init_() Session Expired from DB.");
                }
                else {
                    self.sessionId = session_sha;
                    try {
                        self.sessionStore = JSON.parse(result);
                    }
                    catch(e) {
                        script.log("error", "session_redis :: _init_() Unable to restore session data.");
                        self.sessionStore = {};
                    }
                }

                return finish_init();
            });
        }
        else {
            return finish_init("session_redis :: _init_() Redis not ready! Unable to get session.");
        }
    }
    else {
        script.done();
        return;
    }
};

Session.prototype._finish_ = function(plugins) {
    var self = this;
    var script = plugins.script;

    if (self.sessionId) {
        if (_redis.status == "ready") {
            _redis.set(self.sessionId, JSON.stringify(self.sessionStore));
            _redis.expire(self.sessionId, self.config.expires);
        }
        else {
            self.destroy();
            script.log("session_redis :: _init_() Redis not ready! Unable to get session.");
        }
    }

    script.done();
};

Session.prototype.session_id = function() {
    var self = this;

    var _session_id = {rkey: Math.floor(Math.random() * 99),
                       dkey: Math.floor(new Date().getTime() / 1000).toString(),
                       rip: self.ip, skey: self.config.secret_key}; // - 25/date/ip/secret

     var _session_id_str = util.format("%s/%s/%s/%s", _session_id.rkey, _session_id.dkey, _session_id.rip, _session_id.skey);

     return _session_id_str;

     var _s_id = focus_utils.cryptoEncode(_session_id_str, self.config.secret_key);

     return _s_id;
};

Session.prototype.start = function() {
    var self = this;
    var session_sha = "";

    if (self.env.cookies[self.config.cookie_name] == undefined) {
        session_sha = self.session_id();

        var client_s = focus_utils.cryptoEncode(session_sha, self.config.secret_key);

        self.framework.setCookie(self.env, self.config.cookie_name, client_s, self.config.expires,
                                  self.config.domain, self.config.secure, self.config.httpOnly, self.config.path);

         if (_redis.status == "ready") {
             _redis.set(session_sha, JSON.stringify({}));       //new session, set blank.
             _redis.expire(session_sha, self.config.expires);
         }

         self.sessionId = session_sha;
         self.sessionStore = {};
    }
    else {
        if (self.sessionId) {
            return self.sessionStore;
        }
        else {
            self.sessionStore = {};
        }
    }

    return self.sessionStore;
};

Session.prototype.destroy = function() {
    var self = this;

    if (self.sessionId !== null) {
        if (_redis.status == "ready") {
            _redis.del(self.sessionId);
        }

        self.sessionId = null;
        self.sessionStore = {};
    }

    self.framework.setCookie(self.env, self.config.cookie_name);

    return self;
};

module.exports = Session;
