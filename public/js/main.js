var ServerConnection = window.ServerConnection = function () {
    var socket = io.connect(window.location.origin, {'connect timeout':20000});
    var saveFileCallbacks = {};
    var loadFileCallbacks = {};

    socket.on('cwd', function (path) {
        cwd = path;
        try {
            if (cwd.indexOf('\\') != -1) {
                $('#root_path').text(cwd.substring(cwd.lastIndexOf('\\') + 1, cwd.length));
            }
            else if (cwd.indexOf('/') != -1) {
                $('#root_path').text(cwd.substring(cwd.lastIndexOf('/') + 1, cwd.length));
            }
            else {
                $('#root_path').text(cwd);
            }
        }
        catch (e) {
            $('#root_path').text('Root path');
        }
    });

    socket.on('list', function (data) {
        updateFileListing(data.children);
    });

    socket.on('rename-file-success', function (data) {
        if (openFilesTable[data.oldpath]) {//已存在在打开文件列表中，只要让它显示即可
            closeTab(openFilesTable[data.oldpath].index);
        }
        art.dialog({
            content:'重命名文件成功',
            time:1500
        });
        selectFile(data.entry, htmlElementByPathTable);
    });

    socket.on('rename-directory-success', function (data) {//应该将本路径下的tab全部关闭
        art.dialog({
            content:'重命名文件夹成功',
            time:1500
        });

        for (var i in openFilesTable) {//本文件夹下的文件，已打开的全部关闭
            if (i.indexOf(data.oldpath) != -1) {
                closeTab(openFilesTable[i].index);
            }
        }
    });

    socket.on('rename-error', function (data) {
        art.dialog({
            content:'<p>重命名[' + data.path + ']发生错误:' + data.error + '</p>',
            time:2500
        });
    });

    socket.on('remove-success', function (data) {
        for (var i in openFilesTable) {//关闭本文件或者本文件夹下的文件，已打开的全部关闭
            if (i.indexOf(data.path) != -1) {
                closeTab(openFilesTable[i].index);
            }
        }
        art.dialog({
            content:'删除[' + data.name + ']成功',
            time:1500
        });
    });

    socket.on('remove-error', function (data) {
        art.dialog({
            content:'<p>删除[' + data.name + ']发生错误:' + data.error + '</p>',
            time:2500
        });
    });

    socket.on('add-folder-success', function () {
        art.dialog({
            content:'<p>添加文件夹成功</p>',
            time:1500
        });
    });

    socket.on('add-folder-error', function () {
        art.dialog({
            content:'<p>添加文件夹失败</p>',
            time:2500
        });
    });


    socket.on('add-file-success', function () {
        art.dialog({
            content:'<p>新建文件成功</p>',
            time:1500
        });
    });

    socket.on('add-file-error', function () {
        art.dialog({
            content:'<p>新建文件失败</p>',
            time:2500
        });
    });

    socket.on('file', function (data) {
        var callbacks = loadFileCallbacks[data.path] || [];
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i](data.error, data.file);
        }
        delete loadFileCallbacks[data.path];
    });


    socket.on('save-success', function (data) {
        var callbacks = saveFileCallbacks[data.path] || [];
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i](null);
        }
        delete saveFileCallbacks[data.path];
    });

    socket.on('save-error', function (data) {
        var callbacks = saveFileCallbacks[data.path] || [];
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i](data.error);
        }
        delete saveFileCallbacks[data.path];
    });

    this.renameFile = function (oldpath, newpath) {
        socket.emit('renameFile', { oldpath:oldpath, newpath:newpath });
    };

    this.renameDirectory = function (oldpath, newpath) {
        socket.emit('renameDirectory', { oldpath:oldpath, newpath:newpath });
    };

    this.removeFile = function (path) {
        socket.emit('remove', path);
    };

    this.addFolder = function (path, folderName) {
        socket.emit('add-folder', {path:path, folderName:folderName});
    };

    this.addFile = function (path, fileName) {
        socket.emit('add', {path:path, fileName:fileName});
    };

    this.loadFile = function (path, callback) {
        socket.emit('load', path);
        if (!loadFileCallbacks[path]) {
            loadFileCallbacks[path] = [callback];
        }
        else {
            loadFileCallbacks[path].push(callback);
        }
    };

    this.saveFile = function (path, content, callback) {
        socket.emit('save', {path:path, content:content});
        if (!saveFileCallbacks[path]) {
            saveFileCallbacks[path] = [callback];
        }
        else {
            saveFileCallbacks[path].push(callback);
        }
    };

    this.list = function () {
        socket.emit('list');
    };
};


