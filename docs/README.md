# Focus Documentation

Focus is a NodeJS (Javascript) based web framework that allows you to use javascript as a primary development
language to create cgi like scripts.

Focus is different in its primary function from existing frameworks as it's main goal is to provide a complete environment 
for execution and development.  The resulting configuration is a system that uses a pre-defined directory structure and 
routing system that removes much of the visible glue and patch-work from the development of scripts.

This glue and patchwork still exist and can be modified but is setup in a default configuration that aims to be useful
to most projects. 

## Configuration

The main configuration file for the framework and server sit in the server root as 'config.js'. There are a number of 
directives that the server depends on. Any directive that is put in this file will become available to scripts during 
script execution. The following is a list of configuration options:

    outLog       - Full path to the output log
    errLog       - Full path to the error log
    env          - "production" | "development" (Make decisions based on deployment configuration)
    staticPath   - Full path of static base directory (htdocs)
    jsbinPath    - Full path of "cgi" directory .e.g. /home/me/web/js-bin
    templates    - Full path of templates directory (web.template sources from here)
    port         - Such port, much web.
    daemonUid    - Daemon user id (Run in daemon mode)
    daemonGid    - Daemon group id
    staticIndex  - Default index directive (index.html makes a good default)
    fileRoot     - Full path to the base directory for file downloads .i.e sendFile() (Restriction)
    pidFile      - Full path to pid file used for daemon mode

    authUserFile - Full path to the auth user file (run index.js --help for more info)
    authName     - Basic auth challenge / realm

If you include configuration options not in the list above, they will be available during script execution through 
the default web plugin via localConfig. For example if in your config.js file you have an entry:

    config.thirdPartyKey = "MIIBCkGKAQWMuchMetaSuchKey==";

You could use this in your script execution with a line like:

    script.log("info", "Logging in with: " + web.localConfig.thirdPartyKey);

### local_config.js ###

There is also an option to override this file. If you have a file in the root directory called `local_config.js` 
the configuration options from this file will over ride the options from config.js. As with other dev/prod 
patterns config.js can be checked into source control with production settings while keeping `local_config.js` 
in a local environment for splitting things like prod and test keys

# Getting Started - Writing Scripts

One of the objectives is to be able to translate a current project to easily output to web.

Pre Conversion (some project.js file):

```js
#!/usr/local/node/bin/node

var util = require('util');

var some_func = function(stuffs, callback) {
    // I'm doing some development task with stuffs.
};

some_func(some_ary, function(err, data) {
    console.log("Some interesting data: " + data);
});
```

Post Conversion:

```js
#!/usr/local/node/bin/node

var util = require('util');

var some_func = function(stuffs, callback) {
    // I'm doing some development task with stuffs.
};

module.exports = function(callback) {
    some_func(some_ary, function(err, data) {
        //console.log("Some interesting data: " + data);
        callback(data);
    });
}
```    

Now to get the results from my project perhaps in JSON for graphing, I would create a new file in js-bin.

```js
module.exports.index = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var get_chart_data = require('/path/to/project.js');

    web.responseIsJSON();

    get_chart_data(function(data) {
        web.echo(JSON.stringify(data));
        script.done();
    });
};
```

Beyond just translating current projects, of course writing web based services in JavaScript makes for easy development.
Focus has two primary methods of handling requests. The 'Script Request' method uses the full framework and routing to 
deliver requests to target scripts and executing in a familiar MVC type pattern. For example:

```js
module.exports.sayhello = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var name = web.getQuery('name');
    if (!name) {
        web.echo("Hello World");
    }
    else {
        web.echo("Hello " + name + "!");
    }

    script.done();
};
```

Naming the script above sample.js creates a new controller: sample (in MVC terms) and gives it a new action: sayhello. 
Calling the above script with its action and controller:

    http://localhost:8080/sample/sayhello

Will result in the output:

    Hello World

You may also notice we are making use of the web object from within the script, this object will be present in our 
environment and passed into the script by the default argument (see plugins).

    http://localhost:8080/sample/sayhello?name=Joe

Will result in the output:

    Hello Joe!
    
The second method of handling requests allows the framework to act as a static file server. Requests for files in the 
static path are served back outside of any framework / rendering / etc. . 

# Plugins

As noted above you get access to the plugin space when your function is called via function arguments. By default 
the framework includes 3 plugins.

    web     - Includes most web related functionality
    script  - Includes mechanisms to influence execution and enables logging
    session - Enables basic session handling optionally backed by Redis

Plugins are managed by a single file `./lib/plugins.js` from the root of the focus directory structure. The plugins 
that are included are located in `./lib/plugins`. All plugins listed in `plugins.js` will be loaded and given to 
the controllers during execution.

