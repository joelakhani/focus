module.exports._enter_ = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.authenticate(['foo', 'bar']);  //testfoo, testbar

    script.done();
};

module.exports.index = function(plugins) {
    var web = plugins.web;
    var script = plugins.script;

    web.echo("Authenticated as: " + web.authUser);

    script.done();
};
