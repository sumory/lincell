(function(menu) {
    jQuery.fn.contextmenu = function(options) {
        var defaults = {
            offsetX : 2,        //鼠标在X轴偏移量
            offsetY : 2,        //鼠标在Y轴偏移量
            items   : [],       //菜单项
            action  : $.noop()  //自由菜单项回到事件
        };
        var opt = menu.extend(true, defaults, options);
        function create(e) {
            var m = menu('<ul class="simple-contextmenu"></ul>').appendTo(document.body);
            
            menu.each(opt.items, function(i, item) {
                if (item) {
                    if(item.type == "split"){ 
                        menu("<div class='m-split'></div>").appendTo(m);
                        return;
                    }
                    var row   = menu('<li><a href="javascript:void(0)"><span></span></a></li>').appendTo(m);
                    item.icon ? menu('<img src="' + item.icon + '">').insertBefore(row.find('span')) : '';
                    item.text ? row.find('span').text(item.text) : '';
                    
                    if (item.action) {
                        row.find('a').click(function() {
                            item.action(e.target);
                        });
                    }
                }
            });
            return m;
        }
        
        this.live('contextmenu', function(e) {
            var m = create(e).show("fast");
            var left = e.pageX + opt.offsetX, top = e.pageY + opt.offsetY, p = {
                wh : menu(window).height(),
                ww : menu(window).width(),
                mh : m.height(),
                mw : m.width()
            }
            top = (top + p.mh) >= p.wh ? (top -= p.mh) : top;
            //当菜单超出窗口边界时处理
            left = (left + p.mw) >= p.ww ? (left -= p.mw) : left;
            m.css({
                zIndex : 10000,
                left : left,
                top : top
            });
            $(document.body).live('contextmenu click', function() {
                m.hide("fast",function(){
                    m.remove();
                });        
            });
            
            return false;
        });
        return this;
    }
})(jQuery);
