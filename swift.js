(function () {
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
        for(var i=0;i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') { c = c.substring(1,c.length); }
            if (c.indexOf(nameEQ) == 0) { 
                return c.substring(nameEQ.length,c.length);
            }
        }
        return null;
    }

    function debug (){
        console.log(arguments);
    }

    function Render (swift, elem, name, data){
        if (!$.isArray(data)){
            data = [data];
        }
        var self = this;
        self.swift = swift;
        self._data = data;
        self.elements = [];
        var container = self.container = $(elem);
        self.el = swift.elements[name];
        container.html("");

        if (self.el){
            $(self._data).each(function(index, f){
                var elementData = data[index];
                self.insert(index, elementData);
            });
        } else {
            debug("element " + name + " not found");
        }
    }

    Render.prototype.update = function(data){

    };

    Render.prototype.insert = function(index, data){
        var self = this;
        var swift = self.swift;
        var html = $("<div/>").append(self.el.html.clone());
        swift._loadSWDataModel(html, data, index);
        var renderedElement = html.children();
        self.container.append(renderedElement);
        self.elements.push({
            element : renderedElement,
            data    : data
        });
        html.remove();
    };

    Render.prototype.append = function(data){

    };

    Render.prototype.data = function(index){
        var self = this;
        var swift = this.swift;
        var data;
        
        if (typeof index !== "undefined"){
            data = this._data[index];
        } else {
            data = this._data;
        }

        var old  = JSON.stringify(data);
        setTimeout(function(){
            if (old !== JSON.stringify(data)){
                if (typeof index !== "undefined"){
                    var element = self.elements[index].element;
                    swift._loadSWDataModel(element, data, index);
                } else {
                    $.each(data, function(i){
                        var element = self.elements[i];
                        var elementData = data[i];
                        if (!element){
                            //new element added
                            self.insert(i, elementData);
                        } else {
                            if (element.data === elementData){
                                console.log("ok");
                            } else {
                                console.log(elementData);
                            }
                        }
                    });
                }
            }
        }, 60);
        return data;
    };

    function swift (){
        var self = this;
        self.routes = {};
        self.params = {};
        self.elements = {};
        self.templates = {};
        self.models = {};
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

    swift.prototype._loadSWDataModel = function(ele, data, index){
        var swift = this;
        ele.find('[data-sw-model]').each( function(){
            var item = $(this);
            item.off();
            var models = item.attr('data-sw-model').split(':');
            for (var i = 0; i < models.length; i++){
                var model = swift.models[models[i]];
                if (model && typeof model === "function"){
                    model.apply(this, [data || {}, index || 0]);
                }
            }
        });
    };

    swift.prototype.model = function (name, obj){
        this.models[name] = obj;
    };

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

    swift.prototype.render = function (elem, name, data) {
        return new Render(this, elem, name, data);
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
                    debug(error);
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
                    var cb = _nob
                    var script = $(this).find('script');
                    if ($(script).length){
                        
                    }
                    var name = item.attr('data-swElement');
                    self.element(name, item, cb);
                });
                el.remove();
            },
            error : function(jqXHR, textStatus, error){
                debug(error);
            },
            cache: false,
            async : false
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
        this._loadSWDataModel( $('body') );
    };

    if (typeof require === 'function'){
        define(['jQuery'], function(require, exports, $){
            this.exports = new swift();
        });
    } else {
        window.swift = new swift();
    }
}());
