(function( window ) {
    'use strict';

    var ESCAPE_KEY = 27;
    var ENTER_KEY = 13;

    var data = {
        completed : 8,
        items : [
            { name : "first item", completed : true, show : true },
            { name : "Create a TodoMVC template", completed : false },
            { name : "first item", completed : true },
            { name : "first item", completed : true },
            { name : "Create a TodoMVC template", completed : false },
            { name : "first item", completed : true },
            { name : "first item", completed : true },
            { name : "first item", completed : true, show : true },
        ]
    };

    var completed = 0;

    for (var i= 0; i < 1; i++){
        data.items.push({ name : "Create a TodoMVC template", completed : false });
    }

    for (var i= 0; i < data.items.length; i++){
        if (data.items[i].completed){
            completed++;
        }
    }

    var listView = function (){
        var self       = this;
        self.items     = sw.observe(data.items);
        self.completed = sw.observe(completed);
        self.focus = sw.observe(false);
        self.whatToShow = sw.observe('all');

        this.showHide = sw.compute(function(){
            var val = self.whatToShow();
            if (val === 'completed'){
                return this.data.completed;
            } else if (val === 'active'){
                return !this.data.completed;
            }

            return true;
        });

        this.itemsLeft = sw.compute(function itemsLeft (){
            return self.items().length - self.completed();
        });

        this.checked  = sw.compute(function(){
            return self.itemsLeft() === 0;
        });

        this.toggleAll = function(){
            for (var i = 0; i < data.items.length; i++){
                self.items(i).completed = this.val;
            }

            if (this.val === true){
                self.completed(self.items().length);
            } else {
                self.completed(0);
            }
        };

        this.complete = function(item){

            self.items(item).completed = this.val;
            var comp = self.completed();
            if (this.val === true){
                self.completed(++comp);
            } else {
                self.completed(--comp);
            }
        };

        this.viewClearCompleted = sw.compute(function viewClearCompleted (){
            if (self.completed() === 0) return "hide";
            if (self.completed() > 0) return "";
        });

        this.clearCompleted = function(){
            self.items.each(function(i, data){
                if (data.completed){
                    self.items.remove(data);
                }
            });
            self.completed(0);
        };

        this.add = function(){
            var ele = this.node;
            ele.on('keydown', function(e){
                var text = $.trim(ele.val());
                if(e.which === ENTER_KEY && text !== "") {
                    self.items.unshift({ name : text, completed : false });
                    ele.val("");
                    self.itemsLeft.update();
                }
            });
        };

        this.toggle = function(item){
            self.items(item).editing = true;
        };

        this.edit = function(item){
            var element = this.node;
            element.on('keydown', function(e){
                if ( e.which === ESCAPE_KEY ) {
                    delete self.items(item).editing;
                } else if (e.which === ENTER_KEY){
                    self.items(item).name = element.val();
                    delete self.items(item).editing;
                }
            });

            element.on('focusout', function(){
                delete self.items(item).editing;
            });
        }

        this.delete = function(item){
            self.items.remove(item);
            var comp = self.completed();
            if (this.data.completed){
                self.completed(--comp);
            } else {
                self.completed(comp);
            }
        };
    };

    var list = new listView();
    sw.render(list);

    sw.route('/completed', function(){
        list.whatToShow('completed');
    });

    sw.route('/active', function(){
        list.whatToShow('active');
    });

    sw.route('/', function(){
        list.whatToShow('all');
    });

    sw.run();
})( window );
