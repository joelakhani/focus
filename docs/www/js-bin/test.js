var util = require('util');

//[ ] - add expiry to seesion_redis after .set().

var _renderWithContent = function(content, plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.render('index.js', {content: content}, function(err, template) {
        if (err) {
            console.log(err);
            script.done();
            return;
        }
        
        web.echo(template);
        script.done();
    });

    return;
};

module.exports._enter_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;
    var sessions = plugins.session;

    web.session = sessions.start();

    web.requestStorage.sum = 42;

    script.done();
};

module.exports.index = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var content =  '<div><h3>Index! This is the default action for this controller.</h3><hr><div>You can use the menus on the right to demo the various FW functions.</div></div>';
    web.render('index.js', {content: content}, function(err, template) {
        if (err) {
            console.log(err);
            script.done();
            return;
        }
        
        web.echo(template);
        script.done();
    });

    return;
};

module.exports.handler = function(plugins) {
    var content =  '<div><h3>Handler!</h3><hr><div>You may want to develop multiple small function APIs<BR>Use an internal handler by returning it as a function...<BR><BR>See the export for sessions</div></div>';
    return _renderWithContent(content, plugins);
};

module.exports.upload = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var content =  '<div><h3>Upload</h3><hr><div></div><BR>';
        content += '<form id="uploader" enctype="multipart/form-data" action="/test/upload" method="post"> <input type="file" name="file1"><br>';
        content += '<input type="file" name="file2"><br> <input type="submit" name="submit" value="Upload"> <input type="hidden" name="test" value="value"></form><BR><BR>';
        if (web.method == "post") {
            content += '<pre>File Data:<BR>';
            content += JSON.stringify(web.getForm('files'), null, "    "); //test getQuery to see what it return when asked for 'files'
            content += '</pre>';
        }
        content += '</div>';

    return _renderWithContent(content, plugins);
};

module.exports.session = function(plugins) {
    var web = plugins.web;
    var sessions = plugins.session;

    if (web.session.count === undefined) {
        web.session.count = 1;
    }
    else {
        web.session.count++;
    }

    if (web.getQuery('destroy') == 1) {
        sessions.destroy();
        return _renderWithContent('<div><h3>Sessions!</h3><hr><div></div><BR><a href="/test/session">Sessions</a></div>', plugins);
    }

    return _renderWithContent('<div><h3>Sessions!</h3><hr><div>web.session.count: '+web.session.count+'</div><BR><a href="/test/session?destroy=1">Kill Session</a></div>', plugins);
};

module.exports.landing = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var content =  '<div><h3>Landed! You should be able to reach this page after being redirected.</h3><hr><div><a href="/test/redirect">Redirect</a></div></div>';
    web.render('index.js', {content: content}, function(err, template) {
        if (err) {
            console.log(err);
            script.done();
            return;
        }
        
        web.echo(template);
        script.done();
    });

    return;
};

module.exports.redirect = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.redirect('/' + web.controller + '/landing');
};

module.exports.rendering = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var sandbox = {id: 'id_1', i: 0, profile_image_url: 'obj_1_profile_image', from_user: 'id_1_from_user', users: [
                    {url: 'user1_url', name: 'user1_name'},
                    {url: 'user2_url', name: 'user2_name'},
                    {url: 'user3_url', name: 'user3_name'}
                ], text: "object text"
    };

    String.prototype.escapeHTML = function() { return this.replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/"/g,'&quot;') }

    web.render('template.js', sandbox, function(err, template) {
        if (err) {
            console.log(err);
            script.done();
            return;
        }

        var content =  '<div><h3>Rendered:</h3><hr><div>'+template.escapeHTML()+'</div><BR><div>With: <pre>'+JSON.stringify(sandbox)+'</pre></div></div>';
        web.render('index.js', {content: content}, function(err, template) {
            if (err) {
                console.log(err);
                script.done();
                return;
            }
            
            web.echo(template);
            script.done();
        });
    });

    return;
};