var cwd = "";
var connection = new ServerConnection();

var htmlElementByPathTable = {};//以path为key保存的html对象
var openFilesTable = [];//所有打开的tab
var aceEditors = {};//所有aceEditors

var currentFile = {};
var searchResultHtmlElementByPath;

var stateByPath = {};
var fileEntries = [];

var ignore = ['.git', '.DS_Store'];


var addHTMLElementForFileEntry = function (entry, parentElement, fileEntriesArray, htmlElementByPathTable, ownContext) {
    //ownContext=true;//标识是否在名称后面显示路径

    if (ignore.indexOf(entry.name) != -1) {
        return;
    }

    var thisElement = document.createElement("li");
    thisElement.setAttribute("data-type", entry.type);
    thisElement.setAttribute("data-path", entry.path);
    htmlElementByPathTable[entry.path] = thisElement;

    if (fileEntriesArray) {
        fileEntriesArray.push(entry);
    }

    if (entry.type == "directory") {
        thisElement.className = 'folder';
        if (stateByPath[entry.path] == 'open') {
            thisElement.className += ' open'
        }
        thisElement.innerHTML = '<img src="img/folder.png">' + entry.name + (ownContext ? (' <i>(' + entry.path + ')</i>') : '')
        $(thisElement).click(function (e) {
            if (!e.offsetX) e.offsetX = e.clientX - $(e.target).position().left;
            if (!e.offsetY) e.offsetY = e.clientY - $(e.target).position().top;
            if (e.target == thisElement && e.offsetY < 24) {
                $(this).toggleClass('open');
                stateByPath[entry.path] = $(this).hasClass('open') ? 'open' : '';
                e.stopPropagation();
            }
        });
        var ul = document.createElement("ul");
        thisElement.appendChild(ul);
        for (var childEntry in entry.children) {
            addHTMLElementForFileEntry(entry.children[childEntry], ul, fileEntriesArray, ownContext ? {} : htmlElementByPathTable, ownContext);
        }
    }
    else {
        thisElement.className = 'file';
        thisElement.innerHTML = '<img src="img/file.png">' + entry.name + (ownContext ? (' <i>(' + entry.path + ')</i>') : '');
        $(thisElement).click(function (e) {
            selectFile(entry, htmlElementByPathTable);
        });
    }

    if (entry.name.charAt(0) == '.') {
        thisElement.className += ' hidden';
    }
    parentElement.appendChild(thisElement);
};


var updateFileListing = function (files) {
    searchResultHtmlElementByPath = {};
    htmlElementByPathTable = {};
    fileEntries = [];
    var ul = document.createElement("ul");
    for (var file in files) {
        addHTMLElementForFileEntry(files[file], ul, fileEntries, htmlElementByPathTable);
    }
    document.getElementById('files').innerHTML = '';
    document.getElementById('files').appendChild(ul);

    ul = document.createElement("ul");
    for (var i = 0; i < fileEntries.length; i++) {
        addHTMLElementForFileEntry(fileEntries[i], ul, null, searchResultHtmlElementByPath, true);
    }
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-results').appendChild(ul);
}

