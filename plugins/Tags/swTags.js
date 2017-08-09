(function(){
	"use strict";

	//inject style
	var style = [
		'<style id="tagitStyle">',
			'._input_tagit { border: none; border-color: transparent; padding:5px;margin-top:4px;}',
			'._ul_tagit {list-style:none;padding:0;margin:0;}',
			'._li_tagit {float:left; display:block;padding:5px;;margin-right:2px;}',
			'._text_tagit {display:block;float:left;background:#ccc;padding:5px;}',
			'._icon_tagit {display:block;float:left;background:#ddd;padding:5px;color:#fff;cursor:pointer;}',
			'',
		'</style>'
	];

	$(document).find('head').prepend(style.join(''));

	sw.registerBinding('tags', {
		init : function(){
			var self = this;
			var obj;
			if (typeof self === 'object' && sw.isObserved(self.observe)){
				obj = {
					onTag : function(){},
					filter : function(){ return true; },
					items : self.observe
				};
			} else {
				obj = self.valueAccess();
			}

			var tagsObject = {
				items : obj.items,
				itemToAdd : sw.observe(""),
				deleteTag : function(item){
					this.node.parent().fadeOut(250, function(){
						tagsObject.items.remove(item);
					});
				}
			};

			self.textNode = $("<input type='text' style='border:none;' data-sw-bind='value: itemToAdd, valueUpdate: keydown' class='_input_tagit' />");
			self.textNode.keypress(function(e) {
				if(e.which === 13) {
					var tag = tagsObject.itemToAdd();
					//remove leading white space
					tag = tag.replace(/^\s+|\s+$/g,'');
					tagsObject.itemToAdd(""); // Clear text box
					if ( (tag !== "") && (tagsObject.items.indexOf(tag) < 0)){
						// Prevent blanks and duplicates
						if (obj.filter && typeof obj.filter === 'function'){
							var ret = obj.filter(tag);
							if (!ret){ return; }
						}
						tagsObject.items.push(tag);
						if (obj.onTag && typeof obj.onTag === 'function'){
							obj.onTag(tag);
						}
					}
				} else if (e.which === 8 && tagsObject.itemToAdd() === "") {
					var text = tagsObject.items.pop();
					tagsObject.itemToAdd(text);
				}
			});

			//focus inside input on click
			self.node.on("click", function(){
				self.textNode.focus();
			});

			self.tagsNode = $("<ul class='_ul_tagit' data-sw-bind='foreach: items'>" +
							   "<li class='_li_tagit'>" +
							   "<span class='_text_tagit' data-sw-bind='text: $data'></span>" +
							   "<span class='_icon_tagit' data-sw-bind='click: root.deleteTag'>X</span>" +
							   "</li>" +
							   "</ul>");

			self.node.append(self.tagsNode);
			self.node.append(self.textNode);

			sw.renderElement(this.tagsNode, tagsObject);
			sw.renderElement(this.textNode, tagsObject);
		}
	});
})();
