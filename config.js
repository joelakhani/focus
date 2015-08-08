var config = module.exports = {};

config.port = 8080;
config.env = "production";
config.staticPath = "./docs/www/htdocs";
config.jsbinPath = "./docs/www/js-bin";
config.templates = "./docs/www/js-bin/templates";
config.staticIndex = "index.html";
config.fileRoot = "/tmp";
config.outLog = "/tmp/focus.out";
config.errLog = "/tmp/focus.err";
config.daemonUid = 33;
config.daemonGid = 33;
config.pidFile = "/tmp/focus.pid"

config.authUserFile = "./auth.example";
config.authName = "Focus Authentication Required";

config.thirdPartyKey = "LoLMuchMetaSuchKey==";
