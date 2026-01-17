(function (window) {
	'use strict';

	window.document.addEventListener('StateLoaded', () => {

		const viewState = document.state;
		const todos = _deserialize(localStorage.getItem('todos')) ?? [];

		_updateTodos({ 
			onNewTodoInput: { 'keydown': onNewTodoInput },
			onToggleAll: { 'click': onToggleAll },
			lastToggleAll: false
		});

		function onNewTodoInput(ev) {
			if (ev.code === 'Enter' && viewState.current().newTodoName) {
				todos.push(_newItem(viewState.current().newTodoName));
				_updateTodos({ newTodoName: '' });
			}
		}

		function onToggleAll(ev) {
			todos.forEach(item => {
				item.isCompleted = !viewState.current().lastToggleAll;
			});
			_updateTodos({ lastToggleAll: !viewState.current().lastToggleAll });
		}

		function onItemToggle(ev) {
			const item = todos[viewState.scopeOf(ev.target).$index];
			item.isCompleted = !item.isCompleted;
			item.cssClass = item.isCompleted ? 'completed' : '';
			_updateTodos();
		}

		function onItemRemove(ev) {
			const index = viewState.scopeOf(ev.target).$index;
			todos.splice(index, 1);
			_updateTodos();
		}

		function onItemEdit(ev) {
			todos[viewState.scopeOf(ev.target).$index].isEdited = true; 
			_updateTodos();
		}

		function onItemEditInput(ev) {
			const index = viewState.scopeOf(ev.target).$index;
			if (ev.code === 'Enter' && todos[index].isEdited) {
				_itemEditDone(index);
			}
		}

		function onItemBlur(ev) {
			const index = viewState.scopeOf(ev.target).$index;
			if (todos[index].isEdited) {
				_itemEditDone(index);
			}
		}

		function _newItem(content, isCompleted = false) {
			return { 
				content,
				isCompleted,
				isEdited: false,
				onToggle: { 'click': onItemToggle },
				onRemove: { 'click': onItemRemove },
				onEdit: { 'dblclick': onItemEdit },
				onEditInput: { 'keydown': onItemEditInput, 'blur': onItemBlur }
			};
		}

		function _itemEditDone(index) {
			const newContent = viewState.current().todos[index].content;
			if (!newContent) {
				todos.splice(index, 1);
			} else {
				todos[index].content = newContent;
				todos[index].isEdited = false;
			}
			_updateTodos();
		}

		function _updateTodos(otherUpdates = undefined) {
			localStorage.setItem('todos', _serialize(todos));
			viewState.update({
				...otherUpdates,
				todos,
				exacly1NotCompletedItem: todos.filter(t => !t.isCompleted).length === 1,
				notCompletedCount: todos.filter(t => !t.isCompleted).length
			});
		}

		function _deserialize(todosStr) {
			return todosStr ? JSON.parse(todosStr).map(item => _newItem(item.content, item.isCompleted)) : [];
		}

		function _serialize(todos) {
			return JSON.stringify(todos);
		}
	});

})(window);