var selectFile = function (entry, htmlElementByPathTable) {
    $('.selected').removeClass('selected');
    $(htmlElementByPathTable[entry.path]).addClass('selected');

    var index = new Date().getTime();

    if (entry.path.match(/\.(jpe?g|png|ico|gif|bmp)$/)) {//如果是图片则显示图片，点击后跳转到图片
        if (openFilesTable[entry.path]) {//已存在在打开文件列表中，只要让它显示即可
            showTab(openFilesTable[entry.path].index);
        }
        else {//不在打开文件列表中，须创建，然后让它显示
            openFilesTable[entry.path] = {
                name:entry.name,
                path:entry.path,
                index:index,
                type:'img'
            };
            $('#name-tabs').append('<li name-tab-index="' + index + '"><a class="tab" href="#">' + entry.name + '</a><a class="icon close" href="#"></a></li>');
            newImgEditor(entry, index);
        }
    }
    else {//是文件，创建AceEditor
        if (openFilesTable[entry.path]) {//已存在在打开文件列表中，只要让它显示即可
            showTab(openFilesTable[entry.path].index);
        }
        else {//不在打开文件列表中，须创建，然后让它显示
            openFilesTable[entry.path] = {
                name:entry.name,
                path:entry.path,
                index:index,
                type:'file'
            };
            $('#name-tabs').append('<li name-tab-index="' + index + '"><a class="tab" href="#">' + entry.name + '</a><a class="icon close" href="#"></a></li>');
            newFileEditor(entry, index);
        }
    }
}

var selectModeFromPath = function (path) {
    switch (true) {
        case !!path.match(/\.js$/):
            return 'javascript'
        case !!path.match(/\.coffee$/):
            return 'coffeescript'
        case !!path.match(/\.json$/):
            return 'json'
        case !!path.match(/\.x?html?$/):
            return 'html'
        case !!path.match(/\.php$/):
            return 'php'
        case !!path.match(/\.py$/):
            return 'python'
        case !!path.match(/\.rb$/):
            return 'ruby'
        case !!path.match(/\.c$/):
            return 'c_cpp'
        case !!path.match(/\.h$/):
            return 'c_cpp'
        case !!path.match(/\.cpp$/):
            return 'c_cpp'
        case !!path.match(/\.cc$/):
            return 'c_cpp'
        case !!path.match(/\.cs$/):
            return 'csharp'
        case !!path.match(/\.java$/):
            return 'java'
        case !!path.match(/\.css$/):
            return 'css'
        case !!path.match(/\.(xml|svg|od(t|p|s))$/):
            return 'xml'
        case !!path.match(/\.ejs$/):
            return 'html'
        case !!path.match(/\.jsp$/):
            return 'jsp'
        case !!path.match(/\.aspx$/):
            return 'csharp'
        case !!path.match(/\.m(arkdown|d)$/):
            return 'markdown'
        default:
            return 'text';
    }
};

var newImgEditor = function (entry, index) {
    var editor = $('<div class="code-editor"></div>');
    var imagePath = document.location.protocol + "//" + document.location.hostname + ':' + ((parseInt(document.location.port) || 80) + 1) + entry.path;
    var image = $('<img/>');
    image.attr('src', imagePath);
    image.attr('class', 'view');
    var a = $('<a href="' + imagePath + '" target="_blank"></a>');
    a.append(image);
    editor.append(a);
    $('#code-tabs').append('<div code-tab-index="' + index + '" class="area stylesheet-style-mss">' + editor.html() + '</div>');
    showTab(index);
}

var newFileEditor = function (entry, index) {
    var editor = $('<div class="code-editor"></div>');
    connection.loadFile(entry.path, function (err, file) {
        if (err) {
            var errorBar = document.createElement('div');
            errorBar.className = 'error'
            errorBar.innerHTML = '<b>Unable to open file:</b> ' + err;
            editor.append(errorBar);
            $(errorBar).hide();
            $(errorBar).fadeIn(250);
        }
        else {
            var codeArea = $('<div class="ace_focus"></div>');
            codeArea.attr("id", 'ace-editor-' + index);
            codeArea.attr('style', "position: absolute;top: 0px;margin: 0;bottom: 0;left: 0;right: 0;border-top: none;");
            editor.append(codeArea);

            $('#code-tabs').append('<div code-tab-index="' + index + '" class="area">' + editor.html() + '</div>');

            var mode = selectModeFromPath(entry.path);//console.log('mode is ', mode);
            var aceEditor = ace.edit(codeArea.attr('id'));
            aceEditors[index] = {
                editor:aceEditor,
                changed:false
            };
            aceEditor.setTheme("ace/theme/clouds");
            aceEditor.focus();
            aceEditor.setValue(file);
            aceEditor.getSession().setMode("ace/mode/" + mode);
            aceEditor.setFontSize('14px');
            aceEditor.clearSelection();
            aceEditor.getSession().setTabSize(4);
            aceEditor.on('change', function () {
                aceEditors[index].changed = true;//标记已修改
                $("#name-tabs li[name-tab-index=" + index + "] .tab").text("*" + entry.name);
            });
            aceEditor.setShowPrintMargin(false);

            showTab(index);
        }
    });
};