Plugins have only basic rules and are provided as an extension mechanism. Each plugin that is referred to in 
`plugins.js` is assumed to export a single parent function. That function will be called via `new` and provided two arguments:

    framework   - Framework will provide your ability to take web server like actions
    env         - The Environment passed includes request specific information and context and is used with framework

Plugins can provide any number of functions and there is no limit or assumption as to what they can do. There are two 
functions that have specific meaning within the plugin framework:

    _init_      - Called at the beginning of the request BEFORE script execution starts.
    _finish_    - Called at the end of the request AFTER script execution is finished. 

Note: _init_ and _finish_ function calls in plugins should *not* output to the connection stream. There is no guarantee 
at either of these points that the connection is still open or valid. Script execution may have caused a disconnect or 
other failures may have closed the stream. These functions are primarily for setting up or tearing down resources associated 
with your plugin. Both _init_ and _finish_ receive the same set of available plugins passed to script functions.

## An example plugin

```js
var util = require('util');

function Sample(framework, env) {
    var self = this;

    self.env = env;
    self.framework = framework;
    self.localConfig = framework.config.localConfig;

    self.config = {
        cookieName: "math"
    };
};

Sample.prototype._init_ = function(plugins) {
    var self = this;

    var script = plugins.script;

    script.done();
};

Sample.prototype._finish_ = function(plugins) {
    var self = this;
    var script = plugins.script;

    script.done();
};

Sample.prototype.math = function() {
    var self = this;
    var value = Math.random() * 100;

    if (self.env.cookies[self.config.cookieName] !== undefined) {
        return self.env.cookies[self.config.cookieName];
    }
    else {
        self.framework.setCookie(self.env, self.config.cookieName, value, 86400, null, false, true, '/');
        return value;
    }
}

module.exports = Sample;
```

To use the module defined above, you could put the following example in a script

```js
module.exports.tryplugin = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;
    var sample = plugins.sample;

    web.echo("Sample: " + sample.math());

    script.done();
};
```

