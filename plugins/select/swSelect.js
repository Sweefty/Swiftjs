/*

USAGE
==================
<html>
<select data-sw-bind="select: select"></select>
</html>

function Model (){
	this.select = {
		render : '<option data-sw-bind="text: name"></option>',
		items : sw.observe([]), //items to render
		selectedItems : sw.observe([]), // list of selected items
		onSelect : function(){} //callback function on select event "on change"
	};
}

sw.render(new Model());

*/


(function(){
	"use strict";

	sw.registerBinding('select', {
		init : function(){
			var self = this;
			var node = self.node;
			node.off('sw.select');

			var obj;
			if (typeof self === 'object' && sw.isObserved(self.observe)){
				obj = {
					render : '<option data-sw-bind="text: $data"></option>',
					items  : self.observe
				};
			} else {
				obj = self.valueAccess();
			}


			node.attr('data-sw-bind', 'foreach: items');
			node.append(obj.render);
			sw.renderElement(node, obj);

			var selected = obj.selectedItems;

			self.select = function(){
				var data = obj.items.data;
				var items = selected();
				if (!$.isArray(items)){ items = [items]; }
				self.node.find(':selected').prop('selected', false);
				$(items).each(function(){
					var index = data.indexOf(this);
					self.node.children().eq(index).prop('selected', true);
				});
			};

			self.select();
			selected.register(self);
			self.node.on('sw.select', self.select);

			node.on('change.sw', function(){
				var data = obj.items.data;
				var newArr = [];
				var selectedNodes = $(this).find(':selected');
				$(selectedNodes).each(function(){
					var index = $(this).index();
					var val = data[index];
					newArr.push(val);
				});

				selected.update(newArr);
				if (obj.onSelect && typeof obj.onSelect === 'function'){
					obj.onSelect(newArr);
				}
			});
		}
	});
})();
