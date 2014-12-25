(function () {
    "use strict";
    
    var queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;
    function _nob (){}

    $.fn.find_with_root = function(selector) {
        return this.filter(selector).add(this.find(selector));
    };

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

    function Computed (){

    }

    var cache = {
        data : {},
        templates : {}
    };

    function swift (){
        var self = this;
        self.routes = {};
        self.params = {};
        self.elements = {};
        self.models = {};
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

    /*=========================================================================
    * Render
    ==========================================================================*/
    function isObserved (data){
        return (typeof data === "function" && 
                 data.sw_observe === true);
    }

    function isDefined (val){
        return typeof val !== "undefined";
    }
    
    swift.prototype.observe = function(data){
        var _data = data;
        var elements = [];

        var type = (typeof data === "object") ?
                    ($.isArray(data)) ? "array" : "Object" :
                    "string";

        var observe = function(key, val){
            //set strings & numbers
            if (type === "string" && isDefined(key)) {
                _data = key;
                $(elements).each(function(a, obj){
                    $(obj.elements).each(function(b, element){
                        $(obj.actions).each(function(c, action){
                            action(element, _data);
                        });
                    });
                });
                return;
            }

            if (!isDefined(val)){ return _data; }
            
            //set Array & objects
            if (isDefined(val)){
                observe.set(key, val);
            }

            //get array & objects
            else { return _data[key]; }
        };

        observe.set = function(i, d){
            _data[i] = d;
            $(elements).each(function(a, obj){
                var element = obj.elements[i];
                $(obj.actions).each(function(x, action){
                    action(element, _data[i]);
                });
            });
        };

        observe.refresh = function(){
            $(elements).each(function(a, obj){
                $(obj.elements).each(function(b, element){
                    $(obj.actions).each(function(c, action){
                        action(element, _data[b], b);
                    });
                });
            });
        };

        observe.push = function(data){
            _data.push(data);
            $(elements).each(function(a, obj){
                var node = $(obj.html);
                $(obj.actions).each(function(i, action){
                    action(node, data);
                });
                obj.doc.append(node);
                obj.elements.push(node);
            });
        };

        observe.unshift = function(data){
            _data.unshift(data);
            $(elements).each(function(a, obj){
                var node = $(obj.html);
                $(obj.actions).each(function(i, action){
                    action(node, data);
                });
                obj.doc.prepend(node);
                obj.elements.unshift(node);
            });
        };

        observe.pop = function(){
            var last = _data.length - 1;
            _data.pop();
            $(elements).each(function(a, obj){
                var lastEle = obj.elements[last];
                obj.elements.pop();
                lastEle.remove();
            });
        };

        observe.shift = function(){
            _data.shift();
            $(elements).each(function(a, obj){
                var lastEle = obj.elements[0];
                obj.elements.shift();
                lastEle.remove();
            });
        };

        observe.register = function(ele){
            elements.push(ele);
        };

        observe.type = type;
        observe.sw_observe = true;
        observe.data = _data;
        return observe;
    };

    var _actionsMap = {
        'value' : function(selector, prop){
            var t = function(root, data){
                var e = root.find_with_root('.' + selector);
                var text = "";
                if (isObserved(prop)) {
                    if (!e.hasClass('sw_init')){
                        var obs = { actions : [t], elements : [e] };
                        prop.register(obs);
                    }
                    e.addClass('sw_init');
                    text = prop();
                } else if (typeof prop === "function"){
                    text = prop(e);
                } else {
                    text = data[prop];
                }
                e.val(text);
            };
            return t;
        },
        'text' : function(selector, prop){
            var t = function(root, data, index){
                var e = root.find_with_root('.' + selector);
                var text = "";
                if (isObserved(prop)) {
                    if (!e.hasClass('sw_init')){
                        var obs = { actions : [t], elements : [e] };
                        prop.register(obs);
                    }
                    e.addClass('sw_init');
                    text = prop();
                } else if (typeof prop === "function"){
                    text = prop(e);
                } else {
                    text = data[prop];
                }
                e.text(text);
            };
            return t;
        },
        'test' : function(selector, prop){
            var t = function(root, data, index){
                var e = root.find_with_root('.' + selector);
                var text = "";
                if (isObserved(prop)){
                    if (!e.hasClass('sw_init')){
                        var obs = { actions : [t], elements : [e] };
                        prop.register(obs);
                    }
                    e.addClass('sw_init');
                    text = prop();
                } else if (typeof prop === "function"){
                    text = prop(e);
                } else {
                    text = data[prop];
                }
                e.text(text);
            };
            return t;
        },
        'click' : function(selector, prop, on){
            return function(root, data, index){
                var $this = root.find_with_root('.' + selector);
                $this.off("click");
                $this.click(function(){
                    if (typeof prop === "function") {
                        prop($this, data);
                    }
                });
            };
        },
        'custom' : function(selector, prop, on){
            return function(root, data, index){
                var $this = root.find_with_root('.' + selector);            
                if (typeof prop === "function") {
                    prop($this, data);
                }
            };
        }
    };

    swift.prototype.doRender = function(items, parent){
        var self = this;
        $(items).each(function(i, item){
            if (typeof item === "object" && item.isForeach ){
                var doc = item.doc;
                var html = item.clone.html();
                var _isObserved = isObserved(item.data);
                var foreach = _isObserved ? item.data.data : item.data;
                var obs = { actions : item.actions, elements : [], 
                            doc : doc, html : html };

                $(foreach).each(function(i, data){
                    var node = $(html);
                    $(item.actions).each(function(i, action){
                        action(node, data);
                    });
                    doc.append(node);
                    obs.elements.push(node);
                });
                if ( _isObserved ){ item.data.register(obs); }
            } else {
                item.action(item.element, parent);
                // console.log(item);
            }
        });
    };

    var _model    = [];
    var ele_count = 0;
    swift.prototype.render = function(obj, doc, p, m, isForeach){
        var self = this;
        var tree = doc ? $(doc) : $(document);
        var parent = p || obj;
        var pushTo = m || _model;

        //parse data-sw-foreach
        tree.find('[data-sw-foreach]').each( function(){
            var item = $(this);
            var data = item.attr('data-sw-foreach');
            var _isObserved = isObserved(obj[data]);
            var foreach = {
                isForeach : true,
                doc       : item,
                clone     : item.clone(true),
                data      : obj[data],
                actions   : [],
            };

            pushTo.push(foreach);
            item.html("");
            self.render(foreach.data, foreach.clone, obj, foreach.actions, true);
        });

        tree.find('[data-sw-bind]').each( function(i){
            var _class = "_sw_el_" + ele_count++;
            var item = $(this);
            item.addClass(_class);

            var models = item.attr('data-sw-bind').split(',');
            $(models).each(function(i, model){
                var action, prop;
                var actions = model.split(':');
                action = $.trim(actions[0]);
                if (actions[1]) { 
                    prop = $.trim(actions[1]); 
                } else {
                    prop = action;
                    action = 'custom';
                }
                
                var rootAction;
                var root = prop.split('.');
                if (root[0] === 'root'){
                    rootAction = parent[root[1]];
                }

                if (isForeach){
                    var fn = _actionsMap[action](_class, rootAction ? rootAction : prop);
                    pushTo.push(fn);
                } else {
                    var fn = _actionsMap[action](_class, parent[prop]);
                    pushTo.push({
                        element : item,
                        action  : fn 
                    });
                }
            });
        });

        if (!isForeach){ self.doRender(pushTo, parent); }
        return this;
    };
    //=========================================================================
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
        //routing will stop and will not continue dispatching
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

    swift.prototype.param = function (name) {
        return this.params[name];
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
            var html = cache.templates[url];

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

        if (cache.templates[url]){
            _fireAfterLoad(el);
        } else {
            $.ajax({
                url: self.templatesPath + url,
                success: function(data){
                    cache.templates[url] = data;
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
            cache.data[name] = val;
        } else {
            val = cache.data[name];
        }
        return val || {};
    };

    swift.prototype.run = function () {
        this._fireRouter();
    };

    if (typeof require === 'function'){
        define(['jQuery'], function(require, exports, $){
            this.exports = new swift();
        });
    } else {
        window.swift = new swift();
    }
}());
