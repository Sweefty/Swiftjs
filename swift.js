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

    var cache = { data : {}, templates : {} };

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

    function callAction (action, node, data, val){
        action.call({
            el : node,
            data : data,
            val : val
        }, node, data, val);
    }

    swift.prototype.compute = function(cb, obsevedValues){
        var computed = function (){
            return cb.apply(this, arguments);
        };

        computed.sw_observe  = true;
        computed.sw_computed = true;
        computed.register = function(ele){
            $(obsevedValues).each(function(i, v){
                v.register(ele);
            });
        };

        computed.update = function(ele){
            $(obsevedValues).each(function(i, v){
                v.update();
            });
        };
        return computed;
    };

    swift.prototype.observe = function(data, cb){
        var _data = data;
        var _cb   = cb;
        var observed = [];

        var type = (typeof data === "object") ?
                    ($.isArray(data)) ? "array" : "Object" :
                    "string";

        var observe = function(key, val){
            //set strings & numbers
            if (type === "string" && isDefined(key)) {
                _data = key;
                $(observed).each(function(a, obj){
                    $(obj.elements).each(function(b, element){
                        $(obj.actions).each(function(c, action){
                            callAction(action, element, _data);
                        });
                    });
                });
                return;
            }

            if (isDefined(key)){
                if (!isDefined(val)){
                    var obj = _data[key];
                    var old = JSON.stringify(obj);
                    setTimeout(function(){
                        if (old !== JSON.stringify(_data[key])){
                            observe.set(key, _data[key]);
                        }
                    }, 10);
                    return obj;
                } else {
                    observe.set(key, val);
                }
            }
            return _data;
        };
        
        observe.set = function(key, val){
            _data[key] = val;
            $(observed).each(function(a, obj){
                var element = obj.elements[key];
                $(obj.actions).each(function(x, action){
                    callAction(action, element, _data[key]);
                });
            });
        };

        observe.update = function(){
            $(observed).each(function(a, obj){
                $(obj.elements).each(function(b, element){
                    $(obj.actions).each(function(c, action){
                        callAction(action, element, _data[b]);
                    });
                });
            });
        };

        observe.push = function(data){
            _data.push(data);
            $(observed).each(function(a, obj){
                var node = $(obj.html);
                $(obj.actions).each(function(i, action){
                    callAction(action, node, data);
                });
                obj.doc.append(node);
                obj.elements.push(node);
            });
        };

        observe.unshift = function(data){
            _data.unshift(data);
            $(observed).each(function(a, obj){
                var node = $(obj.html);
                $(obj.actions).each(function(i, action){
                    callAction(action, node, data);
                });
                obj.doc.prepend(node);
                obj.elements.unshift(node);
            });
        };

        observe.pop = function(){
            var last = _data.length - 1;
            _data.pop();
            $(observed).each(function(a, obj){
                var lastEl = obj.elements[last];
                obj.elements.pop();
                lastEl.remove();
            });
        };

        observe.each = function(cb){
            $(_data).each(function(i, item){
                cb(i, item);
            });
        };
        
        observe.remove = function(item){
            var index = _data.indexOf(item);
            observe.splice(index,1);
        };

        observe.splice = function(start, end){
            var last = _data.length - 1;
            _data.splice(start, end);
            $(observed).each(function(a, obj){
                for (var i = start; i < start+end; i++){
                    var el = obj.elements[i];
                    el.remove();
                }
                obj.elements.splice(start, end);
            });
        };

        observe.shift = function(){
            _data.shift();
            $(observed).each(function(a, obj){
                var firstEl = obj.elements[0];
                obj.elements.shift();
                firstEl.remove();
            });
        };

        observe.indexOf = function(data){ return _data.indexOf(data) };

        observe.register = function(ele){ observed.push(ele); };
        observe.limit = function(ms){
            return observe;
        };

        observe.type = type;
        observe.sw_observe = true;
        observe.data = _data;
        return observe;
    };


    function dispatchActions (selector, prop, type){
        //click + any other custom action
        var custom_actions = {
            'click' : function(root, data){
                var $this = root.find_with_root('.' + selector);
                $this.off("click");
                $this.click(function(){
                    if (typeof prop === "function") {
                        callAction(prop, $this, data);
                    }
                });
            },
            'oncheck' : function (root, data){
                var $this = root.find_with_root('.' + selector);
                $this.off("change");
                $this.change(function(){
                    var dir = $this.prop("checked");
                    if (isObserved(prop)){

                    } else if (typeof prop === "function") {
                        callAction(prop, $this, data, dir);
                    }
                });
            },
            'custom' : function(root, data){
                var $this = root.find_with_root('.' + selector);
                if (typeof prop === "function") {
                    callAction(prop, $this, data);
                }
            }
        };
        
        if (custom_actions[type]){
            return custom_actions[type];
        }

        //everything else
        var value_actions = {
            value : function(e, ret){ e.val(ret); },
            text  : function(e, ret){ e.text(ret); },
            check : function(e, ret){ e.prop( "checked", ret ? true : false ); },
            class : function(e, ret){
                var _class = "";
                if (typeof ret === "string") {
                    if (ret === ""){
                        _class = e.data("sw-class");
                    } else {
                        e.data("sw-class", ret);
                        _class = ret;
                    }
                } else {
                    _class = prop;
                }
                e[ret ? "addClass" : "removeClass"](_class);
            }
        };

        var a = function(root, data, cb){
            var ret;
            var e = root.find_with_root('.' + selector);
            if (isObserved(prop)) {
                if (!e.hasClass('sw_init')){
                    var obs = { actions : [a], elements : [e] };
                    prop.register(obs);
                }
                e.addClass('sw_init');
                ret = prop();
            } else if (typeof prop === "function"){
                ret = prop(e);
            } else {
                ret = data[prop];
            }
            value_actions[type](e, ret);
        };
        return a;
    }

    swift.prototype.doRender = function(items, parent){
        var self = this;
        $(items).each(function(i, item){
            if (typeof item === "object" && item.isForeach ){
                var doc = item.doc;
                var html = "<input type='hidden' class='sw-index'>" + item.clone.html();
                var _isObserved = isObserved(item.data);
                var foreach = _isObserved ? item.data.data : item.data;
                var obs = { actions : item.actions, elements : [], 
                            doc : doc, html : html };

                $(foreach).each(function(i, data){
                    var node = $(html);
                    $(item.actions).each(function(x, action){
                        callAction(action, node, data);
                    });
                    doc.append(node);
                    obs.elements.push(node);
                });
                if ( _isObserved ){ item.data.register(obs); }
            } else {
                callAction(item.action, item.element, parent);
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
                console.log(actions);
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

                try {
                    if (isForeach){
                        pushTo.push(dispatchActions(_class, rootAction ? 
                                                rootAction : prop, action));

                    } else {
                        pushTo.push({
                            element : item,
                            action  : dispatchActions(_class, parent[prop], action)
                        });
                    }
                } catch(e){ console.log(e) };
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
        window.sw = window.swift = new swift();
    }
}());
