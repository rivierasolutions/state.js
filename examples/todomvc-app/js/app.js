/// <reference path="../index.html.d.ts" />

(function (window) {
	'use strict';

	window.document.addEventListener('StateLoaded', () => {

		let itemIdSequence = 0;
		let present = 'all';
		const viewState = document.state;
		const todos = _deserialize(localStorage.getItem('todos')) ?? [];

		document.state.listener({
			'onNewTodoInput': onNewTodoInput,
			'onToggleAll': onToggleAll,
			'onClearCompleted': onClearCompleted,
			'onItemToggle': onItemToggle,
			'onItemRemove': onItemRemove,
			'onItemEdit': onItemEdit,
			'onItemEditInput': onItemEditInput,
			'onItemBlur': onItemBlur
		});

		_updateViewState({
			onNewTodoInput: { 'keydown': 'onNewTodoInput' },
			onToggleAll: { 'click': 'onToggleAll' },
			onClearCompleted: { 'click': 'onClearCompleted' },
			lastToggleAll: false
		});

		const router = Router({
			'/active': () => { present = 'active'; _updateViewState(); },
			'/completed': () => { present = 'completed';  _updateViewState(); },
			'/': () => { present = 'all';  _updateViewState(); },
		});
		router.init();

		function onNewTodoInput(ev) {
			if (ev.code === 'Enter' && viewState.current().newTodoName) {
				todos.push(_newItem(viewState.current().newTodoName));
				_updateViewState({ newTodoName: '' });
			}
		}

		function onToggleAll(ev) {
			todos.forEach(item => {
				item.isCompleted = !viewState.current().lastToggleAll;
			});
			_updateViewState({ lastToggleAll: !viewState.current().lastToggleAll });
		}

		function onClearCompleted(ev) {
			todos
				.filter(item => item.isCompleted)
				.forEach(item => todos.splice(todos.indexOf(item), 1));
			_updateViewState();
		}

		function onItemToggle(ev, context) {
			const item = todos.find(i => i.id === context.id);
			item.isCompleted = !item.isCompleted;
			item.cssClass = item.isCompleted ? 'completed' : '';
			_updateViewState();
		}

		function onItemRemove(ev, context) {
			todos.splice(todos.findIndex(i => i.id === context.id), 1);
			_updateViewState();
		}

		function onItemEdit(ev, context) {
			todos[todos.findIndex(i => i.id === context.id)].isEdited = true; 
			_updateViewState();
		}

		function onItemEditInput(ev, context) {
			const index = todos.findIndex(i => i.id === context.id);
			if (ev.code === 'Enter' && todos[index].isEdited) {
				_itemEditDone(index);
			}
		}

		function onItemBlur(ev, context) {
			const index = todos.findIndex(i => i.id === context.id);
			if (todos[index].isEdited) {
				_itemEditDone(index);
			}
		}

		function _newItem(content, isCompleted = false) {
			const id = ++itemIdSequence;
			return {
				id,
				content,
				isCompleted,
				isEdited: false,
				onToggle: { 'click': 'onItemToggle', context: { id } },
				onRemove: { 'click': 'onItemRemove', context: { id } },
				onEdit: { 'dblclick': 'onItemEdit', context: { id } },
				onEditInput: { 'keydown': 'onItemEditInput', 'blur': 'onItemBlur', context: { id } }
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
			_updateViewState();
		}

		function _updateViewState(otherUpdates = undefined) {
			localStorage.setItem('todos', _serialize(todos));
			viewState.update({
				...otherUpdates,
				todos: present === 'active' ? todos.filter(t => !t.isCompleted) : (present === 'completed' ? todos.filter(t => t.isCompleted) : todos),
				activeCount: todos.filter(t => !t.isCompleted).length,
				exactly1Active: todos.filter(t => !t.isCompleted).length === 1,
				completedCount: todos.filter(t => t.isCompleted).length,
				allCount: todos.length,
				present: {
					all: present !== 'active' && present !== 'completed',
					active: present === 'active',
					completed: present === 'completed'
				}
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
