var fs = require('fs');
var exec = require('child_process').exec;
var util = require('util');
var rimraf = require('rimraf');
var rd = require('rd');

var isWin = (process.platform === 'win32');//'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
var separator = (isWin) ? '\\' : '/';
var listCache = undefined;

/**
 * 添加节点(文件或文件夹)到目录树
 * @param path
 */
var addToListCache = function (path) {
    //path = (isWin) ? path.replace('/', '\\') : path;
    //console.log('加到cache的path: ', path);
    var cwd = process.cwd();
    var cwd_length = cwd.length + 1;
    var current = listCache;
    var composite_path = "";
    var components = path.substr(cwd_length).split(separator);

    current = current || {};
    current.children = current.children || {};

    for (var i = 0; i < components.length - 1; i++) {
        composite_path = composite_path + separator + components[i];
        if (!current.children[components[i]]) {
            current.children[components[i]] = {
                name:components[i],
                type:"directory",
                path:composite_path,
                children:{}
            };
        }
        current = current.children[components[i]];
    }


    if (components[i] != '.') {
        composite_path = composite_path + separator + components[i];

        current.children[components[i]] = {
            name:components[i],
            type:"file",
            path:composite_path,
            children:{}
        };
    }

};

/**
 * 改变当前工作目录
 * @param dir
 */
exports.chdir = function (dir) {
    if (dir) {
        try {
            process.chdir(dir);
        }
        catch (e) {
            console.error('Could not change working directory to `' + dir + '`.');
            process.exit(-1);
        }
    }
}

/**
 * 生成目录树
 * @param noCache
 * @param callback
 */
exports.list = function (noCache, callback) {

    if (noCache || !listCache) {
        //console.log('listCache 1');
        listCache = {
            name:"",
            type:"directory",
            path:"",
            children:{}
        };

        var nodes = [];
        
        rd.each(process.cwd(), function (path, fileType, next) {
            if (fileType.isFile()) {
                nodes.push(path);
            }
            else if (fileType.isDirectory()) {
                nodes.push(path + separator + '.');
            }
            next();

        }, function (err) {
            if (err) {
                console.log('error:', err);
            }

            nodes.forEach(function (item, key) {
                try {
                    addToListCache(item);
                }
                catch (e) {
                    //console.log('error:',key, e);
                }
            });


            callback(true, listCache);
        });
    }
    else {
        //console.log('listCache 2');
        callback(true, listCache);
    }
}

/**
 * 新建一个文件
 * @param path
 * @param callback
 */
exports.add = function (path, callback) {
    path = (isWin) ? path.replace('/', '\\') : path;
    console.log('add file: ', path);

    if (path.charAt(0) != separator || path.indexOf('..') != -1) {
        callback(false);
    }
    else {
        fs.stat(process.cwd() + path, function (err, result) {
            if (!err) {
                callback(false, 'File already exists');
            }
            else {
                fs.writeFile(process.cwd() + path, '', 'utf8', function (err) {
                    if (err) {
                        callback(false, 'add file error');
                    }
                    else {
                        addToListCache(process.cwd() + path);
                        callback(true);
                    }
                })
            }
        });
    }
}

/**
 *  新建一个目录
 * @param path
 * @param callback
 */
exports.addFolder = function (path, callback) {
    path = (isWin) ? path.replace('/', '\\') : path;
    console.log('add folder: ', path);

    if (path.charAt(0) != separator || path.indexOf('..') != -1) {
        callback(false, 'Invalid Path');
    }
    else {
        fs.stat(process.cwd() + path, function (err, result) {
            if (!err) {
                callback(false, 'Folder already exists');
            }
            else {
                fs.mkdir(process.cwd() + path, '755', function (err) {
                    if (err) {
                        callback(false, 'add folder error');
                    }
                    else {
                        addToListCache(process.cwd() + path + separator + ".");
                        callback(true);
                    }
                });
            }
        });
    }
}

/**
 * 删除目录或文件
 * @param path
 * @param callback
 */
exports.remove = function (path, callback) {
    path = (isWin) ? path.replace('/', '\\') : path;
    console.log('remove: ', path);

    if (path.charAt(0) != separator || path.indexOf('..') != -1 || path == separator) {
        callback(false, 'Invalid Path');
    }
    else {
        console.log(process.cwd()+path) ;
        rimraf(process.cwd() + path,function(err){
            if (!err) {
                listCache = undefined;//重建树状目录数据
                callback(true);
            }
            else {
                callback(false, 'remove error');
            }
        });

        /*
        exec('rm -rf -- ' + process.cwd() + path, function (err) {
            if (!err) {
                listCache = undefined;//重建树状目录数据
                callback(true);
            }
            else {
                callback(false, 'remove error');
            }
        });
        */
    }
}

/**
 * 重命名目录或文件
 * @param oldpath
 * @param newpath
 * @param callback
 */
exports.rename = function (oldpath, newpath, callback) {
    oldpath = (isWin) ? oldpath.replace('/', '\\') : oldpath;
    newpath = (isWin) ? newpath.replace('/', '\\') : newpath;

    if (oldpath.charAt(0) != separator || oldpath.indexOf('..') != -1 || oldpath == separator ||
        newpath.charAt(0) != separator || newpath.indexOf('..') != -1 || newpath == separator) {
        callback(false, 'Invalid Path');
    }
    else {
        fs.rename(process.cwd() + oldpath, process.cwd() + newpath, function (err) {
            if (!err) {
                listCache = undefined;//重建树形目录数据
                callback(true);
            }
            else {
                callback(false, 'rename error');
            }
        });
    }
}

/**
 * 保存文件
 * @param path
 * @param contents
 * @param callback
 */
exports.save = function (path, contents, callback) {
    path = (isWin) ? path.replace('/', '\\') : path;
    console.log('save file: ', path);

    if (path.charAt(0) != separator || path.indexOf('..') != -1) {
        callback(false, 'Invalid Path');
    }
    else {
        fs.writeFile(process.cwd() + path, contents, 'utf8', function (err) {
            if (err) {
                callback(false, 'save error');
            }
            else {
                callback(true);
            }
        });
    }
}

/**
 * 加载文件
 * @param path
 * @param callback
 */
exports.load = function (path, callback) {
    path = (isWin) ? path.replace('/', '\\') : path;
    console.log('load file: ', path);

    if (path.charAt(0) != separator || path.indexOf('..') != -1) {
        callback(false, 'Invalid Path');
    }
    else {
        fs.stat(process.cwd() + path, function (err, stats) {
            if (err) {
                callback(false, 'File not found.');
            }
            else if (stats.size > 1024 * 1024) {
                callback(false, 'File larger than the maximum supported size.');
            }
            else {
                fs.readFile(process.cwd() + path, 'utf8', function (err, data) {
                    if (err) {
                        callback(false, 'File could not be read.');
                    }
                    else {
                        callback(true, data);
                    }
                });
            }
        });
    }
}
