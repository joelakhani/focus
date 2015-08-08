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

function Environment(req, res, post_data, callback) {
    var self = this;

    req = req || null;
    res = res || null;
    post_data = post_data || null;
    callback = callback || null;

    if ((!req) || (!res) || (!callback)) {
        console.error('Focus Environment :: _init_() Invalid parameters. Probably Fatal.');
        return null;
    }

    var mfw = {};  //micro framework, used to help make decisions on where processing goes next.

    mfw.req = req;
    mfw.res = res;

    (function(req, res) {
        var request_url_obj = url.parse(req.url, true);

        var rea = request_url_obj.pathname.split('/');
        var query_dict = request_url_obj.query;
        var hash = request_url_obj.hash;

        var mvc = [];
        var um = [];

        for (var x = 0; x < rea.length; x++) { if (rea[x] != '') mvc.push(rea[x]); }

        if (mvc.length) {
            if (mvc.length > 0) {
                mfw.controller = mvc[0];
            }

            if (mvc.length > 1) {
                mfw.action = mvc[1];
            }

            if (mvc.length > 2) {
                for (var x = 2; x < mvc.length; x++) {
                    um.push(mvc[x]);
                }
            }

            mfw.urlMap = um;
        }


        if (mvc.length) {
            var reqFile = mvc[mvc.length-1].split('.')
            if (reqFile.length > 1) {
                switch( reqFile[reqFile.length-1].toLowerCase() )
                {
                    case 'css':
                        mfw.requestExtension = "text/css; charset=utf-8";
                    break;

                    case 'js':
                        mfw.requestExtension = "text/javascript; charset=utf-8";
                    break;

                    case 'csv':
                        mfw.requestExtension = "text/csv; charset=utf-8";
                    break;

                    case 'txt':
                        mfw.requestExtension = "text/plain; charset=utf-8";
                    break;

                    case 'xml':
                        mfw.requestExtension = "text/xml; charset=utf-8";
                    break;

                    case 'json':
                        mfw.requestExtension = "application/json; charset=utf-8";
                    break;

                    case 'png':
                        mfw.requestExtension = "image/png;";
                    break;

                    case 'jpg':
                        mfw.requestExtension = "image/jpeg;";
                    break;

                    case 'jpeg':
                        mfw.requestExtension = "image/jpeg;";
                    break;

                    case 'gif':
                        mfw.requestExtension = "image/gif;";
                    break;

                    case 'svg':
                        mfw.requestExtension = "image/svg+xml;";
                    break;

                    case 'pdf':
                        mfw.requestExtension = "application/pdf;";
                    break;

                    default:
                        mfw.requestExtension = "text/html; charset=utf-8";
                }
            }
        }

        var cookies = {};

        req.headers.cookie && req.headers.cookie.split(';').forEach(function(cookie) {
            var split = cookie.split('=');
            cookies[split[0].trim()] = decodeURIComponent((split[1] || "").trim());
        });


        var set_cookies = function() {
            var cookie_set = [];
            return function(name, value, expires, domain, secure, httponly, path) {
                name = name || null;
                value = value || null;
                expires = expires || 0; //end of session  //( Math.floor(new Date().getTime() / 1000) + 3600) //one hour.
                domain = domain || null;
                secure = secure || false;
                httponly = httponly || false;
                path = path || '/';

                //if they're providing a cookie like 86400 then they want now + a day. otherwise use the unix date.
                if (expires > 0) {
                    if (expires < 1234567890)
                        expires += Math.floor(new Date().getTime() / 1000);
                }

                if (name == null) {
                    return cookie_set;
                }

                var cookie = "";

                if (value) {
                    cookie = escape(name.toString().trim()) + '=' + escape(value.toString().trim()) + '; ';
                }
                else {  //probably deleting a cookie;
                    cookie = escape(name.toString().trim()) + '=;'
                }

                if (domain) {
                    cookie += "Domain=" + escape(domain.trim()) + '; ';
                }

                if (value) {
                    if (expires) {
                        cookie += "Expires=" + new Date(expires * 1000).toUTCString() + '; ';
                    }
                }
                else {
                    cookie += "Expires=" + "Thu, 01 Jan 1970 00:00:00 GMT" + '; ';
                }

                if (secure) {
                    cookie += "Secure; ";
                }

                if (httponly) {
                    cookie += "HttpOnly; ";
                }

                cookie += "Path=" + escape(path.trim());

                cookie_set[name] = cookie;

                return cookie_set;
            };
        };

        mfw.connected = true;           //Can change via the plugins or FW. If set by an action the connection will stop
        mfw.chunkedResponse = '';
        mfw.setCookie = set_cookies();
        mfw.query = query_dict;
        mfw.cookies = cookies;
        mfw.inBytesRead = req.socket.bytesRead;
        mfw.inBytesWritten = req.socket.bytesWritten;
        mfw.outBytesRead = res.socket.bytesRead;
        mfw.outBytesWritten = res.socket.bytesWritten;
        mfw.httpVersion = req.httpVersion;
        mfw.httpVersionMajor = req.httpVersionMajor;
        mfw.httpVersionMinor = req.httpVersionMinor;
        mfw.url = req.url;
        mfw.pathname = request_url_obj.pathname;
        mfw.method = req.method.toLowerCase();
        mfw.userAgent = req.headers['user-agent'];
        mfw.remoteAddress = ( (typeof req.headers != 'undefined') && (typeof req.headers['x-forwarded-for'] != 'undefined') ? req.headers['x-forwarded-for'] : req.connection.remoteAddress);
        mfw.isAjax = false;
        mfw.referer = ( (typeof req.headers != 'undefined') && (typeof req.headers['referer'] != 'undefined') ) ? req.headers['referer'] : "none";
        mfw.proto = ( (typeof req.headers != 'undefined') && (typeof req.headers['x-forwarded-proto'] != 'undefined') ) ? req.headers['x-forwarded-proto'] : "none";

        if ( (typeof req.headers != 'undefined') && (typeof req.headers['x-requested-with'] != 'undefined') ) {
            if (req.headers['x-requested-with'] == "XMLHttpRequest") {
                mfw.isAjax = true;
            }
        }

        if ( (typeof req.headers != 'undefined') && (typeof req.headers['x-original-uri'] != 'undefined') ) {
            var ouri = url.parse(req.headers['x-original-uri'], true);
            mfw.originalQuery = ouri.query;
        }

        if (typeof req.headers != 'undefined') {
            mfw.headers = req.headers;
        }

        mfw.authUser = false;
        if ( (typeof req.headers.authorization != 'undefined') && (req.headers.authorization.search('Basic') === 0) ) {
            var credentials = new Buffer(req.headers.authorization.split(' ')[1], 'base64').toString();

            if (credentials.indexOf(':') !== -1) {
                mfw.authUser = credentials.split(':')[0];
                mfw.authPass = credentials.split(':')[1];

                if ((!mfw.authUser.length) || (!mfw.authPass.length)) {
                    delete mfw.authUser;
                    delete mfw.authPass;
                    mfw.authUser = false;
                }
            }
        }

        mfw.post_data = {};
        if (mfw.method == "post")
        {
            var content_type = req.headers['content-type'] || "application/x-www-form-urlencoded"; //.toLowerCase?

            if (content_type.toLowerCase().indexOf("application/x-www-form-urlencoded") != -1) {
                content_type = "application/x-www-form-urlencoded";
            }

            if (content_type)
            {
                switch(content_type.toLowerCase())
                {
                    case "application/x-www-form-urlencoded":
                        if (post_data) {
                            var form_data = url.format(post_data.toString());
                            mfw.post_data = querystring.parse(form_data.toString());
                        } else {
                            mfw.post_data = {};
                        }

                        callback(mfw);
                        return;
                    break;

                    default:
                        if (content_type.toLowerCase().indexOf("multipart/form-data;") == 0) //first char
                        {
                            var boundaryex = content_type.match(/boundary=(.*)/);
                            if (boundaryex) {
                                var boundary = boundaryex[1];
                                if (boundary !== 'undefined') {
                                    var startex = new RegExp("--"+boundary+"\r\n");
                                    var endex = new RegExp("--"+boundary+"--");

                                    var start_pos = post_data.search(startex);
                                    var end_pos = post_data.search(endex);

                                    var anchors = post_data.substring(start_pos, end_pos).split(startex);

                                    if (anchors.length) {
                                        (function local_iterate() {
                                            if (anchors.length === 0) {
                                                callback(mfw);
                                                return;
                                            }
                                            else {
                                                var _a = anchors.splice(0,1)[0];
                                                if (!_a.length) {
                                                    local_iterate();
                                                    return;
                                                }
                                                var pair = _a.split('\r\n\r\n');
                                                if (pair.length) {
                                                    var meta = pair[0].replace('\r\n',' ').trim();
                                                    var val = pair[1].replace('\r\n','');
 
                                                    var key = meta.match(/Content-Disposition: form-data; name="(.*?)"/);
                                                    var type = meta.match(/Content-Type: (.*?)$/);

                                                    if (key) {
                                                        if (type) {
                                                            var fname = meta.match(/filename="(.*?)"/);
                                                            if (fname) {
                                                                if (mfw.post_data.files === undefined) {
                                                                    mfw.post_data.files = {};
                                                                }

                                                                var idx = key[1].trim();
                                                                var fileType = type[1].trim();
                                                                var fileName = fname[1].trim();

                                                                if (fileName.length) {
                                                                    var now = Math.floor(new Date().getTime() / 1000);
                                                                    var rnd = Math.floor(Math.random() * now).toString(16);

                                                                    mfw.post_data.files[idx] = {};
                                                                    
                                                                    var fileEntry = mfw.post_data.files[idx];
                                                                        fileEntry['content-type'] = fileType;
                                                                        fileEntry['file-name'] = fileName;
                                                                        fileEntry['tmpFile'] = '/tmp/' + now.toString() + '__' + rnd + '__' + fileName;

                                                                        //we want an error in here as it means there is no file.
                                                                        fs.stat(fileEntry.tmpFile, function(err, stats) {
                                                                            if (err) {
                                                                                fs.writeFile(fileEntry.tmpFile, val, {encoding: 'binary'}, function(err) {
                                                                                    if (err) {
                                                                                        console.error('Focus Environment :: Warning: Unable to write in /tmp/ for incoming file: ' + fileName);
                                                                                        delete mfw.post_data.files[idx];
                                                                                    }

                                                                                    local_iterate();
                                                                                    return;
                                                                                });
                                                                            }
                                                                            else {
                                                                                console.error('Focus Environment :: Warning: File collision detected in /tmp/ for incoming file: ' + fileName);
                                                                                delete mfw.post_data.files[idx];
                                                                                local_iterate();
                                                                                return;
                                                                            }
                                                                        });
                                                                }

                                                                local_iterate();
                                                                return;
                                                            }
                                                        }
                                                        else {
                                                            mfw.post_data[key[1].trim()] = val.trim();
                                                            local_iterate();
                                                            return;
                                                        }
                                                    }
                                                } //if (pair)
                                            } //if anchor
                                        })();//local_iterate
                                    } // if (anchors.length)
                                } //if (boundary != undefined)
                            } // if (boundaryex)
                        }
                        else if (content_type.toLowerCase().indexOf("nginx/multipart/form-data;") == 0)
                        {
                            var m = content_type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
                            var boundary = m[1] || m[2];

                            var startex = new RegExp("--"+boundary);
                            var endex = new RegExp("--"+boundary+"--\r\n");

                            var start_pos = post_data.search(startex);
                            var end_pos = post_data.search(endex);

                            var chunk = new Buffer(post_data).slice(start_pos, end_pos).toString();

                            boundary = '--'+boundary+'\r\n';

                            var _r = chunk.split(boundary);

                            if (_r.length) {
                                var form_obj = {};

                                for (var x = 0; x < _r.length; x++) {
                                    if (_r[x].length){
                                        var pair = _r[x].split('\r\n\r\n');
                                        if (pair.length == 2) {
                                            var key = pair[0].match(/Content-Disposition: form-data; name="(.*?)"/)[1] || null;
                                            if (key) {
                                                var obj = key.split('.');
                                                if (obj.length > 1) {
                                                    if (form_obj[obj[0]] == undefined) {
                                                        form_obj[obj[0]] = {};
                                                    }
                                                    form_obj[obj[0]][obj[1]] = pair[1].replace('\r\n', '').trim();
                                                }
                                                else {
                                                    var val = pair[1].replace('\r\n','').trim();
                                                    if (val.length) {
                                                        form_obj[key] = val;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (Object.keys(form_obj).length == 0) {
                                    form_obj = null;
                                }
                                else {
                                    mfw.files = {};
                                    mfw.files.source = "nginx";
                                    mfw.files.number_fields = Object.keys(form_obj).length;
                                    mfw.files.details = form_obj;
                                }
                            }//if (_r.length)

                            callback(mfw);
                            return;
                        }//if (content type nginx/multipart/form-data;) //nginx upload module does things a little funny
                        else {
                            console.error('Focus Environment :: Content-Type invalid removing post data.');
                            mfw.post_data = {};
                            callback(mfw);
                            return;
                        }
                }//switch
            }// if (content_type)
        }// if (post)
        else {
            callback(mfw);
            return;
        }
    })(req, res);
}


module.exports = Environment;