//~===================================tab===================================

$(document).on("click", '#name-tabs li .tab', function () {
    var index = $(this).parent('li').attr('name-tab-index');
    showTab(index);
});

$(document).on("click", '#name-tabs li .close', function () {
    var index = $(this).parent('li').attr('name-tab-index');
    if (aceEditors[index] && aceEditors[index].changed) {//是可编辑内容，如非图片，且内容已经改变
        art.dialog({
            content:"内容已被修改，请选择以下操作",
            button:[
                {
                    value:'保存并关闭',
                    callback:function () {
                        saveFile(index, function () {
                            closeTab(index)
                        });
                    },
                    focus:true
                },
                {
                    value:'直接关闭不保存',
                    callback:function () {
                        closeTab(index);
                    }
                },
                {
                    value:'不关闭'
                }
            ]
        });
    }
    else {
        closeTab(index);
    }
});

function closeTab(index) {
    var _this = $("#name-tabs li[name-tab-index=" + index + "] .close");
    var isThisOpen = _this.prev('a').hasClass('active');//如果当前这个tab是open的
    var prev = _this.parent('li').prev('li').attr('name-tab-index');
    var next = _this.parent('li').next('li').attr('name-tab-index');
    var show_index = prev ? prev : (next ? next : undefined);

    $('#name-tabs>li[name-tab-index=' + index + ']').remove();
    $('#code-tabs>div[code-tab-index=' + index + ']').remove();

    for (var i in openFilesTable) {//从打开的tab列表中删除该项
        if (openFilesTable[i].index == index) {
            delete openFilesTable[i];
            break;
        }
    }
    delete aceEditors[index];

    if (show_index && isThisOpen) {
        showTab(show_index);
    }

    //控制是否显示方向键
    if (500 <= $("#name-tabs").width()) {
        $(".left_move").show();
        $(".right_move").show();
    }
    else {
        $(".left_move").hide();
        $(".right_move").hide();
    }
}

function showTab(index) {
    $('#name-tabs>li').each(function () {
        if ($(this).attr('name-tab-index') == index) {
            $(this).children('.tab').addClass('active');
        }
        else {
            $(this).children('.tab').removeClass('active');
        }
    });

    $('#code-tabs>div').each(function () {
        if ($(this).attr('code-tab-index') == index) {
            $(this).addClass('active');
        }
        else {
            $(this).removeClass('active');
        }
    });


    //scroll
    var a = $("#name-tabs li[name-tab-index=" + index + "]");
    var hm = $(".tabs-box");
    var al = a.position().left;
    var pl = hm.position().left;
    if (al < pl || al + a.width() > pl + hm.width()) {
        hm.scrollLeft(hm.scrollLeft() + al - pl);
    }

    //控制是否显示方向键
    if (500 <= $("#name-tabs").width()) {
        $(".left_move").show();
        $(".right_move").show();
    }
    else {
        $(".left_move").hide();
        $(".right_move").hide();
    }

    //重置目前打开的file基本信息
    for (var i in openFilesTable) {//从打开的tab列表中删除该项
        if (openFilesTable[i].index == index) {//即当前打开的tab
            currentFile = openFilesTable[i];
            $('.header').text('当前文件: '+i);
            break;
        }
    }
}

function hscroll() {
    var s = 20 * ($(this).hasClass('left_move') ? -1 : 1);
    $(document).mouseup(function () {
        var t = self.timer;
        if (t) {
            window.clearInterval(t);
        }
    });
    self.timer = window.setInterval(function () {
        var l = $('.tabs-box').scrollLeft();
        $('.tabs-box').scrollLeft(l + s);
    }, 20);
    return self.timer;
}

$('.left_move').mousedown(hscroll);
$('.right_move').mousedown(hscroll);

