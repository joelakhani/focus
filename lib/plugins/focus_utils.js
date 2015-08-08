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

var crypto = require('crypto')
var util = require('util');

var focus_utils = {};

module.exports = focus_utils;

//Cleans in place.
//Thanks to CodeIgniter and node-validator 
//(https://github.com/chriso/node-validator)
//for string lists and regexs

focus_utils.clean = function(input)
{
    if (typeof input === 'object') {
        for (var k in input) {
            if (input.hasOwnProperty(k)) {
                input[k] = focus_utils.clean(input[k]);
            }
        }

        return input;
    }

    var no_viewable = function(i) {
        var non_viewable = [
            /%0[0-8bcef]/g,           // url encoded 00-08, 11, 12, 14, 15
            /%1[0-9a-f]/g,            // url encoded 16-31
            /[\x00-\x08]/g,           // 00-08
            /\x0b/g, /\x0c/g,         // 11,12
            /[\x0e-\x1f]/g            // 14-31
        ];

        for (var j in non_viewable) {
            i = i.replace(non_viewable[j], '');
        }

        return i;
    }

    var no_allowed = function(i) {
        var never_allowed_str = {
            'document.cookie':              '',
            'document.write':               '',
            '.parentNode':                  '',
            '.innerHTML':                   '',
            'window.location':              '',
            '-moz-binding':                 '',
            '<!--':                         '&lt;!--',
            '-->':                          '--&gt;',
            '<![CDATA[':                    '&lt;![CDATA['
        };

        var never_allowed_regex = {
            'javascript\\s*:':              '',
            'expression\\s*(\\(|&\\#40;)':  '',
            'vbscript\\s*:':                '',
            'Redirect\\s+302':              ''
        };

        for (var j in never_allowed_str) {
            i = i.replace(j, never_allowed_str[j]);
        }

        for (var j in never_allowed_regex) {
            i = i.replace(new RegExp(j, 'i'), never_allowed_regex[j]);
        }

        return i;
    }

    var no_explode = function(i) {
        var compact_words = [
            'javascript', 'expression', 'vbscript',
            'script', 'applet', 'alert', 'document',
            'write', 'cookie', 'window'
        ];

        for (var j in compact_words) {
            var spacified = compact_words[j].split('').join('\\s*')+'\\s*';

            i = i.replace(new RegExp('('+spacified+')(\\W)', 'ig'), function(m, compat, after) {
                return compat.replace(/\s+/g, '') + after;
            });
        }

        return i;
    }

    var no_js_img_a = function(i) {
        if (i.match(/<a/i)) {
            i = i.replace(/<a\s+([^>]*?)(>|$)/gi, function(m, attributes, end_tag) {
                attributes = filter_attributes(attributes.replace('<','').replace('>',''));
                return m.replace(attributes, attributes.replace(/href=.*?(alert\(|alert&\#40;|javascript\:|charset\=|window\.|document\.|\.cookie|<script|<xss|base64\s*,)/gi, ''));
            });
        }

        if (i.match(/<img/i)) {
            i = i.replace(/<img\s+([^>]*?)(\s?\/?>|$)/gi, function(m, attributes, end_tag) {
                attributes = filter_attributes(attributes.replace('<','').replace('>',''));
                return m.replace(attributes, attributes.replace(/src=.*?(alert\(|alert&\#40;|javascript\:|charset\=|window\.|document\.|\.cookie|<script|<xss|base64\s*,)/gi, ''));
            });
        }

        if (i.match(/script/i) || i.match(/xss/i)) {
            i = i.replace(/<(\/*)(script|xss)(.*?)\>/gi, '');
        }

        return i;
    }

    var no_handlers = function(i) {
        event_handlers = ['[^a-z_\-]on\\w*'];
        i = i.replace(new RegExp("<([^><]+?)("+event_handlers.join('|')+")(\\s*=\\s*[^><]*)([><]*)", 'i'), '<$1$4');

        return i;
    }

    var no_known_bad = function(i) {
        naughty = 'alert|applet|audio|basefont|base|behavior|bgsound|blink|body|embed|expression|form|frameset|frame|head|html|ilayer|iframe|input|isindex|layer|link|meta|object|plaintext|style|script|textarea|title|video|xml|xss';
        i = i.replace(new RegExp('<(/*\\s*)('+naughty+')([^><]*)([><]*)', 'gi'), function(m, a, b, c, d) {
            return '&lt;' + a + b + c + d.replace('>','&gt;').replace('<','&lt;');
        });

        i = i.replace(/(alert|cmd|passthru|eval|exec|expression|system|fopen|fsockopen|file|file_get_contents|readfile|unlink)(\s*)\((.*?)\)/gi, '$1$2&#40;$3&#41;');

        return i;
    }

    input = input.replace('\t', ' ');

    input = no_explode(input);

    input = no_viewable(input);

    input = no_allowed(input);

    input = no_js_img_a(input);

    input = no_handlers(input);

    input = no_known_bad(input);

    input = input.trim();

    return input;
}

focus_utils.validate = function(schema, input_object)
{
    input_object = input_object || null;
    schema = schema || null;

    if ((!input_object) || (!schema)) {
        return false;
    }

    var failed_fields = [];

    for (var v in schema) {
        var validators = schema[v].split(',');
        
        for (var x = 0; x < validators.length; x++) {
            var validate = validators[x].trim().toLowerCase();

            switch(validate)
            {
                case "required":
                    if (typeof input_object[v] !== 'undefined') {
                        continue;
                    } else {
                        failed_fields.push(v);
                    }
                break;

                case "file_path":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[\<\>\:\"\'\\\|\?\*]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "string":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[^\d\w\ \.\-\=\+\_\$\#\,\'\"\;\:\@\!\&\?\/]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "superstring":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[^\d\w\ \.\-\=\+\_\(\)\*\&\|\]\[\$\#\,\'\"\;\:\@\!\&\?\/]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "alpha":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[^A-Za-z]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "alpha_numeric":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[^A-Za-z0-9]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "numeric":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[^0-9]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "no_whitespace":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/[\s]/) != -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "md5":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].length != 32) {
                            failed_fields.push(v);
                        }
                        if (input_object[v] == "d41d8cd98f00b204e9800998ecf8427e") {
                            failed_fields.push(v);
                        }
                        if (input_object[v].search(/[^A-Za-z0-9]/) != -1) { 
                            failed_fields.push(v);
                        }

                        //the above md5 is an "empty" md5.

                        continue;
                    }
                break;

                case "sha1":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].length != 40) {
                            failed_fields.push(v);
                        }
                        if (input_object[v] == "da39a3ee5e6b4b0d3255bfef95601890afd80709") {
                            failed_fields.push(v);
                        }
                        if (input_object[v].search(/[^A-Za-z0-9]/) != -1) { 
                            failed_fields.push(v);
                        }

                        //the above sha1 is an "empty" sha1.

                        continue;
                    }
                break;

                case "email":
                    if (typeof input_object[v] !== 'undefined') {
                        var remail = /^([a-z0-9])(([-a-z0-9._])*([a-z0-9]))*\@([a-z0-9])(([a-z0-9-])*([a-z0-9]))+(\.([a-z0-9])([-a-z0-9_-])?([a-z0-9])+)+$/i;
                        if (input_object[v].search(remail) == -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "usphone":
                    if (typeof input_object[v] !== 'undefined') {
                        if (input_object[v].search(/^1?[. -]?[0-9]{3}[. -]?[0-9]{3}[. -]?[0-9]{4}$/) == -1) { 
                            failed_fields.push(v);
                        }
                        continue;
                    }
                break;

                case "date":
                    if (typeof input_object[v] !== 'undefined') {
                        var yyyymmdd = /^(19|20)\d\d[- \/.](0?[1-9]|1[012])[- \/.](0?[1-9]|[12][0-9]|3[01])$/;
                        var mmddyyyy = /^(0?[1-9]|1[012])[- \/.](0?[1-9]|[12][0-9]|3[01])[- \/.](19|20)\d\d$/;
                        var ddmmyyyy = /^(0?[1-9]|[12][0-9]|3[01])[- \/.](0?[1-9]|1[012])[- \/.](19|20)\d\d$/;
                        if (input_object[v].search(yyyymmdd) == -1) { 
                            if (input_object[v].search(mmddyyyy) == -1) { 
                                if (input_object[v].search(ddmmyyyy) == -1) { 
                                    failed_fields.push(v);
                                }
                            }
                        }
                        continue;
                    }
                break;

                default:
                    if (validate.indexOf("maxlength") != -1)
                    {
                        if (typeof input_object[v] !== 'undefined') {
                            var vlength = validate.split(" ")[1];
                            if (typeof vlength !== 'undefined') {
                                if (input_object[v].length > parseInt(vlength, 10)) {
                                    failed_fields.push(v);
                                }
                            }
                            else {
                                failed_fields.push("maxlength invalid length.");
                            }

                            continue;
                        }
                    }
                    else
                    {
                        failed_fields.push("Unrecognized Validator: " + validate);
                    }
            }//switch
        }//for validators
    }//for v in schema

    if (failed_fields.length) {
        return failed_fields;
    }

    return true;
};

focus_utils.isObject = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object Object]' )
};

focus_utils.isArray = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object Array]' ) 
};

focus_utils.isFunction = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object Function]' ) 
};

focus_utils.isString = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object String]' )
};

focus_utils.isDate = function(check_me) {
	check_me = check_me || null;

    return ( Object.prototype.toString.call(check_me) == '[object Date]' )
};

focus_utils.copyObjectProperty = function(prop_name, source_obj, dest_obj, copy_as) {
    prop_name = prop_name || null;
    source_obj = source_obj || null;
    dest_obj = dest_obj || null;

    if ( (!prop_name) || (!source_obj) || (!dest_obj) ) {
        return false;
    }

    var source_type, target_type;
    if (source_obj[prop_name] !== undefined) {
        var source_type = Object.prototype.toString.call(source_obj[prop_name]);
    }
    else {
        return false;
    }

    if (copy_as !== undefined) {
        target_type = Object.prototype.toString.call(copy_as);
        copy_as = true;
    } 
    else {
        target_type = source_type;
    }

    var local_copy;
    if (copy_as) {
        switch(target_type) {
            case '[object Object]':
                return false;
            break;

            case '[object Array]':
                if (source_type == '[object Array]') {
                    local_copy = source_obj[prop_name];
                }
                else {
                    local_copy = [ source_obj[prop_name] ];
                }
            break;

            case '[object String]':
                local_copy = String(source_obj[prop_name]);
            break;

            case '[object Number]':
                local_copy = Number(source_obj[prop_name]);
                if (isNaN(local_copy)) {
                    return false;
                }
            break;

            case '[object Boolean]':
                local_copy = Boolean(source_obj[prop_name]);
            break;

            case '[object Date]':
                local_copy = new Date(source_obj[prop_name]);

                if (isNaN(local_copy.getTime())) {
                    return false;
                }
            break;

            case '[object RegExp]':
                try {
                    local_copy = new RegExp(source_obj[prop_name]);
                }
                catch(e) {
                    return false;
                }
            break;

            case '[object Null]':
                local_copy = null;
            break;

            default:
                return false;
        }//switch
    }//if (copy_as)
    else {
        local_copy = source_obj[prop_name];
    }

    if (target_type == '[object String]') {
        if (source_obj[prop_name] == '') {
            return false;
        }
        else {
            dest_obj[prop_name] = local_copy;
            return true;
        }
    }
    else {
        dest_obj[prop_name] = local_copy;
        return true;
    }

    return false;
}

//helper function to do things like send encrypted form elements or data to clients. 
focus_utils.cryptoEncode = function(input, password)
{
    input = input || null;
    password = password || null;

    if ((!input) || (!password)) {
        return;
    }

    var inmsg = input.match(/(.{1,8})/g);
    var outmsg = [];

    var encryptor = crypto.createCipher('aes192', password);

    for (var x = 0; x < inmsg.length; x++) {
        outmsg.push(encryptor.update(inmsg[x], "binary", "base64"));
    }
    
    outmsg.push(encryptor.final('base64'));

    delete encryptor;

    var preout = outmsg.join('');

    return preout;
};

focus_utils.cryptoDecode = function(input, password)
{
    input = input || null;
    password = password || null;

    if ((!input) || (!password)) {
        return;
    }

    var outmsg = [];

    var decryptor = crypto.createDecipher('aes192', password);
    outmsg.push(decryptor.update(input, 'base64', 'binary'));

    outmsg.push(decryptor.final('binary'));

    delete decryptor;

    var preout = outmsg.join('');

    return preout;
};

focus_utils.toHex = function(input)
{
    input = input || null;

    if (input) {
        var _type = Object.prototype.toString.call(input);

        if (_type == "[object Number]") {
            return input.toString(16);
        }
        else if (_type == "[object String]") {
            var _accum = "";

            for (var x = 0; x < input.length; x++) {
                _accum += input.charCodeAt(x).toString(16);
            }

            if (_accum.length) {
                return _accum;
            }
        }
    }

    return null;
};

focus_utils.unHex = function(input)
{
    input = input || null;

    if (input) {
        var _type = Object.prototype.toString.call(input);

        if (_type == "[object Number]") {
            return String.fromCharCode("0x"+input);
        }
        else if (_type == "[object String]") {
            if (input.length % 2)
                return null;

            var _accum = "";

            for (var x = 0; x < input.length; x+=2) {
                _accum += String.fromCharCode("0x"+input.substring(x, x+2));
            }

            if (_accum.length) {
                return _accum;
            }
        }
    }

    return null;
};

focus_utils.extend = function()
{
    var src, copyIsArray, copy, name, options, clone,
    target = arguments[0] || {},
    i = 1,
    length = arguments.length,
    deep = false;

    if ( typeof target === "boolean" ) {
        deep = target;

        target = arguments[ i ] || {};
        i++;
    }

    if ( (!focus_utils.isObject(target)) && (!focus_utils.isFunction(target)) && (!focus_utils.isArray(target)) ) {
        target = {};
    }

    if ( i === length ) {
        target = {};
        i--;
    }

    for ( ; i < length; i++ ) {
        if ( (options = arguments[ i ]) != null ) {
            for ( name in options ) {
                src = target[ name ];
                copy = options[ name ];
                if ( target === copy ) {
                    continue;
                }

                if ( deep && copy && (focus_utils.isObject(copy) || (copyIsArray = focus_utils.isArray(copy)) ) ) {
                    if ( copyIsArray ) {
                        copyIsArray = false;
                        clone = src && focus_utils.isArray(src) ? src : [];
                    } else {
                        clone = src && focus_utils.isObject(src) ? src : {};
                    }
                    target[ name ] = focus_utils.extend( deep, clone, copy );
                } else if ( (copy !== undefined) && (!focus_utils.isFunction(copy)) ) {
                    target[ name ] = copy;
                }
            }
        }
    }

    return target;
};
