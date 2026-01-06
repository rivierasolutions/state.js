(function polyfill() {

    function buildJSONPath(root, path, leaf) {
        let split = path.split('.');
        if (split[0] === '$' || split[0] === '@') {
            split = split.slice(1);
        }
        let leafp = split[split.length-1];
        let parent = split.slice(0, split.length-1).reduce((obj, p) => { 
            if (!obj.hasOwnProperty(p)) {
                obj[p] = {};
            }
            return obj[p];
        }, root);
        if (!parent.hasOwnProperty(leafp)) {
            parent[leafp] = leaf ?? {};
        }
        return parent[leafp];
    }

    function getJSONPath(root, path) {
        let split = path.split('.');
        if (split[0] === '$' || split[0] === '@') {
            split = split.slice(1);
        }
        const res = split.reduce((obj, p) => {
            const match = /^(.*)\[([0-9]+)\]$/.exec(p);
            return match ? obj[match[1]][parseInt(match[2])] : obj[p];
        }, root);
        return res;
    }

    function setJSONPath(root, path, value) {
        let split = path.split('.');
        if (split[0] === '$' || split[0] === '@') {
            split = split.slice(1);
        }
        const parent = split.slice(0, split.length-1).reduce((obj, p) => {
            const match = /^(.*)\[([0-9]+)\]$/.exec(p);
            return match ? obj[match[1]][parseInt(match[2])] : obj[p];
        }, root);
        parent[split[split.length-1]] = value;
    }

    function placeholderFactory(attrs) {
        const placeholder = document.createElement('template');
        placeholder.setAttribute('state-placeholder', '');
        Object.keys(attrs).forEach(k => placeholder.setAttribute(k, attrs[k]));
        return placeholder;
    }

    function domVisitor(rootElement, rootScope, visit) {

        const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_ELEMENT,
            {
            acceptNode: (node) => node.hasAttribute('state-ignore') 
                    ? NodeFilter.FILTER_REJECT 
                    : ((node.hasAttribute('state-scope') 
                    || node.hasAttribute('state-if')
                    || node.hasAttribute('state-if-not')
                    || node.hasAttribute('state-foreach')
                    || node.hasAttribute('state-content')
                    || node.hasAttribute('state-listen')
                    || Array.from(node.attributes).find(a => a.name.startsWith('state-attr-'))
                )
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_SKIP)
            }
        );

        const stack = [ { scope: rootScope, scopeRootElement: rootElement, absJsonPath: '$', isStateForeachItemScope: false } ];

        while (walker.nextNode()) {
            const element = walker.currentNode;
            while (true) {
                const scopeTuple = stack[stack.length-1];
                
                if (scopeTuple.scopeRootElement !== element && scopeTuple.scopeRootElement.contains(element)) {
                    const newScopeAndElem = visit({ ...scopeTuple, walker, element });
                    if (newScopeAndElem && newScopeAndElem.scope && newScopeAndElem.scopeRootElement && newScopeAndElem.absJsonPath) {
                        stack.push(newScopeAndElem);
                    }
                    break;
                } else {
                    stack.pop();
                }
            }
        }
    }

    function registerBinding(state, absPath, type, element) {
        if (!state._bindings.has(absPath)) {
            state._bindings.set(absPath, new Map());
        }
        state._bindings.get(absPath).set(element, type);
    }

    function unregisterBinding(state, absPath, element) {
        state._bindings.has(absPath) && state._bindings.get(absPath).delete(element);
    }

    function registerStateForeachBinding(state, relPath, type, element, statForeachRootScope) {
        const id = statForeachRootScope.parentElement.getAttribute('id');
        if (!state._stateForeachItemBindings.has(id)) {
            state._stateForeachItemBindings.set(id, new Map());
        }
        itemBindings = state._stateForeachItemBindings.get(id);
        if (!itemBindings.has(relPath)) {
            itemBindings.set(relPath, new Map());
        }
        const path = [];
        while (element && element !== statForeachRootScope) {
            if (!element.parentElement) {
                break;
            }
            const index = ((el) => { let index=0; while((el = el.previousElementSibling)) { ++index; } return index; })(element);
            path.unshift(index);
            element = element.parentElement;
        }
        itemBindings.get(relPath).set(path, type);
    }

    function bindToValueAttr(element, absPath, state) {
        if (element.tagName === 'SELECT') {
            element.addEventListener('change', (event) => {
                setJSONPath(state._current, absPath, event.target.value);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.value }]);
            });
        }
        else if (element.getAttribute('contenteditable') === 'true') {
            element.addEventListener('input', (event) => {
                setJSONPath(state._current, absPath, event.target.textContent);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.textContent }]);
            });
        }
        else if (element.tagName === 'INPUT' && (element.getAttribute('type') === 'checkbox' || element.getAttribute('type') === 'radio')) {
            element.addEventListener('change', (event) => {
                setJSONPath(state._current, absPath, event.target.checked);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.checked }]);
            });
        }
        else if (element.tagName === 'INPUT' && element.getAttribute('type') === 'file') {
            element.addEventListener('change', (event) => {
                setJSONPath(state._current, absPath, event.target.files);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.files }]);
            });
        }
        else if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' )) {
            element.addEventListener('input', (event) => {
                setJSONPath(state._current, absPath, event.target.value);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.value }]);
            });
        }
    }

    function bindToOpenAttr(element, absPath, state) {
        if (element.tagName === 'DETAILS') {
            element.addEventListener('toggle', (event) => {
                setJSONPath(state._current, absPath, event.target.open);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.open }]);
            });
        }
    }

    function visitAndBuild(visitContext, state) {
        const node = visitContext.element;
        let scope = visitContext.scope;
        let scopeRootElement = visitContext.scopeRootElement;
        let absPath = visitContext.absJsonPath;
        let isStateForeachItemScope = visitContext.isStateForeachItemScope;
        let result = undefined;

        if (node.hasAttribute('state-scope')) {
            const jsonPath = node.getAttribute('state-scope');
            let isStateForeachItemScope = node.parentElement?.tagName === 'TEMPLATE'
                && node.parentElement?.hasAttribute('state-placeholder')
                && node.parentElement?.hasAttribute('state-foreach');
            result = { 
                scope: isStateForeachItemScope ? {} : buildJSONPath(scope, jsonPath, {}),
                scopeRootElement: node,
                absJsonPath: jsonPath.replace('@', absPath),
                isStateForeachItemScope
            };
            scope = result.scope;
            scopeRootElement = result.scopeRootElement;
            absPath = result.absPath;
            isStateForeachItemScope = result.isStateForeachItemScope;
        }
        if (node.hasAttribute('state-foreach')) {
            const jsonPath = node.getAttribute('state-foreach');
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, []);
            }

            let placeholder = node;
            if (!node.hasAttribute('state-placeholder')) {
                placeholder = placeholderFactory({ 'state-foreach': jsonPath, 'id': `state-auto-id-${++(state._idSequence.next)}` });
                node.removeAttribute('state-foreach');
                node.setAttribute('state-scope', jsonPath);
                node.replaceWith(placeholder);
                placeholder.appendChild(node);
                visitContext.walker.currentNode = placeholder;
            }

            if (isStateForeachItemScope) {
                registerStateForeachBinding(state, jsonPath, 'state-foreach', placeholder, scopeRootElement)
            } else {
                registerBinding(state, jsonPath.replace('@', absPath), 'state-foreach', placeholder);
            }
            return result;
        }
        if (node.hasAttribute('state-if')) {
            const jsonPath = node.getAttribute('state-if');
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, false);
                registerBinding(state, jsonPath.replace('@', absPath), 'state-if', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-if', node, scopeRootElement)
            }
        }
        if (node.hasAttribute('state-if-not')) {
            const jsonPath = node.getAttribute('state-if-not');
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, false);
                registerBinding(state, jsonPath.replace('@', absPath), 'state-if-not', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-if-not', node, scopeRootElement)
            }
        }
        if (node.hasAttribute('state-content')) {
            const jsonPath = node.getAttribute('state-content');
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, node.textContent ?? '');
                registerBinding(state, jsonPath.replace('@', absPath), 'state-content', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-content', node, scopeRootElement)
            }
        }
        Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
            const jsonPath = attr.value;
            const attrName = attr.name.replace('state-attr-', '');
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, node.getAttribute(attrName) ?? '');
                registerBinding(state, jsonPath.replace('@', absPath), attr.name, node);
            } else {
                registerStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement)
            }
            if (attrName === 'value') {
                bindToValueAttr(node, jsonPath.replace('@', absPath), state);
            }
            if (attrName === 'open') {
                bindToOpenAttr(node, jsonPath.replace('@', absPath), state);
            }
        });
        if (node.hasAttribute('state-listen')) {
            const jsonPath = node.getAttribute('state-listen');
            if (!node.hasAttribute("id")) {
                node.setAttribute("id", `state-auto-id-${++(state._idSequence.next)}`)
            }
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, node.getAttribute("id"));
                registerBinding(state, jsonPath.replace('@', absPath), 'state-listen', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-listen', node, scopeRootElement)
            }
        }
        return result;
    }

    function applyState(state, elementMap, absPath, elementOrPath, stateForeachItemRoot = null) {
        const stateType = elementMap.get(elementOrPath);
        const stateValue = getJSONPath(state._current, absPath);
        const element = (stateForeachItemRoot && Array.isArray(elementOrPath)) ? elementOrPath.reduce((el,child) => el.children[child], stateForeachItemRoot) : elementOrPath;
        if (stateForeachItemRoot) {
            registerBinding(state, absPath, stateType, element);
        }

        if (stateType === 'state-content') {    
            element.textContent = stateValue;
        }
        else if (stateType.startsWith('state-attr-')) {
            const attrName = stateType.replace('state-attr-', '');
            if (attrName === 'value') {
                element.value = stateValue;
                if (stateForeachItemRoot) {
                    bindToValueAttr(element, absPath, state);
                }
            } else if (attrName === 'open') {
                element.open = !!stateValue;
                if (stateForeachItemRoot) {
                    bindToOpenAttr(element, absPath, state);
                }
            } else {
                element.setAttribute(stateType.replace('state-attr-', ''), stateValue);
            }
        }
        else if (stateType === 'state-if') {
            if (!stateValue && !element.hasAttribute('state-placeholder')) {

                const placeholder = placeholderFactory({ 'state-if': element.getAttribute('state-if') });
                element.replaceWith(placeholder);
                placeholder.appendChild(element);
                elementMap.delete(element);
                elementMap.set(placeholder, 'state-if');

            } else if (stateValue && element.tagName === 'TEMPLATE' && element.hasAttribute('state-placeholder')) {

                const content = element.firstElementChild;
                element.replaceWith(content);
                elementMap.delete(element);
                elementMap.set(content, 'state-if');
            }
        }
        else if (stateType === 'state-if-not') {
            if (stateValue && !element.hasAttribute('state-placeholder')) {

                const placeholder = placeholderFactory({ 'state-if-not': element.getAttribute('state-if-not') });
                element.replaceWith(placeholder);
                placeholder.appendChild(element);
                elementMap.delete(element);
                elementMap.set(placeholder, 'state-if-not');

            } else if (!stateValue && element.tagName === 'TEMPLATE' && element.hasAttribute('state-placeholder')) {

                const content = element.firstElementChild;
                element.replaceWith(content);
                elementMap.delete(element);
                elementMap.set(content, 'state-if-not');
            }
        }
        else if (stateType === 'state-foreach') {
            const stateTemplate = state._stateForeachItemBindings.get(element.getAttribute("id"));
            element.parentNode.querySelectorAll(`[state-foreach-id="${element.getAttribute("id")}"]`).forEach((el, index) => {
                Array.from(stateTemplate.keys()).map(path => path.replace('@', `${absPath}[${index}]`)).forEach(path => unregisterBinding(state, path, el));
                el.remove();
            });
            if (stateValue) {
                (Array.isArray(stateValue) ? stateValue : [ stateValue ]).map((item, index) => {
                    item.$index = index;
                    const domItem = element.firstElementChild.cloneNode(true);
                    domItem.setAttribute("state-foreach-id", element.getAttribute("id"));
                    domItem.setAttribute('state-scope', `${element.getAttribute('state-foreach')}[${index}]`);

                    Array.from(stateTemplate.keys()).forEach(itemPath => {
                        const tempaltePathMap = stateTemplate.get(itemPath);
                        Array.from(tempaltePathMap.keys()).forEach(templatePath => {
                            applyState(state, tempaltePathMap, itemPath.replace('@', `${absPath}[${index}]`), templatePath, domItem);
                        });
                    });

                    return domItem;
                }).reverse().forEach(i => element.after(i));
            }
        }
    }

    function mergeAndBuildChangeIndex(oldState, newState) {
        const changeIndex = [];
        if (newState && newState instanceof Object) {
            const toMerge = [ { path: "$", src: oldState, dst: newState } ];
            while (toMerge.length) {
                const tuple = toMerge.pop();
                if (tuple.src !== tuple.dst) {
                    changeIndex.push(tuple);
                }
                Object.keys(tuple.dst).forEach(key => {
                    if (!tuple.src.hasOwnProperty(key)) {
                        return;
                    }
                    const path = `${tuple.path}.${key}`;
                    if (Array.isArray(tuple.src[key])) {
                        let anyItemChanges = false;
                        if (!Array.isArray(tuple.dst[key])) {
                            anyItemChanges = true;
                            if (tuple.src[key].length && tuple.dst[key] instanceof Object) {
                                toMerge.push({ path: `${path}[0]`, src: tuple.src[key][0], dst: tuple.dst[key] });
                            }
                        } else if (tuple.src[key].length !== tuple.dst[key].length) {
                            anyItemChanges = true;
                            for (let i=0; i<Math.max(tuple.src[key].length, tuple.dst[key].length); ++i) {
                                if (tuple.src[key].at(i) && tuple.dst[key].at(i) instanceof Object) {
                                    toMerge.push({ path: `${path}[${i}]`, src: tuple.src[key].at(i), dst: tuple.dst[key].at(i) });
                                }
                            }
                        } else {
                            tuple.dst[key].forEach((item, i) => {
                                anyItemChanges = (tuple.src[key][i] !== item);
                                if (item instanceof Object) {
                                    toMerge.push({ path: `${path}[${i}]`, src: tuple.src[key][i], dst: item });
                                }
                            });
                        }
                        if (anyItemChanges) {
                            changeIndex.push({ path, src: tuple.src[key], dst: tuple.dst[key] });
                            tuple.src[key] = Array.isArray(tuple.dst[key]) ? tuple.dst[key].slice() : [ tuple.dst[key] ];
                        }
                    } else {
                        if (tuple.src[key] !== tuple.dst[key]) {
                            changeIndex.push({ path, src: tuple.src[key], dst: tuple.dst[key] });
                            tuple.src[key] = tuple.dst[key];
                        }
                    }
                    if (tuple.dst[key] instanceof Object && !Array.isArray(tuple.dst[key])) {
                        toMerge.push({ path, src: tuple.src[key], dst: tuple.dst[key] });
                    }
                });
            }
        }
        return changeIndex;
    }
    
    function load(rootElement, initialState) {
        rootElement.state = {
            current: function() {
                return this._current;
            },
            update: function(newState) {

                const changes = mergeAndBuildChangeIndex(this._current, newState);

                this.apply(changes);

                rootElement.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
            },
            apply: function(changes) {
                if (!changes && !Array.isArray(changes)) {
                    Array.from(this._bindings.keys()).forEach(absPath => {
                        const elementMap = this._bindings.get(absPath);
                        Array.from(elementMap.keys()).forEach(element => {
                            applyState(this, elementMap, absPath, element);
                        });
                    });
                } else {
                    changes.forEach(({ path, src, dst }) => {
                        if (this._bindings.has(path)) {
                            const elementMap = this._bindings.get(path);
                            Array.from(elementMap.keys()).forEach(element => {
                                applyState(this, elementMap, path, element);
                            });
                        }
                    });
                }
            },
            subState(element, initialSubState) {
                return load(element, initialSubState);
            }
        };

        rootElement.state._current = {};
        rootElement.state._idSequence = { next: 0 };
        rootElement.state._bindings = new Map();
        rootElement.state._stateForeachItemBindings = new Map();

        if (!((rootElement == document ? rootElement.documentElement : rootElement).hasAttribute('state-ignore'))) {
            domVisitor(rootElement, rootElement.state._current, (ctx) => visitAndBuild(ctx,rootElement.state));

            mergeAndBuildChangeIndex(rootElement.state._current, initialState);
            rootElement.state.apply();
        }
        rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));
        return rootElement.state;
    }

    document.addEventListener('DOMContentLoaded', () => load(document));
})();