function mousescroll(direct) {
    var s = 20 * direct;
    var l = $('.tabs-box').scrollLeft();
    $('.tabs-box').scrollLeft(l + s);
}

$(".tabs-box").mousewheel(function (event, delta, deltaX, deltaY) {
    if (deltaY > 0) {
        mousescroll(-1);
    }
    else if (deltaY <= 0) {
        mousescroll(1);
    }

    event.stopPropagation();
    event.preventDefault();
});


//~====================================检索操作==================================
var doSearch = function () {
    if (this.value != '') {
        for (var i = 0; i < fileEntries.length; i++) {
            if (fileEntries[i].name.match(this.value)) {
                $(searchResultHtmlElementByPath[fileEntries[i].path]).slideDown()
            }
            else {
                $(searchResultHtmlElementByPath[fileEntries[i].path]).slideUp()
            }
        }
        $('#project').slideUp();
        $('#search').slideDown();
    }
    else {
        $('#project').slideDown();
        $('#search').slideUp();
    }
}
$('#search-field').keyup(doSearch).click(doSearch)


//~====================================保存操作==================================

var k = new Kibo();
k.down(['ctrl s'], saveHandler);

function saveHandler(e) {
    e.preventDefault();
    if (currentFile && currentFile.type === 'file') {//当前有打开‘文件类型’的文件
        var index = currentFile.index;
        connection.saveFile(currentFile.path, aceEditors[index].editor.getValue(), function (err) {
            var tabName = $("#name-tabs li[name-tab-index=" + index + "] .tab").text() || '';
            if (err) {
                alert('保存文件[' + tabName.substring(1) + ']出错');
            }
            else {
                aceEditors[index].changed = false;
                $("#name-tabs li[name-tab-index=" + index + "] .tab").text(tabName.substring(1));
            }
        });
    }
}

function saveFile(index, callback) {
    var thisFile = undefined;
    for (var i in openFilesTable) {//从打开的tab列表中选
        if (openFilesTable[i].index == index) {
            thisFile = openFilesTable[i];
            break;
        }
    }

    if (thisFile && thisFile.type === 'file') {//当前有打开‘文件类型’的文件
        connection.saveFile(thisFile.path, aceEditors[index].editor.getValue(), function (err) {
            var tabName = $("#name-tabs li[name-tab-index=" + index + "] .tab").text() || '';
            if (err) {
                alert('保存文件[' + tabName.substring(1) + ']出错');
            }
            else {
                aceEditors[index].changed = false;
                $("#name-tabs li[name-tab-index=" + index + "] .tab").text(tabName.substring(1));

                callback && callback();
            }
        });
    }
}

//~====================================左侧目录树右键操作==================================

$('#files ul .folder').contextmenu({
    items:[
        {
            text:'重命名',
            action:function (target) {
                var oldpath = target.getAttribute("data-path");
                var dialog = art.dialog({
                    content:"<p>重命名文件夹[" + oldpath + "]</p><input type='text' width='200px;' name='newDirectoryName'/>",
                    button:[
                        {
                            value:'保存',
                            callback:function () {
                                var newName = $('input[name=newDirectoryName]').val();
                                if (newName) {
                                    var newpath = (oldpath.indexOf('\\') != -1) ? oldpath.substring(0, oldpath.lastIndexOf('\\')) + '\\' + newName : oldpath.substring(0, oldpath.lastIndexOf('/')) + '/' + newName;
                                    connection.renameDirectory(oldpath, newpath);
                                }
                                dialog.close();
                            },
                            focus:true
                        },
                        {
                            value:'取消',
                            callback:function () {
                                dialog.close();
                            }
                        }
                    ]
                });
            }
        },
        {
            text:'新建文件夹',
            action:function (target) {
                var path = target.getAttribute("data-path");
                var dialog = art.dialog({
                    content:"<p>新建[" + path + "]的子文件夹:</p><input type='text' width='200px;' name='newFolderName'/>",
                    button:[
                        {
                            value:'确定',
                            callback:function () {
                                var newFolderName = $('input[name=newFolderName]').val();
                                if (newFolderName)
                                    connection.addFolder(path, newFolderName);
                                dialog.close();
                            },
                            focus:true
                        },
                        {
                            value:'取消',
                            callback:function () {
                                dialog.close();
                            }
                        }
                    ]
                });
            }
        },
        {
            text:'新建文件',
            action:function (target) {
                var path = target.getAttribute("data-path");
                var dialog = art.dialog({
                    content:"<p>在[" + path + "]路径下新建文件:</p><input type='text' width='200px;' name='newFileName'/>",
                    button:[
                        {
                            value:'确定',
                            callback:function () {
                                var newFileName = $('input[name=newFileName]').val();
                                if (newFileName)
                                    connection.addFile(path, newFileName);
                                dialog.close();
                            },
                            focus:true
                        },
                        {
                            value:'取消',
                            callback:function () {
                                dialog.close();
                            }
                        }
                    ]
                });
            }
        },
        {
            text:'删除文件夹',
            action:function (target) {
                var oldpath = target.getAttribute("data-path");
                var dialog = art.dialog({
                    content:"<p>确定要删除文件夹[" + oldpath + "]吗?</p>",
                    button:[
                        {
                            value:'确定',
                            callback:function () {
                                connection.removeFile(oldpath);
                                dialog.close();
                            },
                            focus:true
                        },
                        {
                            value:'取消',
                            callback:function () {
                                dialog.close();
                            }
                        }
                    ]
                });
            }
        }
    ]
});

