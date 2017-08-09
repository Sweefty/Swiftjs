QUnit.test( "sw function Defined", function( assert ) {
	assert.ok( sw, "Passed!" );
});

QUnit.test( "Simple Rendering", function( assert ) {
	sw.render({
		myText: 'name'
	}, '.group-1');

	assert.strictEqual( $('.view1 div').text(), "name" );
	assert.strictEqual( $('.view2 div').text(), "name" );

	//render seperately
	sw.render({
		myText: 'name2'
	}, '.view1');

	sw.render({
		myText: 'name3'
	}, '.view2');

	assert.strictEqual( $('.view1 div').text(), "name2" );
	assert.strictEqual( $('.view2 div').text(), "name3" );
});

QUnit.test( "Simple Observe", function( assert ) {

	var name = sw.observe('');

	sw.render({
		myText: name
	}, '.group-1');

	name('name');

	assert.strictEqual( $('.view1 div').text(), "name" );
	assert.strictEqual( $('.view2 div').text(), "name" );

	//render only an elemnt inside view
	sw.renderElement($('.view3 .second'), {
		test: 'name2'
	});

	assert.strictEqual( $('.view3 .first').text(), "" );
	assert.strictEqual( $('.view3 .second').text(), "name2" );
});


QUnit.asyncTest( "Array Observe", function( assert ) {

	expect( 13 );

	var list = sw.observe([]);

	assert.ok(typeof list === 'function');

	var singleItem = function(id){
		var self = this;
		this.text = 'item ' + id;
		this.click = function(item){
			assert.strictEqual( item, self, "click trigger " + id );
		};
	};

	for (var i =0; i < 5; i++){
		list.push(new singleItem(i));
	}

	sw.render(list, '.view4');

	for (var i =0; i < 5; i++){
		$('.view4 li').eq(i).find('a').trigger('click');
	}

	setTimeout(function(){
		list.push(new singleItem(5));
		$('.view4 li').eq(5).find('a').trigger('click');

		for (var i =0; i < 6; i++){
			var text = $('.view4 li').eq(i).find('span').text();
			assert.strictEqual( text, 'item ' + i);
		}

		QUnit.start();
	}, 100);
});


QUnit.test( "Array Observe With Root Object", function( assert ) {

	var list = sw.observe([]);

	assert.ok(typeof list === 'function');
	var count = 0;
	var parentObject = function(){
		this.click = function(item){
			assert.ok(1, 'parentObject click ' + count);
			assert.strictEqual( item, list(count++));
		};
		this.data = list;
	};

	var singleItem = function(id){
		var self = this;
		this.text = 'item ' + id;
		this.click = function(item){
			assert.ok(0, 'shoudnt be called');
		};
	};

	for (var i =0; i < 5; i++){
		list.push(new singleItem(i));
	}

	sw.render(new parentObject(), '.view5');

	for (var i =0; i < 5; i++){
		$('.view5 li').eq(i).find('a').trigger('click');
	}
});


QUnit.test( "Self Render", function( assert ) {
	var obj = function(){
		this.test = 'Hello';
		this.render = function(){
			this.render({
				test : 'hi'
			});
		};
	};

	sw.render(new obj(), '.view6');
	assert.strictEqual($('.view6').find('div').text(), 'hi');
});

QUnit.asyncTest( "Register Binding", function( assert ) {

	var obj = function(){
		this.test = sw.observe('hi');
	};

	var cl = new obj();

	sw.registerBinding('testBinding2', {
		init : function(){
			console.log(this.valueAccess());
		},
		compile : function(){
			return this.str;
		}
	});

	sw.registerBinding('testBinding', {
		init : function(obj){
			var self = this;
			this.after(['testBinding2'], function(binding){
				assert.strictEqual(binding, this.bindings.testBinding2);

				var binding2Val = binding.valueAccess();
				assert.strictEqual(binding2Val, 'hello there');

				var val = this.valueAccess();
				assert.strictEqual(obj, cl);
				assert.strictEqual(val, 'hi');
				this.node.text(val);
				QUnit.start();
			});
		},

		update : function(obj){
			assert.strictEqual(obj, cl, "update");
		}
	});

	sw.render(cl, '.view7');
});

QUnit.test( "Compiled Strings", function( assert ) {

	var obj = function(){
		this.name = function(data){
			return data.name2 + ' MM';
		};
		this.list = sw.observe([{
			name  : 'Hi',
			name2 : 'bye'
		}]);
	};

	sw.render(new obj(), '.view8');
	var text1 = $('.view8 li').eq(0).text();
	var text2 = $('.view8 li').eq(1).text();
	var text3 = $('.view8 li').eq(2).text();

	assert.strictEqual(text1, 'Hi');
	assert.strictEqual(text2, 'bye');
	assert.strictEqual(text3, 'bye MM');
});
