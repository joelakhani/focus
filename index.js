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
var server = require('./lib/server.js');
var net = require('net');
var fs = require('fs');

// Anything placed in the localConfig object will be available in the web object
// in js-bin scripts. e.g. web.localConfig.

var options = {
    action      : "--help",
    daemon      : false
};

var config = {localConfig:{}};
var load_config = function(file) {
    var configjs;
    try {
        configjs = require(file);
    }
    catch(e) {
        return;
    }

    if (configjs) {
        for (var c in configjs) {
            if (configjs.hasOwnProperty(c)) {
                switch(c) {
                    case 'outLog':
                    case 'errLog':
                        config[c] = configjs[c];
                        config.localConfig[c] = configjs[c];
                    break;

                    case 'env':
                        config[c] = configjs[c];
                        config.localConfig[c] = configjs[c];
                    break; 

                    case 'staticPath':
                    case 'jsbinPath':
                    case 'templates':
                    case 'port':
                    case 'daemonUid':
                    case 'daemonGid':
                    case 'staticIndex':
                    case 'jsbinIndex':
                    case 'fileRoot':
                    case 'authUserFile':
                    case 'authName':
                        config[c] = configjs[c];
                    break;

                    default:
                        config.localConfig[c] = configjs[c];
                }
            }
        }
    }
}

load_config('./config');
load_config('./local_config');
// If you have more object data you wish to expose in web.localConfig you can add your 
// custom config files after this line. Any setting given will override previous of same name.

(function() {
    var _pv = process.argv;
    var shim = process.argv[1];
    var local_opts = process.argv.splice(process.argv.indexOf(shim) + 1);

    options.shim = shim;

    if (local_opts.length) {
        options.action = local_opts.shift();
        options.params = []; var y = 0;

        for (var x = 0; x < local_opts.length; x++) {
            switch(local_opts[x]) {
                case '-c':
                    if (options.action == 'htpasswd') {
                        options.htpasswdCreate = true;
                    }
                break;

                case '-n':
                    if (options.action == 'htpasswd') {
                        options.htpasswdOutput = true;
                    }
                break;

                case '-d':
                case '--daemon':
                    options.daemon = true;
                break;

                default:
                    options.params[y++] = local_opts[x];
            }
        }
    }
})();

