/* global define */
(function() {
	'use strict';
	var sw;
	var queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;

	$.fn.find_with_root = function(selector) {
		return this.filter(selector).add(this.find(selector));
	};

	function debug() {
		if (sw.debug) {
			console.info('DEBUG');
			console.info(arguments);
		}
	}

	var cache = {
		data: {},
		templates: {}
	};

	function Swift() {
		var self = this;
		self.routes = {};
		self.params = {};
		self._stash = {};
		self._before_route = [];
		self._before_view = [];
		self.path = '';
		self.location = '';

		self.templatesPath = '';
		self.controllersPath = '';

		if (('onhashchange' in window)) {
			window.onhashchange = function() {
				self.fireRouter();
			};
		} else {
			var prevHash = window.location.hash;
			window.setInterval(function() {
				if (window.location.hash !== prevHash) {
					prevHash = window.location.hash;
					self.fireRouter();
				}
			}, 100);
		}
	}

	/*=========================================================================
	* helpers
	==========================================================================*/
	var isObserved = Swift.prototype.isObserved = function(fn) {
		return (typeof fn === 'function' && fn.sw_observe === true);
	};

	function isDefined(val) {
		return typeof val !== 'undefined';
	}

	/*=========================================================================
	* compute
	==========================================================================*/
	var _calledObservables = false;
	Swift.prototype.compute = function(cb, obsevedValues) {
		var registarLater = [];
		var computed = function() {
			var result;
			if (!obsevedValues) {
				obsevedValues = [];
				_calledObservables = [];
				result = cb.apply(this, arguments);
				$(_calledObservables).each(function() {
					obsevedValues.push(this);
				});

				$(registarLater).each(function() {
					computed.register(this);
				});

				registarLater = [];
			} else {
				result = cb.apply(this, arguments);
			}

			return result;
		};

		computed.register = function(obj, ns) {
			if (registarLater.indexOf(obj) === -1) {
				registarLater.push(obj);
			}

			$(obsevedValues).each(function() {
				this.register(obj, ns);
			});
		};

		computed.update = function(d) {
			$(obsevedValues).each(function() {
				this.update(d);
			});
		};

		computed.sw_observe = true;
		computed.sw_computed = true;
		return computed;
	};

	/*=========================================================================
	* observe
	==========================================================================*/
	Swift.prototype.observe = function(data) {
		var _data = data;
		var parentNode = [];
		var namespace;
		var nodes = [];
		var compute = [];

		var type = (typeof data === 'object') ?
			($.isArray(data)) ? 'array' : 'Object' :
			'string';

		var updateObserved = function() {
			$(compute).each(function() {
				var obj = this;
				if (obj.update) {
					obj.update();
				} else {
					obj.node.triggerHandler('sw.' + obj.type);
				}
			});
		};

		var observe = function(key, val) {
			if (_calledObservables &&
				_calledObservables.indexOf(observe) === -1) {
				_calledObservables.push(observe);
			}

			// set strings & numbers
			if (type === 'string' && isDefined(key)) {
				if (_data === key) {
					return;
				}
				_data = key;
				updateObserved();
				return;
			}

			if (type === 'Object' && isDefined(key)) {
				var old = JSON.stringify(_data);
				if (old === JSON.stringify(key)) {
					return;
				}
				_data = key;
				updateObserved();
				return;
			}

			if (isDefined(key)) {
				if (!isDefined(val)) {
					if (type === 'array' && typeof key !== 'number') {
						key = _data.indexOf(key);
					}
					var obj = _data[key];
					var old = JSON.stringify(obj);
					setTimeout(function() {
						if (old !== JSON.stringify(_data[key])) {
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

		observe.set = function(key, val) {
			_data[key] = val;
			$(parentNode).each(function() {
				var nodes = this.nodes;
				nodes[key].find_with_root('[data-sw-bind]').each(function() {
					var node = $(this);
					setTimeout(function() {
						node.triggerHandler('sw.update', val);
					}, 1);
				});
			});
			updateObserved();
		};

		observe.update = function(data) {
			if (data) {
				if (type === 'array') {
					observe.removeAll(true);
					$(data).each(function() {
						observe.push(this);
					});
				}
			} else {
				$(nodes).each(function() {
					this.triggerHandler(namespace);
				});
				updateObserved();
			}
		};

		observe.removeAll = function(noupdate) {
			$(_data).each(function() {
				observe.shift(noupdate);
			});
		};

		observe.sort = function(fn) {
			_data.sort(fn);
			$(parentNode).each(function() {
				var obj = this;
				var nodes = obj.nodes;
				$(nodes).each(function() {
					this.remove();
					nodes.shift();
				});

				$(_data).each(function() {
					var elements = obj.parent.triggerHandler(namespace, this);
					$(elements).each(function() {
						obj.nodes.push(this);
					});
				});
			});
			updateObserved();
		};

		observe.each = function(cb) {
			$(_data).each(function(i, data) {
				cb(i, data);
			});
		};

		observe.push = function(data) {
			_data.push(data);
			$(parentNode).each(function() {
				var obj = this;
				var elements = obj.parent.triggerHandler(namespace, data);
				$(elements).each(function() {
					obj.nodes.push(this);
				});
			});
			updateObserved();
		};

		observe.unshift = function(data) {
			_data.unshift(data);
			$(parentNode).each(function() {
				var obj = this;
				var elements = obj.parent.triggerHandler(namespace, data);
				$(elements).each(function() {
					obj.nodes.unshift(this);
					this.prependTo(obj.parent);
				});
			});
			updateObserved();
		};

		observe.remove = function(items) {
			if (!$.isArray(items)) {
				items = [items];
			}
			$(items).each(function() {
				var index = _data.indexOf(this);
				if (index !== -1) {
					observe.splice(index, 1);
				}
			});
		};

		observe.splice = function(start, end, noupdate) {
			_data.splice(start, end);
			$(parentNode).each(function() {
				var nodes = this.nodes;
				for (var index = start; index < start + end; index++) {
					var el = nodes[index];
					if (el) {
						el.remove();
					}
				}
				nodes.splice(start, end);
			});
			if (!noupdate) updateObserved();
		};

		observe.shift = function(noupdate) {
			observe.splice(0, 1, noupdate);
		};

		observe.pop = function() {
			var last = _data.length - 1;
			var ret = _data[last];
			observe.splice(last, 1);
			return ret;
		};

		observe.indexOf = function(data) {
			return _data.indexOf(data);
		};

		observe.registerParent = function(node, ns) {
			var parent_object = {
				parent: node,
				nodes: []
			};

			$(nodes).each(function() {
				parent_object.nodes.push(this);
			});

			nodes = [];
			// parentNode.push(parent_object);
			parentNode[0] = parent_object;
			namespace = 'sw.' + ns;
		};

		observe.registerArray = function(node, ns) {
			nodes.push(node);
			namespace = 'sw.' + ns;
		};

		observe.register = function(obj) {
			if (compute.indexOf(obj) === -1) {
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
		'submit': {
			init: function() {
				var self = this;
				self.node.on('submit', function(e) {
					e.preventDefault();
					self.valueAccess(self.data);
					return false;
				});
			}
		},

		'dblclick': {
			init: function() {
				var self = this;
				self.node.on('dblclick', function() {
					self.valueAccess(self.data);
					return false;
				});
			},
		},

		'click': {
			init: function() {
				var self = this;
				self.node.on('click', function() {
					self.valueAccess(self.data);
					return false;
				});
			}
		},

		'check': {
			init: function() {
				var self = this;
				self.node.on('change', function() {
					self.val = self.node.prop('checked');
					self.valueAccess(self.data);
					return false;
				});
			}
		},

		'enable': {
			update: function() {
				this.node.prop('disabled', this.valueAccess(this.data) ? '' : 'disabled');
			}
		},

		'disable': {
			update: function() {
				this.node.prop('disabled', this.valueAccess(this.data) ? 'disabled' : '');
			}
		},

		'caption': {
			init: function() {
				this.node.prepend('<option selected>' +
					(this.val ? this.val : this.name) +
					'</option>');
			}
		},

		'text': {
			update: function() {
				this.val = this.valueAccess();
				this.node.text(this.val);
			}
		},

		'html': {
			update: function() {
				this.val = this.valueAccess();
				this.node.html(this.val);
			}
		},

		'func': {
			init: function() {
				this.valueAccess(this.data);
			}
		},

		'compute': {
			update: function() {
				this.valueAccess(this.data);
			}
		},

		'class': {
			update: function() {
				var _class = '';
				this.val = this.valueAccess();
				if (typeof this.val === 'string') {
					if (this.val === '') {
						_class = this._class;
					} else {
						this._class = this.val;
						_class = this.val;
					}
				} else {
					_class = this.name;
				}
				this.node[this.val ? 'addClass' : 'removeClass'](_class);
			}
		},

		'toggleClass': {
			update: function() {
				this.val = this.valueAccess();
				if (this._oldClass) {
					this.node.removeClass(this._oldClass);
				}

				if (this.val) {
					this.node.addClass(this.val);
					this._oldClass = this.val;
				}
			}
		},

		'attr': {
			init: function() {
				var self = this;
				self.after(['attrVal'], function(obj) {
					obj._parent = self;
					self.attr = self.str;
					self.node.attr(self.attr, obj.valueAccess(self.data));
				});
			}
		},

		'attrVal': {
			update: function() {
				var self = this;
				if (self._parent) {
					var parent = self._parent;
					parent.node.attr(parent.attr, self.valueAccess());
				}
			}
		},

		'value': {
			init: function() {
				var self = this;
				if (self.observe) {
					self.node.on('change.sw', function() {
						self.valueAccess(self.node.val());
					});
				}
			},

			update: function() {
				this.node.val(this.valueAccess());
			}
		},

		'valueUpdate': {
			init: function() {
				var self = this;
				self.node.on('keydown', function() {
					setTimeout(function() {
						self.node.triggerHandler('change.sw');
					}, 1);
				});
			}
		},

		'checked': {
			init: function() {
				var self = this;
				if (self.observe) {
					self.node.on('change', function() {
						self.valueAccess(self.node.prop('checked'));
					});
				}
			},
			update: function() {
				this.node.prop('checked', this.valueAccess() ? true : false);
			}
		},

		'visible': {
			update: function() {
				if (this.valueAccess()) {
					this.node.show();
				} else {
					this.node.hide();
				}
			}
		},

		'invisible': {
			update: function() {
				if (this.valueAccess()) {
					this.node.hide();
				} else {
					this.node.show();
				}
			}
		},

		'options': {
			init: function() {
				var self = this;
				var node = self.node;
				var updateSelected;
				var optionsAttr;

				// wait other bindings to load
				self.after(['selectedOptions', 'optionsAttr'], function() {
					self.val = self.valueAccess();
					node.off('sw.options');
					node.attr('data-sw-bind', 'foreach: ' + self.name);

					if (self.bindings.selectedOptions) {
						updateSelected = self.bindings.selectedOptions.observe;
					}

					if (self.bindings.optionsAttr) {
						optionsAttr = self.bindings.optionsAttr.valueAccess();
					} else {
						optionsAttr = 'text : $data, value: $data';
					}

					// convert to foreach and trigger
					node.attr('data-sw-bind', 'foreach: ' + self.name);
					node.append('<option data-sw-bind="' + optionsAttr + '"></option>');
					self.applyForeach();

					if (updateSelected) {
						node.on('change.sw', function() {
							var data = self.observe ? self.observe.data : self.val;
							if (!$.isArray) {
								data = [data];
							}
							var newArr = [];
							var selectedNodes = $(this).find(':selected');
							$(selectedNodes).each(function() {
								var index = $(this).index();
								var val = data[index];
								newArr.push(val);
							});
							updateSelected.update(newArr);
						});

						self.select = function() {
							var data = self.observe ? self.observe.data : self.val;
							var items = updateSelected();
							if (!$.isArray(items)) {
								items = [items];
							}
							self.node.find(':selected').prop('selected', false);
							$(items).each(function() {
								var index = data.indexOf(this);
								self.node.find('option').eq(index).prop('selected', true);
							});
						};

						self.select();
						updateSelected.register(self);
						self.node.on('sw.options', self.select);
					}
				});
			}
		},

		optionsAttr: {
			compile: function() {
				return this.str;
			}
		}
	};


	Swift.prototype.getBinding = function(name) {
		return _actionMap[name];
	};


	Swift.prototype.registerBinding = function(name, action) {
		_actionMap[name] = action;
	};


	// _dataAttributeParser : internal function for parsing data-sw-bind attribute.
	// = passed arguments
	//   node   : jQuery element for the current node being parsed
	//   data   : data associated with this node
	//   parent : parent object if available
	var RootObject;

	function _dataAttributeParser(node, objClass, parent) {
		var str = node.attr('data-sw-bind'); // string to parse
		if (!str) return; // nothing to do

		var bindings = {};

		// replace anything inside {{ *.* }} with [[00]]
		// [[00]] is a special string nothng more, this because
		// we want to replace it later and tell swift that this string
		// should be compiled.
		var _toBeCompiled = str.match(/\{\{.*\}\}/g);
		str = str.replace(/\{\{.*\}\}/g, '[[00]]');

		// each model is seperated with a comma
		// ex: data-sw-bind = 'text: name, func: functionname'
		// split and parse each model seperately
		var models = str.split(',');
		$(models).each(function() {
			var model = this;
			var compile;
			var html;

			var actions = model.split(':');
			var type = $.trim(actions[0]);
			var name = $.trim(actions[1]);

			type = name ? type : 'func';
			name = name ? name : type;

			// parse root.name
			// possible values to root is
			// self, parent, root
			var root = 'self'; //root is self by default
			var prop = name.split('.');
			if (prop.length === 2) {
				name = prop[1];
				root = prop[0];
			}

			if (name === '[[00]]') {
				name = _toBeCompiled.shift();
				// remove leading {{ and ending }}
				name = $.trim(name.substring(2, name.length - 2));
				compile = name;
			}

			// in case of foreach, we will remove it's content html
			// to avoid parsing it individually, but first we need
			// to clone it to use later
			if (type === 'foreach') {
				html = node.clone().html();
				node.html('');
			}

			var self = {
				bindings: bindings,

				str: name,

				/* TODO: better way to detect previous loaded bindings */
				after: function(names, cb) {
					var self = this;
					var len = names.length;
					$(names).each(function() {
						var name = this;
						if (bindings[name]) {
							var timeout = setInterval(function() {
								if (bindings[name].initiated) {
									clearInterval(timeout);
									if (--len === 0) {
										cb.call(self, bindings[name]);
									}
								}
							}, 10);
						} else {
							--len;
						}
					});
					if (len === 0) {
						cb.call(self, bindings[name]);
					}
				},

				applyForeach: function(data) {
					sw.render(data || this.data, this.node);
				},

				render: function(data) {
					this.node.off('sw');
					sw.renderElement(this.node, data || this.data);
				},

				root: RootObject
			};

			bindings[type] = self;
			self.initiated = false;
			node.on('sw.' + type, function init(e, currentData) {
				var data = objClass || currentData;

				// zepto dosn't provide a name space
				var namespace = '';
				if (!e.hasOwnProperty('namespace')) {
					var ns = e.type.split('.');
					namespace = ns[1] || '';
				} else {
					namespace = e.namespace;
				}

				var val;
				if (currentData && namespace !== 'update') {
					val = currentData;
				} else {
					if (name === '$data') {
						val = data;
					} else if (root === 'self') {
						val = data[name];
					} else if (root === 'parent') {
						val = parent[name];
					} else if (root === 'root') {
						val = RootObject[name];
					} else {
						val = data[root][name];
					}
				}

				var observe = val;
				var _isObserved = isObserved(observe);

				// if passed value is observable object then
				// it's real value is stored in data property
				if (_isObserved) {
					self.observe = observe;
					val = val.data;
				}


				if (type === 'foreach') {
					var element;
					var oldRoot = RootObject;
					if (!$.isArray(val)) {
						val = [val];
					}
					var foreachElements = [];
					$(val).each(function() {
						RootObject = self.root;
						element = $(html);
						_renderView(this, element, data);
						node.append(element);
						if (_isObserved) {
							observe.registerArray(element, type);
						} else {
							foreachElements.push(element);
						}
					});

					// reset RootObject
					RootObject = oldRoot;
					if (_isObserved) {
						observe.registerParent(node, type);
					}

					return foreachElements;
				} else {
					var binding = _actionMap[type];
					if (typeof observe === 'function') {
						self.valueAccess = function(d) {
							self.val = observe.call(self, d);
							return self.val;
						};
					} else {
						self.valueAccess = function() {
							return val;
						};
					}

					self.data = data;
					self.node = node;
					self.name = name;
					self.type = type;

					// if binding exists like default binding
					// ex: text, checked, class ...
					// or any external registered bindings
					if (binding) {
						// if compile function registered with binding
						// don't compile and let it handle the string compilation
						if (compile && binding.compile) {
							self.valueAccess = function() {
								return binding.compile.call(self, data);
							};
						} else if (compile) {
							if (!self.compiled) {
								/*jslint evil: true */
								var fn = new Function('self', 'return ' + compile);
								self.compiled = sw.compute(function compile() {
									return fn.call(self, self.data);
								});

								self.compiled.register(self);
							}
							self.valueAccess = function() {
								self.val = self.compiled.apply(self, arguments);
								return self.val;
							};
						}

						// these should be called once
						if (!self.initiated) {
							if (binding.init) {
								binding.init.call(self, data);
							}

							if (_isObserved) {
								observe.register(self);
							}

							if (binding.update) {
								node.on('sw.update', init);
							}
						}

						// call on initiation and every time value get updated
						if (binding.update) {
							binding.update.call(self, data);
						}
					} else {
						// unknown binding name!!
					}

					self.initiated = true;
				}
			}); // node.on
		}); // each model
	}

	// this internal functions search passed html tree for
	// 'data-sw-bind' attr and send found elemnt
	// to _dataAttributeParser for parsing
	var _renderView = function(objClass, tree, parent) {
		var Nodes = [];
		var i = 0;
		while (1) {
			var node = tree.find_with_root('[data-sw-bind]').get(i++);
			if (!node) {
				break;
			}
			node = $(node);
			_dataAttributeParser(node, objClass, parent);
			Nodes.push(node);
		}

		// once all nodes with 'data-sw-bind' parsed we call triggerHandler
		$(Nodes).each(function() {
			this.triggerHandler('sw');
		});
	};


	Swift.prototype.renderElement = function(node, objClass, parent) {
		RootObject = objClass;
		_dataAttributeParser(node, objClass, parent);
		node.triggerHandler('sw');
	};

	Swift.prototype.render = function(objClass, node) {
		RootObject = objClass;
		node = node ? $(node) : $(document);
		_renderView(objClass, node);
	};

	Swift.prototype.fireRouter = function() {
		var self = this;
		var location = window.location.hash;
		self.location = location;
		var res = location.split('?');
		self.hash = res[0];
		self.query = res[1];
		self.path = self.hash.substr(1);

		if (/^!/.test(self.path)) {
			self.path = self.path.substr(1);
		}

		// reset params
		self.params = {};

		// parse params if there are any
		if (self.query && self.query !== '') {
			self.query.replace(queryParser, function() {
				var $1 = arguments[1];
				var $2 = arguments[2];
				if ($1) {
					self.params[$1] = $2;
				}
			});
		}

		// fire before routes actions
		// if one of the before_route function returns false
		// routing will stop and will not continue dispatching
		if (self._before_route.length) {
			var ret = true;
			$(self._before_route).each(function() {
				ret = this.apply(self, [self]);
				if (ret === false) {
					return;
				}
			});
			if (ret === false) {
				return;
			}
		}

		// fire router callback
		var fn = self.routes[self.hash] || self._not_found;
		if (fn && typeof fn === 'function') {
			fn.apply(self, [self]);
		} else if (fn && typeof fn === 'string' && require &&
			typeof require === 'function') {

			require(self.controllersPath + fn, function(ret) {
				if (typeof ret === 'function') {
					ret.apply(self, [self]);
				}
			});
		}
	};


	Swift.prototype.not_found = function(fn) {
		this._not_found = fn;
	};

	/*=========================================================================
	* functions to run before routing
	==========================================================================*/
	Swift.prototype.before_route = function(fn) {
		this._before_route.push(fn);
	};


	Swift.prototype.route = function(name, fn) {
		this.routes['#' + name] = fn;
	};


	Swift.prototype.before_view = function(name, cb) {
		if (arguments.length === 1) {
			cb = name;
			name = '*';
		}

		this._before_view.push({
			name: name,
			cb: cb
		});
	};


	Swift.prototype.view = function(elem, url, cb) {
		var self = this;
		var el = $(elem);
		el.hide();
		var _fireAfterLoad = function(el) {
			var html = cache.templates[url];

			// run before views actions
			if (self._before_view.length) {
				$(self._before_view).each(function() {
					var v = this;
					if (v.name === '*' || v.name === url ||
						$(v.name)[0] === el[0]) {

						html = v.cb.apply(self, [html]);
					}
				});
			}

			el.html(html);
			if (cb && typeof cb === 'function') {
				cb.apply(self, [el]);
			}
			el.show();
		};

		if (cache.templates[url]) {
			_fireAfterLoad(el);
		} else {
			var iframe_fallback = function() {
				self.useIfarme = true;
				debug('using iframe');
				var loaded = false;
				var doc = window.document;
				var node = doc.createElement('iframe');
				var head = doc.getElementsByTagName('head')[0];

				node.onload = node.onerror = node.onreadystatechange = function() {
					if ((node.readyState && node.readyState !== "complete" &&
							node.readyState !== "loaded") || loaded) {
						return false;
					}

					var data = $(node).contents().find('body').html();
					cache.templates[url] = data;
					_fireAfterLoad(el);
					node.onload = node.onreadystatechange = null;
					$(node).remove();
					loaded = true;
					return true;
				};

				node.async = false;

				node.src = self.templatesPath + url;
				head.insertBefore(node, head.lastChild);
			};

			if (self.useIfarme) {
				iframe_fallback();
			} else {
				$.ajax({
					url: self.templatesPath + url,
					success: function(data) {
						if (typeof data !== 'string') {
							iframe_fallback();
							return;
						}

						cache.templates[url] = data;
						_fireAfterLoad(el);
					},

					error: function() {
						iframe_fallback();
					},
					cache: false
				});
			}
		}
	};


	Swift.prototype.param = function(name) {
		return this.params[name];
	};


	Swift.prototype.redirect = function(where, params) {
		if (params) {
			var str = [];
			for (var key in params) {
				if (params.hasOwnProperty(key)) {
					str.push(key + '=' + params[key]);
				}
			}
			where += '?' + str.join('&');
		}
		window.location.hash = where;
	};


	Swift.prototype.stash = function(name, val) {
		if (val) {
			this._stash[name] = val;
		} else {
			val = this._stash[name];
			delete this._stash[name];
		}
		return val;
	};


	Swift.prototype.cache = function(name, val) {
		if (val) {
			cache.data[name] = val;
		} else {
			val = cache.data[name];
		}
		return val || {};
	};


	Swift.prototype.run = function() {
		this.fireRouter();
	};


	if (typeof require === 'function') {
		if (typeof define === 'function') {
			define(['jQuery'], function() {
				sw = this.exports = new Swift();
			});
		} else {
			module.exports = new Swift();
		}
	} else {
		sw = window.sw = window.Swift = new Swift();
	}
})();