module.exports.logging = function(plugins) {
    var script = plugins.script;
    var web = plugins.web;

    var sandbox = {id: 'id_1', i: 0, profile_image_url: 'obj_1_profile_image', from_user: 'id_1_from_user', users: [
                    {url: 'user1_url', name: 'user1_name'},
                    {url: 'user2_url', name: 'user2_name'},
                    {url: 'user3_url', name: 'user3_name'}
                ], text: "object text"
    };

    script.log("info", "Info");
    script.log("error", "Error");
    script.log("debug", sandbox);
    script.log("Some random string");
    script.log("info", "Logging in with: " + web.localConfig.thirdPartyKey);

    var content =  '<div><h3>Logging</h3><hr><div>See the consoler or error logs if running as a daemon. . .</div></div>';
    return _renderWithContent(content, plugins);
};

module.exports.badfile = function(plugins) {
    var script = plugins.script;
    var web = plugins.web;

    script.log("This function will fail since we forgot a parameter and sendFile doesn't get a good callback.");

    web.sendFile("/tmp/baaaaad.xyz", function(err, retCode) {
        if (err) {
            script.log("It should demonstrate what happens when an error gets thrown during execution.");
        }
        else {
            script.done();
        }
    });

    script.wait();
};

module.exports.sendfile = function(plugins) {
    var content =  '    <div>';
        content += '        <h3>Send File</h3><hr>';
        content += '        Copy a file to /tmp and put the full path / file name in the field below. Click "Download"';
        content += '        <form method="get" action="/test/getfile">';
        content += '            <input type="text" name="name" style="width: 500px;" value="/tmp/file.png"><BR>';
        content += '            <button type="submit">Download</button>';
        content += '        </form>';
        content += '    </div>';

    return _renderWithContent(content, plugins);
};

module.exports.getfile = function(plugins) {
    var script = plugins.script;
    var web = plugins.web;

    var getFile = web.getQuery('name'); 
    //var getDirect = web.query['name'] || null;  //You can also use query strings directly from the environment.

    if (!getFile) {
        web.echo("name required!");
    }
    else {
        web.sendFile(getFile, "file.dl", function(err, bytesSent) {
            if (err) {
                web.echo("getfile error: " + err);
                script.done();
                return;
            }

            script.log("info", "Sent: " + bytesSent + " bytes");

            script.done();
            return;
        });
    }

    return;
};

module.exports.cleaninput = function(plugins)
{
    var script = plugins.script;
    var web = plugins.web;

    web.setHeader('X-XSS-Protection', '0');

    if (web.getPost('cleanit') == 'true') {
        web.cleanInput();                   //to clean script wide put this call in controllers module.exports._enter_
    }

    var content =  '    <div>';
        content += '        <h3>Clean Input</h3><hr>';
        content += '        <form method="post" action="/test/cleaninput">';
        content += '            <textarea name="text" rows="5" style="width: 500px;"><div><script>alert(\'validation!!\')</script></div></textarea><BR>';
        content += '            <input type="checkbox" name="cleanit" value="true" checked>Clean Input<BR>';
        content += '            <button type="submit">Submit</button>';
        content += '        </form>';
        content += '    </div>';

    if (web.method == "post") {
        content += '    <div>';
        content += '        <h3>Output</h3><hr>';
        content += JSON.stringify(web.post_data, null, "    ");
        content += '    </div>';
    }

    web.render('index.js', {content: content}, function(err, template) {
        if (err) {
            console.log(err);
            script.done();
            return;
        }
        
        web.echo(template);
        script.done();
    });

    return;
};

