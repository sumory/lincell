var child_process = require('child_process');
var fs = require('fs');
var http = require('http');
var express = require('express');
var sockeio = require('socket.io');
var project = require('./project.js');

var server = express();
var staticServer = express();
var httpServer = http.createServer(server);
var httpStaticServer = http.createServer(staticServer);

exports.listen = function (port) {
    server.configure(function () {
        server.use(express.bodyParser());
        server.use(express.methodOverride());
        server.use(server.router);
        server.use(express.static(__dirname + '/../public'));
    });

    staticServer.configure(function () {
        staticServer.use(express.bodyParser());
        staticServer.use(express.methodOverride());
        staticServer.use(server.router);
        staticServer.use(express.static(process.cwd()));
    });

    var io = sockeio.listen(httpServer, { 'log level':1 })

    io.configure(function () {
        io.set('transports', ['xhr-polling', 'jsonp-polling']);
    });

    httpServer.listen(port, function () {
        httpStaticServer.listen(port + 1, function () {

        });
    });

    var serverErrorHandler = function (err) {
        if (err.code == 'EADDRINUSE') {
            console.error('Error: Address already in use. use another port');
            process.exit(-1);
        }
        else {
            console.error('Error: ', err);
            process.exit(-1);
        }
    }

    server.on('error', serverErrorHandler);
    staticServer.on('error', serverErrorHandler);

    io.sockets.on('connection', function (socket) {
        project.list(false, function(result, data){
            socket.emit('list', data);
        });

        socket.emit('cwd', process.cwd());

        socket.on('load', function (path) {
            project.load(path, function(result, file){
                if(result){
                    socket.emit('file', { path: path, error: null, file: file });
                }
                else{
                    socket.emit('file', { path: path, error: file, file: null });
                }
            });
        });

        socket.on('save', function (data) {
            project.save(data.path, data.content, function(result, desc){
                if(result){
                    socket.emit('save-success', { path:data.path });
                }
                else{
                    socket.emit('save-error', { path:data.path, error:desc});
                }
            });
        });

        socket.on('add', function (path) {
            project.add(path, function(result, desc){
                 if(result) {
                     project.list(false, function(result, data){
                         socket.emit('list', data);
                     });
                 }
                else{
                     socket.emit('add-error', { path:path, error:desc });
                 }
            });
        });


        socket.on('remove', function (path) {
            project.remove(path, function(result, desc){
                if(result) {
                    project.list(false, function(result, data){
                        socket.emit('list', data);
                    });
                }
                else{
                    socket.emit('remove-error', { path:path, error:desc });
                }
            });
        });


        socket.on('add-folder', function (path) {
            project.addFolder(path, function(result, desc){
                if(result) {
                    project.list(false, function(result, list){
                        socket.emit('list', list);
                    });
                }
                else{
                    socket.emit('add-folder-error', { path:path, error:desc });
                }
            });
        });


        socket.on('renameFile', function (data) {
            project.rename(data.oldpath, data.newpath, function(result, desc){
                if(result) {
                    project.list(false, function(result, list){
                        socket.emit('list', list);
                        socket.emit('rename-file-success', { path:data.newpath });
                    });
                }
                else{
                    socket.emit('rename-error', { path: data.oldpath, error:desc });
                }
            });
        });

        socket.on('renameDirectory', function (data) {
            project.rename(data.oldpath, data.newpath, function(result, desc){
                if(result) {
                    project.list(false, function(result, list){
                        socket.emit('list', list);
                        socket.emit('rename-directory-success', { path:data.newpath });
                    });
                }
                else{
                    socket.emit('rename-error', { path: data.oldpath, error:desc });
                }
            });
        });



        socket.on('list', function (data) {
            project.list(true,function(result, data){
                socket.emit('list', data);
            });
        });

    });

}