switch(options.action) {
    case 'start':
        if (options.daemon) {
            try {
                var pid
                try {
                    pid = require(config.pidFile);
                }
                catch(e) {
                    pid = null;
                }

                if (!pid) {
                    var env = process.env;
                    var daemon, outFD, errFD;

                    process.setgid(config.daemonGid);
                    process.setuid(config.daemonUid);

                    outFD = fs.openSync(config.outLog, 'a');
                    errFD = fs.openSync(config.errLog, 'a');

                    env.config = JSON.stringify(config);

                    daemon = require('child_process').spawn(process.execPath, ['lib/server.js'], {
                                                                    stdio: ['ignore', outFD, errFD], 
                                                                    uid: config.daemonUid,
                                                                    gid: config.daemonGid,
                                                                    env: env,
                                                                    detached: true
                    });

                    daemon.on('exit', function(code) {
                        console.error('Focus daemon quit unexpectedly with exit code %d', code);
                    });

                    daemon.unref();

                    setTimeout(function() {
                        process.exit();
                    }, 1500);

                    return;
                }
                else {
                    console.error("Unable to start focus web server (already running): " + pid.pid);
                    process.exit();
                }
            }
            catch(e) {
                console.log(["Unable to start in daemon mode: " + e,''].join('\n'));
            }
        }
        else {
            server.start(config);
        }
    break;

    case 'stop':
    case 'status':
        var pid
        try {
            pid = require(config.pidFile);
        }
        catch(e) {
            pid = null;
        }

        if (pid) {
            if (options.action == "status") {
                console.log("Focus web server: Running ("+pid.pid+")");
            }
            else if (options.action == "stop") {
                console.log("Focus web server: Stopping ("+pid.pid+")");
                try {
                    var bailer = 0;
                    (function waitOnExit() {
                        process.stdout.write('.');
                        var exists = fs.existsSync(config.pidFile);
                        if (exists) {
                            if (bailer++ < 5) {
                                setTimeout(waitOnExit, 500);
                            }
                            else {
                                console.log("Web server not stopped. Check for process; see: " + config.pidFile);
                            }
                        }
                        else {
                            console.log("\nFocus web server: stopped.");
                        }
                    })();

                    process.kill(pid.pid, 'SIGINT');
                }
                catch(e) {
                    console.log("Process not found. Old pid file?");
                }
            }
        }
        else {
            console.log("Focus web server: Not running.");
        }
    break;

    case 'htpasswd':
        if (options.params.length < 1) {
            console.log('   htpasswd        [ -c ] passwdfile username');
            console.log('   htpasswd        [ -n ] username');
            console.log('   passwdfile and/or username required.\n');
        }
        else {
            var passwdfile, username;
            if (options.params.length == 2) {
                var passwdfile = options.params[0];
                var username = options.params[1];
            }
            else if (options.params.length == 1) {
                passwdfile = ""; 
                username = options.params[0];
            }

            var stdin = process.openStdin();
            var pwd = "";

            process.stdout.write("New password: ");
            process.stdin.setEncoding('utf8');
            process.stdin.setRawMode(true);
            process.stdin.resume(); 
            process.stdin.on('data', function(c) {
                switch (c) {
                    case "\n": 
                    case "\r": 
                    case "\u0004":
                        stdin.pause()
                        process.stdin.setRawMode(false);
                        process.stdout.write("\n");

                        if (pwd.length) {
                            var crypto = require('crypto');
                            var sha1 = crypto.createHash('sha1').update(pwd).digest("hex");
                            var data = username+':'+sha1;

                            if ((options.htpasswdOutput !== undefined) && (options.htpasswdOutput == true)) {
                                console.log(data+'\n');
                                process.exit();
                            }

                            if (passwdfile.length) {
                                var fs = require('fs');
                                if ((options.htpasswdCreate !== undefined) && (options.htpasswdCreate == true)){
                                    fs.writeFileSync(passwdfile, data+'\n', 'utf8');
                                }
                                else {
                                    try {
                                        var update = fs.readFileSync(passwdfile, 'utf8');
                                        var lines = update.split(/\n|\r\n|\r/g).filter(function(l) { if (l.length) return true; });

                                        var _isnew = true;
                                        lines.forEach(function(line, idx) {
                                            if (line.indexOf(username+':') == 0) {
                                                lines[idx] = data;
                                                _isnew = false;
                                            }
                                        });

                                        if (_isnew) {
                                            lines.push(data);
                                        }

                                        fs.writeFileSync(passwdfile, lines.join('\n')+'\n', 'utf8');
                                    }
                                    catch(e) {
                                        console.log('Unable to update ('+e.message+')');
                                    }
                                }
                            }
                            else {
                                console.log('File name required. Exiting (-n to output password)\n');
                            }
                        }
                        else {
                            console.log('No password entered. Exiting\n');
                        }

                        process.exit();
                    break;

                    case "\u0003":      //ctrl-c
                        process.exit()
                    break;

                    default:
                        pwd += c;
                    break;
                }
            });
        }
    break;

    case '-h':
    case '--help':
        var help = [
            'usage: index.js [action] [options]',
            '',
            'Focus web server controller. Stop / Status options operate when running in daemon mode',
            '',
            'actions:',
            '   start           Start web server',
            '   stop            Stop web server (Daemon mode)',
            '   status          Worker status (Daemon mode)',
            '',
            'options:',
            '   -d, --daemon    Start server in daemon mode',
            '',
            'commands:',
            '   -h, --help      So Meta, Such wow',
            '   htpasswd        [ -c ] [ -n ] passwdfile username',
            '                     -c Create the passwdfile.',
            '                     -n Display the results on standard output rather than updating a file.',
            ''
        ];

        console.log(help.join('\n'));
    break;

    default:
        console.log("Unknown Action: " + options.action);
        console.log("   Available Actions: [start|stop|status]");
        console.log("   Available Commands: [htpasswd|-h]");
}
