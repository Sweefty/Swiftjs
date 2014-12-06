define(['jQuery'], function(require, exports, $){
    "use strict";
    
    var queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;
    function _nob (){}

    //based on http://www.quirksmode.org/js/cookies.html 
    function createCookie(name,value,days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            var expires = "; expires="+date.toGMTString();
        } else { var expires = ""; }
        document.cookie = name+"="+value+expires+"; path=/";
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') { c = c.substring(1,c.length); }
            if (c.indexOf(nameEQ) == 0) { 
                return c.substring(nameEQ.length,c.length); 
            }
        }
        return null;
    }

    
    function swift (){
        var self = this;
        self.routes = {};
        self.params = {};
        self.elements = {};
        self.templates = {};
        self._cache = {};
        self._stash = {};
        self._before_route = [];
        self._before_view  = [];
        self.path = '';
        self.location = '';

        //paths
        self.templatesPath = '';
        self.controllersPath = '';

        if (("onhashchange" in window)) {
            window.onhashchange = function () {
                self._fireRouter();
            }
        } else {
            var prevHash = window.location.hash;
            window.setInterval(function () {
                if (window.location.hash !== prevHash) {
                    prevHash = window.location.hash;
                    self._fireRouter();
                }
            }, 100);
        }
    }

    swift.prototype._fireRouter = function (name, fn){
        var self = this;
        var location = window.location.hash;
        self.location = location;
        var res = location.split('?');
        self.hash = res[0];
        self.query = res[1];
        self.path = self.hash.substr(1);

        //reset params
        self.params = {};

        //parse params if there are any
        if (self.query && self.query !== ''){
            self.query.replace(queryParser, function ($0, $1, $2) {
                if ($1) { self.params[$1] = $2; }
            });
        }
        
        //fire before routes actions
        //if one of the before_route function returns false
        //routing will stop and will not dispatch
        if (self._before_route.length){
            var ret = true;
            $(self._before_route).each(function(i,f){
                ret = f.apply(self,[self]);
                if (ret === false){
                    return;
                }
            });
            if (ret === false){ return; }
        }

        //fire router callback
        var fn = self.routes[self.hash] || self._not_found;
        if (typeof fn === 'function'){
            fn.apply(self,[self]);
        } else if (typeof fn === 'string' && require && 
                    typeof require === 'function'){
            require(self.controllersPath + fn, function(ret){
                if (typeof ret === 'function'){
                    ret.apply(self,[self]);
                }
            });
        }
    };
    
    swift.prototype.not_found = function (fn){
        this._not_found = fn;
    };

    swift.prototype.before_route = function (fn){
        this._before_route.push(fn);
    };

    swift.prototype.route = function (name, fn){
        this.routes["#" + name] = fn;
    };

    swift.prototype.controller = function () {
        
    };

    swift.prototype.param = function (name) {
        return this.params[name];
    };

    swift.prototype.render = function (elem, name, cb) {
        var self = this;
        var container = $(elem);
        var el   = self.elements[name];
        var html = el.html.clone();
        if (el){
            container.html(html);
            container.find('[data-swRender]').each( function(){
                var item = $(this);
                var renderElement = item.attr('data-swRender');
                //prevent nested rendering
                if (renderElement === name){
                    throw new Error('nested rendering not allowed');
                }
                self.render(item, renderElement, cb);
            });

            if (!cb){
                cb = el.cb;
            }

            if (cb && typeof cb === 'function'){
                cb.apply(self,[html,container]);
            }
        }
    };

    swift.prototype.before_view = function (name, cb){
        if (arguments.length === 1) {
            cb = name;
            name = '*';
        }
        this._before_view.push({
            name : name,
            cb : cb
        });
    };

    swift.prototype.view = function (elem, url, cb) {
        var self = this;
        var el = $(elem);
        el.hide();
        var _fireAfterLoad = function(el){
            var html = self.templates[url];

            //run before views actions
            if (self._before_view.length){
                $(self._before_view).each(function(i, v){
                    if ( v.name === '*' || v.name === url || 
                         $(v.name)[0] === el[0] ){

                        html = v.cb.apply(self,[html]);
                    }
                });
            }

            el.html(html);
            el.find('[data-swRender]').each( function(){
                var item = $(this);
                var renderElement = item.attr('data-swRender');
                self.render(item, renderElement);
            });

            if (cb && typeof cb === 'function'){
                cb.apply(self, [el]);
            }
            el.fadeIn(500);
        };

        if (self.templates[url]){
            _fireAfterLoad(el);
        } else {
            $.ajax({
                url: self.templatesPath + url,
                success: function(data){
                    self.templates[url] = data;
                    _fireAfterLoad(el);
                },
                error : function(jqXHR, textStatus, error){
                    alert('error ' + error);
                    console.log(error);
                },
                cache: false
            });
        }
    };

    swift.prototype.element = function (name, html, callback) {
        if (typeof html === 'function'){
            callback = html;
            html = '';
        } else if ($.isArray(html)) {
            html = html.join("\n");
        } else {
            html = $(html);
        }

        this.elements[name] = {
            html : $(html),
            cb : callback
        };
        return this.elements[name];
    };

    swift.prototype.loadElements = function (url) {
        var self = this;
        $.ajax({
            url: url,
            success: function(data){
                var el = $('<div style="display:none" />');
                el.appendTo('body');
                el.html(data);
                el.find('[data-swElement]').each(function(i, v){
                    var item = $(this);
                    var name = item.attr('data-swElement');
                    var cb = self.elements[name] ? self.elements[name].cb : _nob;
                    self.element(name,item,cb);
                });
                el.remove();
            },
            error : function(jqXHR, textStatus, error){
                alert('error ' + error);
                console.log(error);
            },
            cache: false
        });
    };

    swift.prototype.cookie = function (name,value,days) {
        if (arguments.length === 1){
            return readCookie(name);
        } else {
            createCookie(name,value,days);
        }
    };
    
    swift.prototype.redirect = function (where) {
        window.location.hash = where;
    };

    swift.prototype.stash = function (name,val) {
        if (val){
            this._stash[name] = val;
        } else {
            val = this._stash[name];
            delete this._stash[name];
        }
        return val;
    };
    
    swift.prototype.cache = function (name,val) {
        if (val){
            this._cache[name] = val;
        } else {
            val = this._cache[name];
        }
        return val || {};
    };

    swift.prototype.run = function () {
        this._fireRouter();
    };

    this.exports = new swift();
});