module.exports.validator = function(plugins)
{
    var script = plugins.script;
    var web = plugins.web;

    var schema = {};
        schema['filePathValid']     = "required, file_path";
        schema['stringValid']       = "required, string, no_whitespace";
        schema['superStringValid']  = "required, superstring, maxlength 40";
        schema['alphaNumericValid'] = "required, alpha_numeric";
        schema['emailValid']        = "email, maxlength 24";

    var content =  '    <div>';
        content += '        <h3>Validate Input - See documentation for full list of validators</h3><hr>';
        content += '        <form method="post" action="/test/validator">';
        content += '            <input type="text" name="filePathValid" value="/some/valid/path" style="width: 25%"><pre style="width: 25%; display: inline-block;"> filePathValid</pre>';
        content += '            [<a href="javascript: void(0);" onclick="javascript: document.forms[0].elements.namedItem(\'filePathValid\').name=\'_filePathValid\';">Remove</a>] (Will trigger the "required" failure)<BR>';
        content += '            <input type="text" name="stringValid" value="So.string,much-simple." style="width: 25%"><pre style="width: 25%; display: inline-block;"> stringValid</pre>';
        content += '            [<a href="javascript: void(0);" onclick="javascript: document.forms[0].elements.namedItem(\'stringValid\').name=\'_stringValid\';">Remove</a>]<BR>';
        content += '            <input type="text" name="superStringValid" value="So string, (more)[meta] much simple." style="width: 25%"><pre style="width: 25%; display: inline-block;"> superStringValid</pre><BR>';
        content += '            <input type="text" name="alphaNumericValid" value="onlyalpha123" style="width: 25%"><pre style="width: 25%; display: inline-block;"> alphaNumericValid</pre><BR>';
        content += '            <input type="text" name="emailValid" value="bob@mailinator.com" style="width: 25%"><pre style="width: 25%; display: inline-block;"> emailValid</pre><BR>';
        content += '            <button type="submit">Submit</button>';
        content += '        </form>';
        content += '    </div>';
        content += '    <div>';
        content += '        <hr style="width: 80%; margin: 15px;">';
        content += '        Schema Object: <pre>'+JSON.stringify(schema, null, "    ")+'</pre>';
        content += '    </div>';

    if (web.method == "post") {
        var checkFields = web.validate(schema, web.post_data);
        content += '    <div>';
        content += '        <h3>Results</h3><hr style="width: 80%; margin: 15px;">';

        if (checkFields !== true) {
            content += 'Failed: <pre>'+checkFields.join(', ')+'</pre>';
        }
        else {
            content += 'Passed!';
        }

        content += '    </div>';
    }

    return _renderWithContent(content, plugins);
}

module.exports.cookies = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var content =  '<div><h3>Cookies</h3><hr><div>Use the links below to set or get the value of the cookie: "monster"<BR><a href="/test/cookies?action=set">Set Cookie</a> | <a href="/test/cookies?action=get">Get Cookie</a><BR></div></div>';

    var getAction = web.getQuery('action');
    if (getAction !== null) {
        switch(getAction.toLowerCase()) {
            case 'get':
                var monster = web.getCookie('monster');
                var direct = web.cookies['monster'];

                content += "<div><BR><pre>web.getCookie('monster'); returned: "+monster+"</pre><BR>";
                content += "<pre>web.cookies['monster']; returned: "+direct+"</pre></div>";
            break;

            case 'set':
            default:
                var setString = "" + String.fromCharCode(Math.floor((Math.random() * 26) + 1) + 97) + String.fromCharCode(Math.floor((Math.random() * 26) + 1) + 97) + String.fromCharCode(Math.floor((Math.random() * 26) + 1) + 97);
                web.setCookie('monster', setString);

                content += "<div><BR><pre>web.setCookie('monster', '"+setString+"');</pre></div>";
        }
    }
    else {
        content += "<div><BR>Please select an action.</div>";
    }

    return _renderWithContent(content, plugins);
};

module.exports.reqstore = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var content =  '    <div>';
        content += '        <h3>Request Storage:</h3><hr>';

        if (web.requestStorage.sum !== undefined) {
            content += "Request Storage: " + web.requestStorage.sum;
        }
        else {
            content += "Request storage not set.";
        }

        content += '    </div>';

    web.render('index.js', {content: content}, function(err, template) {
        if (err) {
            console.log(err);
            script.done();
            return;
        }
        
        web.echo(template);
        script.done();
    });

    return;
}

module.exports._exit_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    script.done();
}

module.exports.signin = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.echo("Start long pretent query. . . ");
    setTimeout(function() {
        web.echo("Finish long pretent query");
        script.done();
    }, 2500);

    script.wait();
}