# Included plugins
* [Script Plugin] (#script-plugin)
* [Web Plugin] (#web-plugin)
* [Session Plugin] (#session-plugin)

## Script Plugin

The script plugin is one of the default plugins provided. It is used to control of script execution and also provides 
logging facilities.

### script.done()
Finish execution of script function and return execution back to the framework.  
**Return**: undefined  
**Example**  

```js
module.exports._exit_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    script.done();
};   
```

### script.wait()
Script execution is monitored during execution. If any script execution of callback is taking more than two seconds it 
is assumed that the script may no longer be functional. Once that happens the watchdog will fire and the script execution 
will terminate freeing up resources for the server. To prevent this you can inform the framework that a function may take 
longer to return than expected.   
**Return**: undefined   
**Example**   

```js   
module.exports.fancy = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.echo("pinging a server for 3 seconds");
    setTimeout(function() {
        web.echo("...done");
        script.done();
    }, 3000);

    script.wait();
};
```

### script.log()
Logging utility. Logs will be output to the console if not running in daemon mode. If running in daemon mode output 
will be appended to the log file.   
**Return**: undefined   
**Example**   

```js
script.log("Some random thing happened");
script.log("info", "Some information for you");
script.log("error", "Something bad happened");
script.log("debug", {some_obj: [1, 2, 3]});
```

## Web Plugin

The web plugin provides a basic platform for common web activities.

### web.echo([data][, ...])
Output to web response. This function can take multiple arguments in a printf()-like way.  
* data - Content with zero or more placeholders. Each placeholder will be replaced with the converted value from its 
corresponding argument.  
**Return**: undefined  
**Example**  

```js
web.echo("Random: %d", Math.random() * 100);
```

### web.isObject(object)
Returns true if the given "object" is an Object. false otherwise.   
**Return**: <code>true</code>|<code>false</code>   
**Example**   

```js
var test = web.isObject(testVal);
```

### web.isArray(object)
Returns true if the given "object" is an Array. false otherwise.   
**Return**: <code>true</code>|<code>false</code>   
**Example**   

```js
var test = web.isArray(testVal);
```

### web.isFunction(object)
Returns true if the given "object" is a Function. false otherwise.   
**Return**: <code>true</code>|<code>false</code>   
**Example**   

```js
var test = web.isFunction(testVal);
```

### web.isString(object)
Returns true if the given "object" is a String. false otherwise.   
**Return**: <code>true</code>|<code>false</code>   
**Example**   

```js
var test = web.isString(testVal);
```

### web.isDate(object)
Returns true if the given "object" is a Date. false otherwise.   
**Return**: <code>true</code>|<code>false</code>   
**Example**   

```js
var test = web.isDate(testVal);
```

### web.copyObjectProperty(propertyName, sourceObject, destObject, [copyAs])
Copy a named object property from one object to another. Use the optional copyAs property to specify object transformations 
during the copy. Return value indicates if the copy was successful.  
* propertyName - <code>String</code> Value that will be used as the object property.  
* sourceObject - <code>Object</code> Source object that contains the target property to be copied.  
* destObject - <code>Object</code> Destination object that the target property will be copied to.  
* copyAs - <code>Object</code> Object used as a type conversion preference. If available the target object property will be 
the same object type as copyAs   
**Return**: <code>true</code>|<code>false</code>   
**Example**  

```js
if ( web.copyObjectProperty('reqDate', sObj, dObj, new Date()) == true ) {
    //take some action
```

### web.cryptoEncode(data, password)
Return a base64 encoded representation of the clear text value. Data is encrypted using aes192, with the provided password 
as a key and converted to base64.  
* data - <code>String</code> Clear text value to be encrypted.  
* password - <code>String</code> Key to be used during the encryption process. Decryption key must match.  
**Return**: <code>String</code>|<code>undefined</code>  
**Example**   

```js
var tracker = web.cryptoEncode(userId);
```

### web.cryptoDecode(data, password)
Return a clear text representation of the encrypted value. Data is decrypted using the provided password as a key.  
**Return**:<code>String</code>|<code>undefined</code>  
**Example**  

```js
var userId = web.cryptoDecode(web.getQuery(tracker));
```

### web.getObject(jsonString)
Return an object from a string representation of JSON, e.g. from a string created by JSON.stringify. Useful for re-creating 
object without nested try / catch blocks.  
**Return**: <code>Object</code>|<code>null</code>  
**Example**   

```js
var newObj = web.getObject(web.getPost(userJSON));
```

### web.validate(schema, obj)
Validate can be used with input forms and query objects. Schema definitions are based on named properties and options for 
each property. If all tests pass the function will return true, otherwise it will return an array containing the names 
of the failed properties.  
* schema - <code>Object</code> Each named property will contain a requirement definition for a corresponding property in obj.  
* obj - <code>Object</code> Object that will be evaluated. Properties not named in schema will not be included.  
**Return**:<code>true</code>|<code>Array.&lt;string&gt;</code>  
**Example**  

```js
var schema = {};
schema['firstName'] = "required, string, maxlength 32";
schema['lastName']  = "required, string, maxlength 32";
schema['dob']       = "required, date";
schema['email']     = "required, email";

var check = web.validate(schema, web.post_data);
if (check !== true) {
    // unexpected value!
    ...
```

*Schema Definition* - Definition is a comma separated string that represents the required properties.  

| Param | Definition |
| --- | --- | 
| required | Validator will fail if the named property is not present in the object |
| string | Standard string value excluding some special characters |
| superstring | String value that will allow most special characters |
| alpha | Upper and lower case alpha characters only | 
| alpha_numeric | Alpha-numeric characters only | 
| numeric | Numeric characters only | 
| file_path | Restricted based on valid file path characters (POSIX) | 
| no_whitespace | Rejects any input with white space include tabs | 
| md5 | Restricted length alpha numeric input only | 
| sha1 | Restricted length alpha numeric input only | 
| email | Valid string containing a correctly formatted email address | 
| usphone | Standard 10 digit us phone number, include ., -, and space |
| date | Date allowable in multiple standard date formats | 
| maxlength | Requires a modifier. Restricts the length of the input to specified length | 

### web.cleanInput()
This function filters all the incoming form (post) and query (get) data. Non-viewable and potentially dangerous (script) 
like input is removed. Removed data is lost and no events are triggered. This function is most effective on script entry.  
**Return**: undefined  
**Example**   

```js
module.exports._enter_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.cleanInput();

    script.done();
};
```

### web.getCookie(byName)
Retrieve value if the given cookie was provided during request.  
**Return**: <code>String</code>|<code>null</code>  
**Example**  

```js
var cookie = web.getCookie('monster');
```

### web.getQuery(byName)
Retrieve value of the given query if it was provided as part of request.  
**Return**: <code>String</code>|<code>null</code>  
**Example**

```js
var getAction = web.getQuery('action');
```

### web.getPost(byName) || web.getForm(byName)
Retrieve value of the form post value if it was provided as part of the request.  
**Return**:<code>String</code>|<code>null</code>  
**Example**  

```js
if (web.method == "post") {
    var postAction = web.getPost('action');
    ...
```

### web.sendFile(fileName, clientName, callback)
Send a file by name to the client for download (octet-stream).  
* fileName - <code>String</code> Full path of local file to be sent as response.  
* clientName - <code>String</code> Suggested file name of client download.  
* callback - <code>Function</code> Callback will be called when download is complete, or if an error occurs.  
**Return**: The callback is passed two arguments <code>(err, size)</code>, where size is the bytes sent of the file.  
**Example**

```js
web.sendFile(myFile, "file.png", function(err, bytesSent) {
    if (err) {
        web.echo("sendFile error: " + err);
        script.done();
        return;
    }

    script.log("info", "Sent: " + bytesSent + " bytes");

    script.done();
    return;
});
```

### web.redirect(location)
Redirect the browser to another location.   
**Return**: undefined  
**Example**  

```js
web.redirect('/test/page');
```

### web.setHeader(name, value)
Set additional header during client response.  
**Return**: undefined  
**Example**

```js
web.setHeader('X-Math', Math.random() * 100);
```

### web.setCookie(name, value, [expires], [domain], [secure], [httponly], [path])
Set standard web cookie with optional values. Can be retrieved with web.getCookie.  
* name - <code>String</code> Cookie name.  
* value - <code>String</code> Cookie value.  
* expires - <code>Integer</code> Time in seconds the cookie will remain valid.  
* domain - <code>String</code> Cookie domain value.  
* secure - <code>Boolean</code> Default false. Set secure flag.  
* httponly - <code>Boolean</code> Default false. Set httponly flag.  
* path - <code>String</code> Default '/'. Set relative path.  
**Return**: undefined  
**Example**

```js
web.setCookie('monster', 'happyCookies');
```

### web.clearCookie(name)
Clear standard web cookie.  
**Return**: undefined  
**Example**

```js
web.clearCookie('monster');
```

### web.responseIsJSON()
Set the response type to JSON for current client request.  
**Return**: undefined  
**Example** 

```js
web.responseIsJSON();

web.echo(JSON.stringify(myAPI()));
```

### web.unauthorized()
Reject the current client request as unauthorized.  
**Return**: undefined  
**Example** 

```js
if (!web.session.isLoggedIn) {
    web.unauthorized();
```

### web.authenticate([users])
Require basic authentication.  
* users - <code>Array</code>|<code>String</code> List of users who are allowed access to the requested resource  
**Return**: undefined  
**Example**

```js
module.exports._enter_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.authenticate(['joe, 'foo']);

    script.done();
};
```

### web.render(fileName, [templateData], callback)
Render requested file using the framework rendering engine.  
* fileName - <code>String</code> Relative file name. Rendered files are loaded from the template directory  
* templateData - <code>Object</code> Object with named properties for template substitution.  
* callback - <code>Function</code> Callback will be called when file has loaded with rendering and substitution finished.  
**Return**: The callback is passed two arguments <code>(err, template)</code>, where template is the render.  
**Example**

```js
web.render('admin.js', {content: objData}, function(err, template) {
    if (err) {
        script.log(err);
        script.done();
        return;
    }

    web.echo(template);
    script.done();
});
```

### <code>Object</code> web.requestStorage
Object that is persisted through the length of a single request.  
**Return**:  
**Example**  

```js
module.exports._enter_ = function(plugins) {
...
web.requestStorage.sum = 42;

// sum will now be available in any subsequent functions in this controller.
...
```

## Session Plugin

The session plugin provides a standard mechanism to preserve data through multiple requests. There are two included session 
plugins, session.js and session_redis.js. `session.js` is used by default and is suitable for local development. The `ioredis.js` plugin provides the same functionality but is backed by redis and provides a more robust storage mechanism. 

### session.start()
Retrieves an existing session, if no session exists a new session will be created. The return value from this call should be 
persisted in a location available to the calling script, i.e. in `web` or `web.requestStorage`. Any value set in the object 
received from session.start() will be saved at the end of the request.   
**Return**: <code>Object</code>  
**Example**  

```js
module.exports._enter_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;
    var sessions = plugins.session;

    web.session = sessions.start();

    script.done();
};

module.exports.index = function(plugins) {
    var web = plugins.web;
    var sessions = plugins.session;

    if (web.session.count === undefined) {
        web.session.count = 1;
    }
    else {
        web.session.count++;
    }
    
    web.echo("Count: %d", web.session.count);
};
```

### session.destroy()
Destroys existing session clearing associated cookie and memory.  
**Return**: <code>session</code>  
**Example**  

```js
module.exports.logout = function(plugins) {
    var script = plugins.script;
    var sessions = plugins.session;
    
    sessions.destroy();
    
    script.done();
};
```
