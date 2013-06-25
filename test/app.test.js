var fs = require('fs');
var path = require('path');
var should = require('should');
var project = require('../lib/project.js');
var server = require('../lib/server.js');

describe('Testing.....', function () {
    before(function(){
        console.log('  +++++++++Testing Start+++++++++++');
        //var absPath = process.cwd();
        //project.chdir(absPath);
        //server.listen(8222);
    });

    it('should list `dir` with `true` result', function (done) {
        project.list(true, function(result){
            result.should.equal(true);
            done();
        });
    });

    after(function(){
        console.log('  +++++++++Testing Stop+++++++++++');
        console.log();
    });

});