$('#files ul .file').contextmenu({
    items:[
        {
            text:'重命名',
            action:function (target) {
                var oldpath = target.getAttribute("data-path");
                var dialog = art.dialog({
                    content:"<p>重命名文件[" + oldpath + "]</p><input type='text' width='200px;' name='newName'/>",
                    button:[
                        {
                            value:'保存',
                            callback:function () {
                                var newName = $('input[name=newName]').val();
                                if (newName) {
                                    var newpath = (oldpath.indexOf('\\') != -1) ? oldpath.substring(0, oldpath.lastIndexOf('\\')) + '\\' + newName : oldpath.substring(0, oldpath.lastIndexOf('/')) + '/' + newName;
                                    connection.renameFile(oldpath, newpath);
                                }
                                dialog.close();
                            },
                            focus:true
                        },
                        {
                            value:'取消',
                            callback:function () {
                                dialog.close();
                            }
                        }
                    ]
                });
            }
        },
        {
            text:'删除',
            action:function (target) {
                var oldpath = target.getAttribute("data-path");
                var dialog = art.dialog({
                    content:"<p>确定要删除文件[" + oldpath + "]吗?</p>",
                    button:[
                        {
                            value:'确定',
                            callback:function () {
                                connection.removeFile(oldpath);
                                dialog.close();
                            },
                            focus:true
                        },
                        {
                            value:'取消',
                            callback:function () {
                                dialog.close();
                            }
                        }
                    ]
                });
            }
        }
    ]
});

//~====================================gear-menu操作==================================

var shouldDismissGearMenuOnMouseUp = false;
var hasJustDisplayedGearMenu = false;
$('#gear-menu').mousedown(function (e) {
    shouldDismissGearMenuOnMouseUp = false;
    hasJustDisplayedGearMenu = true;
    $('#gear-menu-popup').show();
    setTimeout(function () {
        shouldDismissGearMenuOnMouseUp = true;
    }, 500);
    setTimeout(function () {
        hasJustDisplayedGearMenu = false;
    }, 0);
});

$('#gear-menu').mouseup(function () {
    if (shouldDismissGearMenuOnMouseUp) {
        $('#gear-menu-popup').fadeOut(200);
    }
});

$('#gear-menu-popup').mousedown(function (e) {
    e.stopPropagation();
});

$('#gear-menu-popup').mouseup(function (e) {
    $('#gear-menu-popup').fadeOut(200);
});

$(document.body).mousedown(function () {
    if (!hasJustDisplayedGearMenu) {
        $('#gear-menu-popup').fadeOut(200);
    }
});

$(window).bind('blur resize', function () {
    $('#gear-menu-popup').fadeOut(200);
});

$('#project-refresh').click(function (e) {
    connection.list();
});

$('#show-hidden').click(function () {
    $('#sidebar').toggleClass('show-hidden');
});