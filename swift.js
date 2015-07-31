(function () {
    "use strict";
    var sw;
    var queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;

    $.fn.find_with_root = function(selector) {
        return this.filter(selector).add(this.find(selector));
    };

    //based on http://www.quirksmode.org/js/cookies.html
    function createCookie(name,value,days) {
        var expires;
        if (days) {
            var date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            expires = "; expires="+date.toGMTString();
        } else { expires = ""; }
        document.cookie = name+"="+value+expires+"; path=/";
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') { c = c.substring(1,c.length); }
            if (c.indexOf(nameEQ) === 0) { 
                return c.substring(nameEQ.length,c.length);
            }
        }
        return null;
    }

    function debug (){
        console.log(arguments);
    }

    var cache = { data : {}, templates : {} };

    function Swift (){
        var self = this;
        self.routes = {};
        self.params = {};
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
            };
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
    * helpers
    ==========================================================================*/
    var isObserved = Swift.prototype.isObserved = function(data){
        return (typeof data === "function" && 
                 data.sw_observe === true);
    }

    function isDefined (val){
        return typeof val !== "undefined";
    }

    /*=========================================================================
    * compute
    ==========================================================================*/
    var _calledObservables = false;
    Swift.prototype.compute = function(cb, obsevedValues){
        var registarLater = [];
        var observed = [];
        var autoObserver = obsevedValues ? false : true;
        var computed = function (){
            var result;
            if (!obsevedValues){
                obsevedValues = [];
                _calledObservables = [];
                result = cb.apply(this, arguments);
                $(_calledObservables).each(function(i, o){
                    obsevedValues.push(o);
                });

                $(registarLater).each(function(i, obj){
                    computed.register(obj);
                });
                
                registarLater = [];
            } else {
                result = cb.apply(this, arguments);
            }

            return result;
        };

        computed.register = function(obj, ns){
            if (registarLater.indexOf(obj) === -1){
                registarLater.push(obj);
            }

            $(obsevedValues).each(function(i, observe){
                observe.register(obj, ns);
            });
        };

        computed.update = function(d){
            $(obsevedValues).each(function(i, observe){
                observe.update(d);
            });
        };

        computed.sw_observe  = true;
        computed.sw_computed = true;
        return computed;
    };

    /*=========================================================================
    * observe
    ==========================================================================*/
    Swift.prototype.observe = function(data){
        var _data = data;
        var parentNode;
        var namespace;
        var nodes = [];
        var compute = [];

        var type = (typeof data === "object") ?
                    ($.isArray(data)) ? "array" : "Object" :
                    "string";

        var updateObserved = function () {
            $(compute).each(function(i, obj){
                if (obj.update){
                    obj.update();
                } else {
                    obj.node.triggerHandler("sw." + obj.type);
                }
            });
        };

        var observe = function(key, val){
            if ( _calledObservables && 
                _calledObservables.indexOf(observe) === -1 ){
                _calledObservables.push(observe);
            }

            //set strings & numbers
            if (type === "string" && isDefined(key)) {
                if (_data === key) { return; }
                _data = key;
                updateObserved();
                return;
            }

            if (isDefined(key)){
                if (!isDefined(val)){
                    if (type === 'array' && typeof key !== 'number'){
                        key = _data.indexOf(key);
                    }
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

        observe.type = type;
        
        observe.set = function(key, val){
            _data[key] = val;
            if (parentNode){
                $(parentNode).each(function(i, obj){
                    var nodes = obj.nodes;
                    nodes[key].find_with_root(".sw").each(function(i){
                        var node = $(this);
                        setTimeout(function(){
                            node.triggerHandler("sw.update", val);
                        }, 1);
                    });
                });
                
                updateObserved();
            }
        };

        observe.update = function(data){
            if (data){
                if (type === 'array'){
                    observe.removeAll();
                    $(data).each(function(i, item){
                        observe.push(item);
                    });
                }
            } else {
                $(nodes).each(function(i, node){
                    node.triggerHandler(namespace);
                });
                updateObserved();
            }
        };

        observe.removeAll = function(){
            $(_data).each(function(){
                observe.shift();
            });
        };

        observe.sort = function(fn){
            _data.sort(fn);
            if (parentNode){
                $(parentNode).each(function(i, obj){
                    var nodes = obj.nodes;
                    $(nodes).each(function(i, n){
                        n.remove();
                        nodes.shift();
                    });

                    $(_data).each(function(i, d){
                        var elements = obj.parent.triggerHandler(namespace, d);
                        $(elements).each(function(i, element){
                            obj.nodes.push(element);
                        });
                    });
                });
            }
            updateObserved();
        };

        observe.each = function(cb){
            $(_data).each(function(i, data){
                cb(i, data);
            });
        };

        observe.push = function(data){
            _data.push(data);
            if (parentNode){
                $(parentNode).each(function(i, obj){
                    var elements = obj.parent.triggerHandler(namespace, data);
                    $(elements).each(function(i, element){
                        obj.nodes.push(element);
                    });
                });
            }
            updateObserved();
        };

        observe.unshift = function(data){
            _data.unshift(data);
            if (parentNode){
                $(parentNode).each(function(i, obj){
                    var elements = obj.parent.triggerHandler(namespace, data);
                    $(elements).each(function(i, element){
                        obj.nodes.unshift(element);
                        element.prependTo(obj.parent);
                    });
                });
            }
            updateObserved();
        };
        
        observe.remove = function(items){
            if (!$.isArray(items)) { items = [items]; }
            $(items).each(function(i, item){
                var index = _data.indexOf(item);
                if (index !== -1){
                    observe.splice(index, 1);
                }
            });
        };

        observe.splice = function(start, end){
            _data.splice(start, end);
            if (parentNode){
                $(parentNode).each(function(i, obj){
                    var nodes = obj.nodes;
                    for (var i = start; i < start+end; i++){
                        var el = nodes[i];
                        if (el) {
                            el.remove();
                        }
                    }
                    nodes.splice(start, end);
                });
            }
            updateObserved();
        };

        observe.shift = function(){
            observe.splice(0, 1);
        };

        observe.pop = function(){
            var last = _data.length - 1;
            var ret = _data[last];
            observe.splice(last, 1);
            return ret;
        };

        observe.indexOf = function(data){ return _data.indexOf(data); };
        
        observe.registerParent = function(node, ns){
            var parent_object = {
                parent : node,
                nodes  : []
            };

            $(nodes).each(function(i, u){
                parent_object.nodes.push(u);
            });

            nodes = [];
            
            if (parentNode){
                parentNode.push(parent_object);
            } else {
                parentNode = [parent_object];
            }
            namespace = "sw." + ns;
        };

        observe.registerArray = function(node, ns){
            nodes.push(node);
            namespace = "sw." + ns;
        };

        observe.register = function(obj){
            if (compute.indexOf(obj) === -1){
                compute.push(obj);
            }
        };

        observe.type = type;
        observe.sw_observe = true;
        observe.data = _data;
        return observe;
    };


    /*=========================================================================
    * Rendering methods
    ==========================================================================*/
    var _actionMap = {
        'submit' : {
            init : function(){
                var self = this;
                self.node.on("submit", function(e){
                    e.preventDefault();
                    self.valueAccess(self.data);
                    return false;
                });
            },
        },

        'dblclick' : {
            init : function(){
                var self = this;
                self.node.on("dblclick", function(){
                    self.valueAccess(self.data);
                    return false;
                });
            },
        },

        'click' : {
            init : function(){
                var self = this;
                self.node.on("click", function(){
                    self.valueAccess(self.data);
                    return false;
                });
            }
        },

        'check' : {
            init : function(){
                var self = this;
                self.node.on("change", function(){
                    self.val = self.node.prop("checked");
                    self.valueAccess(self.data);
                    return false;
                });
            }
        },

        'enable' : {
            update : function(){
                this.node.prop('disabled', this.valueAccess(this.data) ? "" : "disabled");
            }
        },

        'disable' : {
            update : function(){
                this.node.prop('disabled', this.valueAccess(this.data) ? "disabled" : "");
            }
        },

        'caption' : {
            init : function(){
                this.node.prepend("<option selected>" + 
                    (this.val ? this.val : this.name) +
                    "</option>");
            }
        },

        'text' : {
            update : function(){
                this.val = this.valueAccess();
                this.node.text(this.val);
            }
        },

        'html' : {
            update : function(){
                this.val = this.valueAccess();
                this.node.html(this.val);
            }
        },

        'func' : {
            init : function(){
                this.valueAccess(this.data);
            }
        },

        'class' : {
            update : function(){
                var _class = "";
                this.val = this.valueAccess();
                if (typeof this.val === "string") {
                    if (this.val === ""){
                        _class = this._class;
                    } else {
                        this._class = this.val;
                        _class = this.val;
                    }
                } else {
                    _class = this.name;
                }
                this.node[this.val ? "addClass" : "removeClass"](_class);
            }
        },

        'toggleClass' : {
            update : function(){
                this.val = this.valueAccess();
                if (this._oldClass){
                    this.node.removeClass(this._oldClass);
                }
                
                if (this.val){
                    this.node.addClass(this.val);
                    this._oldClass = this.val;
                }
            }
        },

        'attr' : {
            init : function () {
                var self = this;
                self.after(['attrVal'], function(obj){
                    obj._parent = self;
                    self.attr = self.str;
                    self.node.attr(self.attr, obj.valueAccess());
                });
            }
        },

        'attrVal' : {
            update : function(){
                var self = this;
                if (self._parent){
                    var parent = self._parent;
                    parent.node.attr(parent.attr, self.valueAccess());
                }
            }
        },

        'value' : {
            init : function () {
                var self = this;
                if (self.observe){
                    self.node.on("change.sw", function(){
                        self.valueAccess(self.node.val());
                    });
                }
            },

            update : function(){
                this.node.val(this.valueAccess());
            }
        },

        'valueUpdate' : {
            init : function(){
                var self = this;
                self.node.on('keydown', function(){
                    setTimeout(function(){
                        self.node.triggerHandler("change.sw");
                   }, 1);
                });
            }
        },

        'checked' : {
            init : function(){
                var self = this;
                if (self.observe){
                    self.node.on("change", function(){
                        self.valueAccess(self.node.prop("checked"));
                    });
                }
            },
            update : function(){
                this.node.prop( "checked", this.valueAccess() ? true : false );
            }
        },

        'visible' : {
            update : function(){
                if ( this.valueAccess() ){ this.node.show(); } 
                else { this.node.hide(); }
            }
        },

        'invisible' : {
            update : function(){
                if ( this.valueAccess() ){ this.node.hide(); } 
                else { this.node.show(); }
            }
        },

        'options' : {
            init : function (){
                var self = this;
                var node = self.node;
                var updateSelected;
                var optionsAttr;
                //wait other bindings to load
                self.after(['selectedOptions', 'optionsAttr'], function(){
                    self.val = self.valueAccess();
                    node.off("sw.options");
                    node.attr("data-sw-bind", "foreach: " + self.name);
                    
                    if (self.bindings.selectedOptions){
                        updateSelected = self.bindings.selectedOptions.observe;
                    }

                    if (self.bindings.optionsAttr){
                        optionsAttr = self.bindings.optionsAttr.valueAccess();
                    } else {
                        optionsAttr = "text : $data, value: $data";
                    }
                    
                    //convert to foreach and trigger
                    node.attr("data-sw-bind", "foreach: " + self.name);
                    node.append("<option data-sw-bind='" + optionsAttr + "'></option>");
                    self.applyForeach();
                    
                    if (updateSelected) {
                        node.on("change.sw", function(){
                            var data = self.observe ? self.observe.data : self.val;
                            if (!$.isArray){ data = [data]; }
                            var newArr = [];
                            var selectedNodes = $(this).find(":selected");
                            $(selectedNodes).each(function(){
                                var index = $(this).index();
                                var val = data[index];
                                newArr.push(val);
                            });
                            updateSelected.update(newArr);
                        });

                        self.select = function(){
                            var data = self.observe ? self.observe.data : self.val;
                            var items = updateSelected();
                            if (!$.isArray(items)){ items = [items]; }
                            self.node.find(":selected").prop('selected', false);
                            $(items).each(function(i, item){
                                var index = data.indexOf(item);
                                self.node.find('option').eq(index).prop('selected', true);
                            });
                        };

                        self.select();
                        updateSelected.register(self);
                        self.node.on("sw.options", self.select);
                    }
                });
            }
        },

        optionsAttr : {
            compile : function(){
                return this.str; 
            }
        }
    };
    
    Swift.prototype.getBinding = function(name){
        return _actionMap[name];
    };

    Swift.prototype.registerBinding = function(name, action){
        _actionMap[name] = action;
    };
    
    var RootObject;
    function _parseActions (str, node, data, parent){
        var bindings = {};
        var array = str.match(/\{\{.*\}\}/g);
        str = str.replace(/\{\{.*\}\}/, '[[00]]');

        var models = str.split(',');
        $(models).each(function(i, model){
            var compile;
            var actions = model.split(":");
            var type    = $.trim(actions[0]);
            var name    = $.trim(actions[1]);

            var root    = 'self';
            type   = name ? type : "func";
            name = name ? name : type;
            //parse root.name
            var prop = name.split('.');
            if (prop.length === 2){
                name = prop[1];
                root = prop[0];
            }
            
            if (name === '[[00]]'){ 
                name = array.shift();
                //remove leading {{ and ending }}
                name = $.trim(name.substring(2, name.length - 2));
                compile = name;
            }

            if (type === 'foreach'){
                var html = node.clone().html();
                node.html("");
            }
            
            var self = {
                bindings : bindings,
                str      : name,
                //TODO: better way to detect previous loaded bindings
                after    : function(names, cb){
                    var len = names.length;
                    $(names).each(function(i, name){
                        if (bindings[name]){
                            var timeout = setInterval(function(){
                                if (bindings[name].initiated){
                                    clearInterval(timeout);
                                    if (--len === 0) { cb(bindings[name]); }
                                }
                            }, 10);
                        } else { --len; }
                    });
                    if (len === 0){ cb(bindings[name]); }
                },
                applyForeach : function(data){
                    sw.render(data || this.data, this.node);
                    //this.node.removeAttr('data-sw-bind');
                },
                render : function(data){
                    this.node.removeAttr('data-sw-bind');
                    sw.render(data || this.data, this.node);
                },
                root : RootObject
            };

            bindings[type] = self;
            self.initiated = false;
            node.on("sw." + type, function init (e, currentData){
                
                //zepto dosn't provide a name space
                var namespace = '';
                if (!e.hasOwnProperty('namespace')){
                    var ns = e.type.split('.');
                    namespace = ns[1] || '';
                } else {
                    namespace = e.namespace;
                }

                var val;
                if (currentData && namespace !== 'update'){
                    val = currentData;
                } else {
                    if (name === '$data'){
                        val = data;
                    } else if (root === 'self'){
                        val = data[name];
                    } else if (root === 'parent') {
                        val = parent[name];
                    } else if (root === 'root'){
                        val = RootObject[name];
                    } else {
                        val = data[root][name];
                    }
                }
                
                var observe = val;
                var _isObserved = isObserved(observe);
                if (_isObserved){
                    self.observe = observe;
                    val = val.data;
                }

                var element;
                if (type === 'foreach'){
                    var oldRoot = RootObject;
                    RootObject = self.root;
                    if (!$.isArray(val)){ val = [val]; }
                    var all = [];
                    $(val).each(function(i, d){
                        element =  $(html);
                        sw.constructActions(d, element, data);
                        node.append(element);
                        if (_isObserved) {
                            observe.registerArray(element, type);
                        } else {
                            all.push(element);
                        }
                    });
                    
                    RootObject = oldRoot;
                    if (_isObserved) {
                        observe.registerParent(node, type);
                    }

                    return all;
                } else {
                    element = node;
                    var binding = _actionMap[type];

                    if (typeof observe === 'function'){
                        self.valueAccess = function(d){
                            self.val = observe.call(self, d);
                            return self.val;
                        };
                    } else {
                        self.valueAccess = function(){
                            return val;
                        };
                    }

                    self.data = data;
                    self.node = element;
                    self.name = name;
                    self.type = type;

                    if (binding){
                        if (compile && binding.compile){
                            self.valueAccess = function(){
                                return binding.compile.call(self, data);
                            };
                        } else if (compile){
                            if (!self.compiled){
                                var fn = new Function('self', "return " + compile);
                                self.compiled = sw.compute(function compile(){
                                    return fn.call(self, self.data);
                                });
                                
                                self.compiled.register(self);
                            }
                            self.valueAccess = function(d){
                                self.val = self.compiled.apply(self, arguments);
                                return self.val;
                            };
                        }

                        if (!self.initiated){
                            if (binding.init){
                                binding.init.call(self, data);
                            }

                            if ( _isObserved ) {
                                observe.register(self);
                            }

                            if (binding.update){
                                element.addClass('sw').on("sw.update", init);
                            }
                        }

                        if (binding.update){
                            binding.update.call(self, data);
                        }

                    } else {
                        console.log("Not Found " + type);
                    }

                    self.initiated = true;
                }
            });
        });
    }

    Swift.prototype.constructActions = function(data, tree, parent) {
        var Nodes = [];
        var i = 0;
        while (1) {
            var n = tree.find_with_root('[data-sw-bind]').get(i++);
            if (!n){ break; }
            n = $(n);
            _parseActions(n.attr('data-sw-bind'), n, data, parent);
            Nodes.push(n);
        }

        $(Nodes).each(function(i, n){
            n.triggerHandler('sw');
        });
    };

    Swift.prototype.renderElement = function(el, obj, parent){
        RootObject = obj;
        _parseActions(el.attr('data-sw-bind'), el, obj, parent);
        el.triggerHandler('sw');
    };

    Swift.prototype.render = function(obj, doc){
        RootObject = obj;
        doc = doc ? $(doc) : $(document);
        this.constructActions(obj, doc);
    };

    //=========================================================================
    Swift.prototype.model = function (name, obj){
        this.models[name] = obj;
    };

    Swift.prototype._fireRouter = function (){
        var self = this;
        var location = window.location.hash;
        self.location = location;
        var res = location.split('?');
        self.hash = res[0];
        self.query = res[1];
        self.path = self.hash.substr(1);

        if (/^!/.test(self.path)){
            self.path = self.path.substr(1);
        }

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
        if (fn && typeof fn === 'function'){
            fn.apply(self,[self]);
        } else if (fn && typeof fn === 'string' && require && 
                    typeof require === 'function'){

            require(self.controllersPath + fn, function(ret){
                if (typeof ret === 'function'){
                    ret.apply(self,[self]);
                }
            });
        }
    };
    
    Swift.prototype.not_found = function (fn){
        this._not_found = fn;
    };

    /*=========================================================================
    * functions to run before routing
    ==========================================================================*/
    Swift.prototype.before_route = function (fn){
        this._before_route.push(fn);
    };

    Swift.prototype.route = function (name, fn){
        this.routes["#" + name] = fn;
    };

    Swift.prototype.before_view = function (name, cb){
        if (arguments.length === 1) {
            cb = name;
            name = '*';
        }
        
        this._before_view.push({
            name : name,
            cb : cb
        });
    };

    Swift.prototype.view = function (elem, url, cb) {
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
            el.show();
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

    Swift.prototype.param = function (name) {
        return this.params[name];
    };

    Swift.prototype.cookie = function (name, value, days) {
        if (arguments.length === 1){
            return readCookie(name);
        } else {
            createCookie(name, value, days);
        }
    };
    
    Swift.prototype.redirect = function (where, params) {
        if (params){
            var str = [];
            for (var key in params){
                str.push(key + '=' + params[key]);
            }
            where += '?' + str.join('&');
        }
        window.location.hash = where;
    };

    Swift.prototype.stash = function (name,val) {
        if (val){
            this._stash[name] = val;
        } else {
            val = this._stash[name];
            delete this._stash[name];
        }
        return val;
    };
    
    Swift.prototype.cache = function (name,val) {
        if (val){
            cache.data[name] = val;
        } else {
            val = cache.data[name];
        }
        return val || {};
    };

    Swift.prototype.run = function () {
        this._fireRouter();
    };

    if (typeof require === 'function'){
        define(['jQuery'], function(require, exports, $){
            sw = this.exports = new Swift();
        });
    } else {
        sw = window.sw = window.Swift = new Swift();
    }
}());
