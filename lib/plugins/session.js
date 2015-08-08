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

// This is the session plugin - This session plugin uses a nv-object created
// here when this file is included (global to this context). I would not recommend
// this configuration for a production site, I would use the included session_redis.js
// of course tuning redis for your traffic / configuration. However for basic / local
// dev work this one will do the job.

var util = require('util');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

var focus_utils = require('./focus_utils');

var _memory = {};

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

    script.done();
};

Session.prototype._finish_ = function(plugins) {
    var self = this;
    var script = plugins.script;

    if (self.sessionId) {
        _memory[self.sessionId] = focus_utils.extend(true, self.sessionStore);
    }

    script.done();
};

Session.prototype.start = function() {
    var self = this;
    var db_s;
    var s_id;

    if (self.env.cookies[self.config.cookie_name] !== undefined) {
        var session_sha;
        try {
            session_sha = focus_utils.cryptoDecode(self.env.cookies[self.config.cookie_name], self.config.secret_key);
        }
        catch(e) {
            self.sessionId = null;
            self.sessionStore = {};
            self.framework.setCookie(self.env, self.config.cookie_name);
            console.error("Focus session :: _init_() Invalid cookie. Asking client to clear.");
            return {};
        }

        //if we get valid cookie and its not in memory we just accept and reset with empty session.
        if (_memory[session_sha] !== undefined) { 
            db_s = focus_utils.extend(true, _memory[session_sha]);

            var sha_break = session_sha.split('/');

            if (self.config.check_ip == true) {
                if (self.ip !== sha_break[2]) {
                    db_s = {};
                }
            }
        }
        else {
            db_s = {};
        }

        s_id = session_sha;
    }
    else {
        var _session_id = {rkey: Math.floor(Math.random() * 99),
                           dkey: Math.floor(new Date().getTime() / 1000).toString(),
                           rip: self.ip, skey: self.config.secret_key}; // - 25/date/ip/secret

         var _session_id_str = util.format("%s/%s/%s/%s", _session_id.rkey, _session_id.dkey, _session_id.rip, _session_id.skey);

         var _s_id = focus_utils.cryptoEncode(_session_id_str, self.config.secret_key);

         self.framework.setCookie(self.env, self.config.cookie_name, _s_id, self.config.expires,
                                  self.config.domain, self.config.secure, self.config.httpOnly, self.config.path);

         db_s = {};
         s_id = _session_id_str;
    }

    self.sessionStore = focus_utils.extend(true, db_s);
    self.sessionId = s_id;

    return self.sessionStore;
}

Session.prototype.destroy = function() {
    var self = this;

    if (self.sessionId !== null) {
        delete _memory[self.sessionId];
        self.sessionId = null;
        self.sessionStore = {};
    }

    self.framework.setCookie(self.env, self.config.cookie_name);

    return self;
};

module.exports = Session;
