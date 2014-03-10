var fs = require('fs');

function getSeparator() {
    var isWin = (process.platform === 'win32'); //'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
    var separator = (isWin) ? '\\' : '/';
    return separator;
}


function getDeepth(path, prefix) {
    if (path.indexOf(prefix) === 0) { //path的前缀是prefix
        var relative_path = path.substring(prefix.length);
        var tmp_path_array = relative_path.split(getSeparator());
        return tmp_path_array.length - 1;
    } else {
        return -1;
    }
    return 0;
}

/**
 * 遍历目录，最大深度不超过limit_deepth
 */
function walkDiretory(root, limit_deepth) {
    var nodes = [];
    var deepth = 0;
    var separator = getSeparator();

    function walk(path) {
        deepth = getDeepth(path, root);


        if (deepth > limit_deepth) {
            return;
        } else {
            var node = {
                dir: 0,
                path: path,
                name: path.substring(path.lastIndexOf(separator) + 1),
                deepth: deepth
            };

            var fileType = fs.statSync(path);
            if (fileType.isFile()) {
                node.dir = 0;
                nodes.push(node);
            } else if (fileType.isDirectory()) {
                var pathList = fs.readdirSync(path);
                node.dir = 1;
                if (node.path !== root) nodes.push(node);
                pathList.forEach(function(item) {
                    walk(path + separator + item);
                });
            }
        }
    }

    walk(root);

    return nodes.sort( sortNodes);
}

function sortNodes(x, y) {
    if (x.deepth > y.deepth) {// 先按深度排序，由低到高
        return 1;
    } else if (x.deepth == y.deepth) {  
        if (x.dir < y.dir) {//深度相同，按类型排序，文件夹在前，文件在后
            return 1;
        } else if (x.dir == y.dir) { 
            if (x.name > y.name) {// 类型相同，则再按名称排序
                return 1;
            } else if (x.name == y.name) {
                return 0;
            } else {
                return -1;
            }
        } else {
            return -1;
        }
    } else {
        return -1;
    }
}


var nodes = walkDiretory(process.cwd(),1);


for (var i = 0; i < nodes.length; i++) {
    var item = nodes[i];
    console.log(item.deepth+'\t'+item.dir+'\t'+item.name+'\t\t'+item.path);
}