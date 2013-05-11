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
        ui.updateFileListing(data.children);
    });

    socket.on('rename-file-success', function (data) {
        ui.selectFile({
            type:'file',
            path:data.path
        });
    });

    socket.on('rename-directory-success', function (data) {
        ui.selectFile({
            type:'directory',
            path:data.path
        });
    });

    socket.on('rename-error', function (data) {
        $.pnotify({
            title:'错误提示!',
            text:'重命名[' + data.path + ']发生错误:' + data.error,
            type:'error',
            hide:false,
            shadow:false
        });
        console.dir(data);//path: oldpath, error:desc
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

    this.addFolder = function (path) {
        socket.emit('add-folder', path);
    };

    this.addFile = function (path) {
        socket.emit('add', path);
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

var UI = window.UI = function () {
    var _this = this;

    var currentFile
    var searchResultHtmlElementByPath
    var fileHtmlElementByPath
    var stateByPath = {}
    var fileEntries = []

    var ignore = ['.git', '.linc', '.DS_Store']
    var limitRecursion = ['node_modules']

    var addHTMLElementForFileEntry = function (entry, parentElement, fileEntriesArray, htmlElementByPathTable, ownContext, doLimitRecursion) {

        if (ignore.indexOf(entry.name) != -1) {
            return;
        }

        var thisElement = document.createElement("li");
        htmlElementByPathTable[entry.path] = thisElement

        if (fileEntriesArray && !doLimitRecursion) {
            fileEntriesArray.push(entry)
        }

        if (entry.type == "directory") {
            thisElement.className = 'folder'
            if (stateByPath[entry.path] == 'open') {
                thisElement.className += ' open'
            }
            thisElement.innerHTML = '<img src="img/folder.png">' + entry.name + (ownContext ? (' <i>(' + entry.path + ')</i>') : '')
            $(thisElement).click(function (e) {
                if (!e.offsetX) e.offsetX = e.clientX - $(e.target).position().left;
                if (!e.offsetY) e.offsetY = e.clientY - $(e.target).position().top;
                if (e.target == thisElement && e.offsetY < 24) {
                    if (e.offsetX < 24) {
                        $(this).toggleClass('open');
                        stateByPath[entry.path] = $(this).hasClass('open') ? 'open' : '';
                        e.stopPropagation()
                    }
                    else {
                        _this.selectFile(entry, htmlElementByPathTable)
                        e.stopPropagation()
                    }
                }
            })
            var ul = document.createElement("ul")
            thisElement.appendChild(ul)
            for (var childEntry in entry.children) {
                addHTMLElementForFileEntry(entry.children[childEntry], ul, fileEntriesArray, ownContext ? {} : htmlElementByPathTable, false, doLimitRecursion || limitRecursion.indexOf(entry.name) != -1)
            }
        }
        else {
            thisElement.innerHTML = '<img src="img/file.png">' + entry.name + (ownContext ? (' <i>(' + entry.path + ')</i>') : '')
            $(thisElement).click(function (e) {
                _this.selectFile(entry, htmlElementByPathTable)
            })
        }
        if (entry.name.charAt(0) == '.') {
            thisElement.className += ' hidden'
        }
        parentElement.appendChild(thisElement)
    }

    $('#show-hidden').click(function () {
        $('#sidebar').toggleClass('show-hidden')
    })

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

    $('#project').click(function (e) {
        if (e.target == $('#project')[0]) {
            _this.selectFile({
                type:'project',
                path:'/'
            }, null, $('#project')[0])
        }
    })

    $('#add-file').click(function (e) {
        var filename = prompt('Type in a filename for the new file:', 'untitled.js')
        if (filename) {
            var path;
            if (!currentFile) {
                path = '/'
            }
            else {
                switch (currentFile.type) {
                    case 'directory':
                        path = currentFile.path + '/'
                        break;
                    case 'file':
                        path = currentFile.path.replace(/\/[^\/]+$/, '/')
                        break;
                    default:
                        path = '/'
                        break;
                }
            }

            connection.addFile(path + filename);
        }
    })

    $('#add-folder').click(function (e) {
        var filename = prompt('Type in a filename for the new folder', 'folder')
        if (filename) {
            var path;
            if (!currentFile) {
                path = '/'
            }
            else {
                switch (currentFile.type) {
                    case 'directory':
                        path = currentFile.path + '/'
                        break;
                    case 'file':
                        path = currentFile.path.replace(/\/[^\/]+$/, '/')
                        break;
                    default:
                        path = '/'
                        break;
                }
            }
            connection.addFolder(path + filename)
        }
    })

    $('#remove-file').click(function (e) {
        if (currentFile) {
            var confirmed
            if (currentFile.type == 'file') {
                confirmed = confirm('Are you sure to delete this file?')
            }
            else if (currentFile.type == 'directory') {
                confirmed = confirm('This will remove the directory and all its contents. Are you sure?')
            }
            else {
                confirmed = false
            }
            if (confirmed) {
                connection.removeFile(currentFile.path)
            }
        }
    })

    $('#project-refresh').click(function (e) {
        connection.list()
    })


    var shouldDismissGearMenuOnMouseUp = false;
    var hasJustDisplayedGearMenu = false;
    $('#gear-menu').mousedown(function (e) {
        shouldDismissGearMenuOnMouseUp = false;
        hasJustDisplayedGearMenu = true;
        $('#gear-menu-popup').show()
        setTimeout(function () {
            shouldDismissGearMenuOnMouseUp = true;
        }, 500)
        setTimeout(function () {
            hasJustDisplayedGearMenu = false;
        }, 0)
    })

    $('#gear-menu').mouseup(function () {
        if (shouldDismissGearMenuOnMouseUp) {
            $('#gear-menu-popup').fadeOut(200)
        }
    })

    $('#gear-menu-popup').mousedown(function (e) {
        e.stopPropagation();
    })

    $('#gear-menu-popup').mouseup(function (e) {
        $('#gear-menu-popup').fadeOut(200);
    })

    $(document.body).mousedown(function () {
        if (!hasJustDisplayedGearMenu) {
            $('#gear-menu-popup').fadeOut(200);
        }
    })

    $(window).bind('blur resize', function () {
        $('#gear-menu-popup').fadeOut(200);
    })

    this.updateFileListing = function (files) {
        searchResultHtmlElementByPath = {}
        fileHtmlElementByPath = {}
        fileEntries = []
        var ul = document.createElement("ul")
        for (var file in files) {
            addHTMLElementForFileEntry(files[file], ul, fileEntries, fileHtmlElementByPath)
        }
        document.getElementById('files').innerHTML = '';
        document.getElementById('files').appendChild(ul);

        ul = document.createElement("ul")
        for (var i = 0; i < fileEntries.length; i++) {
            addHTMLElementForFileEntry(fileEntries[i], ul, null, searchResultHtmlElementByPath, true)
        }
        document.getElementById('search-results').innerHTML = '';
        document.getElementById('search-results').appendChild(ul);
    }


    var setCurrentEditor = function (editor) {
        var children = $('#content').children();
        children.css({ visibility:'hidden', zIndex:-1 });
        if ($.inArray(editor, children) >= 0) {
            $(editor).css({ visibility:'visible', zIndex:1 });
        }
        else {
            $('#content').append(editor);
        }
        editor.focus();
    }


    var editorPool = new EditorPool();
    this.selectFile = function (entry, htmlElementByPathTable, htmlElement) {
        if (!htmlElementByPathTable) {
            htmlElementByPathTable = fileHtmlElementByPath;
        }

        $('.selected').removeClass('selected');
        currentFile = entry;
        $(htmlElement || htmlElementByPathTable[currentFile.path]).addClass('selected');

        var editor = editorPool.editorForEntry(entry, function (discarted) {
            $(discarted).remove();
        });

        setCurrentEditor(editor);
    }
};


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

var createAceEditor = function (editorId, contents, path, options) {
    var editor = ace.edit(editorId);
    editor.setTheme("ace/theme/clouds");
    var mode = selectModeFromPath(path);
    //console.log('mode is ', mode);
    editor.focus();
    editor.setValue(contents);
    editor.getSession().setMode("ace/mode/" + mode);
    editor.setFontSize('14px');
    editor.clearSelection();
    editor.getSession().setTabSize(4);
    editor.renderer.setHScrollBarAlwaysVisible(false);
    editor.on('change', options.onChange);
    return  editor;
};

var createActionsBar = function (path) {
    var actionsBar = document.createElement('div');
    actionsBar.className = 'actions';
    actionsBar.innerHTML = '<b>' + cwd + path + '</b> ';

    actionsBar.renameButton = document.createElement('button');
    actionsBar.renameButton.innerHTML = 'Rename';
    actionsBar.appendChild(actionsBar.renameButton);
    return actionsBar;
};

var CodeEditor = window.CodeEditor = function (entry) {
    var actionsBar = createActionsBar(entry.path);
    var editor = document.createElement('div');

    $(actionsBar.renameButton).click(function (e) {
        var newName = prompt('New filename:', entry.name);
        if (newName) {
            var oldpath = entry.path;
            var newpath = (oldpath.indexOf('\\') != -1) ? oldpath.substring(0, oldpath.lastIndexOf('\\')) + '\\' + newName : oldpath.substring(0, oldpath.lastIndexOf('/')) + '/' + newName;
            connection.renameFile(oldpath, newpath);
        }
    });

    editor.appendChild(actionsBar);
    editor.className = 'code-editor';

    if (entry.path.match(/\.(jpe?g|png|ico|gif|bmp)$/)) {//如果是图片则显示图片，点击后跳转到图片
        var imagePath = document.location.protocol + "//" + document.location.hostname + ':' + ((parseInt(document.location.port) || 80) + 1) + entry.path;
        var image = document.createElement('img');
        image.src = imagePath;
        image.className = 'view';
        var a = document.createElement('a');
        a.href = imagePath;
        a.target = "_blank";
        a.appendChild(image);
        editor.appendChild(a);
    }
    else {
        connection.loadFile(entry.path, function (err, file) {
            if (err) {
                var errorBar = document.createElement('div');
                errorBar.className = 'error'
                errorBar.innerHTML = '<b>Unable to open file:</b> ' + err;
                editor.appendChild(errorBar);
                $(errorBar).hide();
                $(errorBar).fadeIn(250);
            }
            else {
                var aceEditor = document.createElement('div');
                aceEditor.id = 'ace-editor-' + new Date().getTime();
                aceEditor.className = 'ace_focus';
                aceEditor.setAttribute('style', "position: absolute;top: 40px;margin: 0;bottom: 0;left: 0;right: 0;border-top: solid 1px #ddd;");
                editor.appendChild(aceEditor);

                var editors = editors || {};

                editors[aceEditor.id] = createAceEditor(aceEditor.id, file, entry.path, {
                    onChange:function () {
                        console.log('content is changed..');
                        content = editors[aceEditor.id].getValue();
                        changed = true;
                    }
                });

                var content = file;
                var changed = false;
                var saving = false;

                setInterval(function () {
                    if (changed && !saving) {
                        console.log('to save file...');
                        var done = false;
                        saving = true;
                        var selected = $('.selected');
                        selected.addClass('syncing');
                        connection.saveFile(entry.path, content, function (err) {
                            console.log('save ok...');
                            if (!err) {
                                changed = false;
                                done = true;
                                selected.removeClass('syncing');
                            }
                            saving = false;
                        })
                        setTimeout(function () {
                            if (!done) {
                                saving = false;
                            }
                        }, 3000);
                    }
                }, 5000);
            }
        })
    }

    return editor;
};

var DirectoryEditor = window.DirectoryEditor = function (entry) {
    var editor = document.createElement('div');
    editor.className = 'directory-editor';
    var actionsBar = document.createElement('div');
    actionsBar.className = 'actions';
    actionsBar.innerHTML = '<b>' + cwd + entry.path + '</b> ';
    var renameButton = document.createElement('button');
    renameButton.innerHTML = 'Rename';
    $(renameButton).click(function (e) {
        var newName = prompt('New folder name:', entry.name);
        console.log('new folder name is: ', newName);
        if (newName) {
            var oldpath = entry.path;
            var newpath = (oldpath.indexOf('\\') != -1) ? oldpath.substring(0, oldpath.lastIndexOf('\\')) + '\\' + newName : oldpath.substring(0, oldpath.lastIndexOf('/')) + '/' + newName;
            connection.renameDirectory(oldpath, newpath);
        }
    })
    actionsBar.appendChild(renameButton);
    editor.appendChild(actionsBar);
    return editor;
};


var ui, connection;
var cwd = "";
$(function () {
    connection = new ServerConnection();
    ui = new UI();
});

