#!/usr/bin/env node

var program = require('commander');
var server = require('./lib/server.js');
var project = require('./lib/project.js');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var config = require('./config.js');

program.version(config.version)
    .option('-p, --port <number>', 'use a custom http port(default port is 8222)')
    .option('-d, --dir <string>', 'use a custom path to show(default path is current path)');

program.on('--help', function(){
    console.log('  Examples:');
    console.log('');
    console.log('    lincell                          # use default port and current path');
    console.log('    lincell -p 9234                  # custom port');
    console.log('    lincell -d /home/sumory          # custom path');
    console.log('    lincell -p 8726 -d /home/sumory  # absolute path is supported');
    console.log('    lincell -p 8843 -d ../path       # relative path is also supported');
    console.log('');
});

program.parse(process.argv);

try{
    var abs_path = path.resolve(process.cwd(), program.dir || '') || process.cwd();
    var port = program.port || 8222;
    console.log('LinCell is running under Path[%s] on Port[%d]', abs_path, port);

    if(fs.existsSync(abs_path)){
        project.chdir(abs_path);
        server.listen(port);
    }
    else{
        console.log('your path not exists.');
        process.exit(-1);
    }
}
catch(e){
    console.log('something is wrong.');
    console.log(e);
    process.exit(-1);
}