Focus - A NodeJS Web Framework and Utilities
==========

Focus in a nutshell is a framework that lets you *not* write to a framework. By this focus gives you the 
ability to start a web based project like you would any simple export based app. Focus takes care of 
controller / routing by way of files and exports so there is no need to scaffold or generate anything. 

Something Important: The web framework was originally designed around a specific purpose, and in 
instances uses methods that are outside of the 'usual' framework patterns. There is no application 
generation, directory generation, resources or scaffolding. I'm super aware of this and having said 
that, if you are looking for a more complete framework Geddy / Connect / Express / et. al are super 
awesome.

Focus is stand-alone and based on a simple configuration. Please see the associated config.js included 
in the distribution.  Once you have deployed and set your configuration you can jump right in. Below 
is a basic sample script.  Feel free to copy this script into a file. 

Features - To name a few (Please refer to the documentation) 
- Cookies
- Static file server 
- HTTP chunked responses
- HTTP file / form uploads 
- HTTP 1.0 / 1.1 compatible
- Simple plugin architecture
- Basic HTML templates built in
- Session Management, see the session plugin (Basic & Redis)
- Easily create REST API end-points with a few lines of code
- Web built-ins with stuff like basic auth and redirects, (web plugin)

Focus should come ready to start if node is installed. Simply download the repo and start with:

    node index.js start

Once started go to the congiured host / port to view the default config:

    http://localhost:8080/

For more information refer to the documentation or look at the included test scripts.

[API Documentation](docs/README.md)

## Example

```js
//_enter_ is script wide and will be called as an entry point.

module.exports._enter_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;
    var sessions = plugins.session;

    //request storage is a place we can store properties 
    //through the life of a script _enter_ to _exit_
    web.requestStorage.sum = 42;

    script.done();
};

//index is the default action if no other is specified (assuming myscript.js)
    
module.exports.index = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.echo("e.g. http://localhost:8080/myscript");
    script.done();

    return;
};

//Use some node patterns.

module.exports.fancy = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.echo("Start long query. . . http://localhost:8080/myscript/fancy");
    setTimeout(function() {
        web.echo("...Finish long pretend query");
        script.done();
    }, 2500);

    script.wait();
};

module.exports.sayhello = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    var name = web.getQuery('name');
    if (!name) {
        web.echo("Hello there!");
    }
    else {
        web.echo("Hello " + name + "!");
    }

    script.done();
};

module.exports.myapi = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.responseIsJSON();

    web.echo(JSON.stringify({api_version: 1, api_result: true, api_data: [1, 2, 3, 4]}));

    script.done();
};

module.exports._exit_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    script.done();
}
```

# Config for local development

## Required - NodeJS and NPM (My local node configuration make sure these paths are okay)

    cd ~/Projects
    curl -O https://nodejs.org/dist/v0.12.7/node-v0.12.7.tar.gz
    tar -zxvf node-v0.12.7.tar.gz
    cd node-v0.12.7
    ./configure --prefix=$HOME/Projects/node

    make
    make install

    echo 'export PATH=$HOME/Projects/node/bin:$PATH' >> ~/.bash_profile
    echo 'export NODE_PATH=$HOME/Projects/node/lib/node_modules' >> ~/.bash_profile

    source ~/.bash_profile

    npm install npm -g
    npm install node-gyp -g

## Required - Get the REPO | (I'm using ~/Projects/focus)

    cd ~/Projects
    git config --global user.name "Your Name"
    git config --global user.email your_email@address.com

    git clone git@github.com:joelakhani/focus.git .

## Optional - Node Modules

    npm install ioredis

## Optional - Redis.io (Optional session store)

    * Note: $HOME does not work in configuration files, expand according to your configuration

    curl -O http://download.redis.io/releases/redis-3.0.3.tar.gz
    tar -zxvf redis-3.0.3.tar.gz
    cd redis-3.0.3
    make 
    make PREFIX=$HOME/Projects/redis install

    echo 'export PATH=$HOME/Projects/redis/bin:$PATH' >> ~/.bash_profile
    source ~/.bash_profile

    mkdir ~/Projects/redis/db

    cp redis.conf ~/Projects/redis/redis.conf

    vi ~/Projects/redis/redis.conf
        daemonize yes
        pidfile $HOME/Projects/redis/redis.pid
        logfile $HOME/Projects/redis/redis.log
        dir $HOME/Projects/redis/db

    (Optional) ~/.bash_profile
    alias redis-start='redis-server $HOME/Projects/redis/redis.conf'
    alias redis-stop='redis-cli -h 127.0.0.1 -p 6379 shutdown';

## Optional - my vi settings

    set nocompatible
    set autoindent
    set smartindent
    set smarttab
    set expandtab
    set tabstop=4
    set softtabstop=4
    set shiftwidth=4
    set showmatch
    set guioptions-=T
    set vb t_vb=
    set ruler
    set nohls
    set incsearch
    nmap X gt
    nmap Z gT
    nmap <C-n> :tabnew<CR>
