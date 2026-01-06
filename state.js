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
                && node.parentElement.hasAttribute('state-foreach');
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
            
            const placeholder = placeholderFactory({ 'state-foreach': jsonPath, 'id': `state-auto-id-${++(state._idSequence.next)}` });
            node.removeAttribute('state-foreach');
            node.setAttribute('state-scope', jsonPath);
            node.replaceWith(placeholder);
            placeholder.appendChild(node);
            visitContext.walker.currentNode = placeholder;

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
            if (!isStateForeachItemScope) {
                buildJSONPath(scope, jsonPath, node.getAttribute(attr.name.replace('state-attr-', '')) ?? '');
                registerBinding(state, jsonPath.replace('@', absPath), attr.name, node);
            } else {
                registerStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement)
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

    function applyState(elementMap, element, stateType, absPath, rootScope, templateRegistry, listItem = null) {
        const stateValue = getJSONPath(rootScope, absPath);
        element = Array.isArray(element) ? element.reduce((el,child) => el.children[child], listItem) : element;

        if (stateType === 'state-content') {    
            element.textContent = stateValue;
        }
        else if (stateType.startsWith('state-attr-')) {
            element.setAttribute(stateType.replace('state-attr-', ''), stateValue);
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
            const stateTemplate = templateRegistry.get(element.getAttribute("id"));
            element.parentNode.querySelectorAll(`[state-foreach-id="${element.getAttribute("id")}"]`).forEach(el => el.remove());
            if (stateValue) {
                (Array.isArray(stateValue) ? stateValue : [ stateValue ]).map((item, index) => {
                    item.$index = index;
                    const domItem = element.firstElementChild.cloneNode(true);
                    domItem.setAttribute("state-foreach-id", element.getAttribute("id"));
                    domItem.setAttribute('state-scope', `${element.getAttribute('state-foreach')}[${index}]`);

                    Array.from(stateTemplate.keys()).forEach(itemPath => {
                        const itemAbsPath = itemPath.replace('@', `${absPath}[${index}]`);
                        const tempaltePathMap = stateTemplate.get(itemPath);
                        Array.from(tempaltePathMap.keys()).forEach(templatePath => {
                            applyState(tempaltePathMap, templatePath, tempaltePathMap.get(templatePath), itemAbsPath, rootScope, templateRegistry, domItem);
                        });
                    });

                    return domItem;
                }).reverse().forEach(i => element.after(i));
            }
        }
    }

    document.state = {
        build: function(initialState) {

            this._current = {};
            this._idSequence = { next: 0 };
            this._bindings = new Map();
            this._stateForeachItemBindings = new Map();
            domVisitor(document.documentElement, this._current, (ctx) => visitAndBuild(ctx,this));

            this.update(initialState);
        },
        current: function() {
            return document.state._current;
        },
        apply: function() {
            Array.from(this._bindings.keys()).forEach(absPath => {
                const elementMap = this._bindings.get(absPath);
                Array.from(elementMap.keys()).forEach(element => {
                    applyState(elementMap, element, elementMap.get(element), absPath, this._current, this._stateForeachItemBindings);
                });
            });
        },
        update: function(newState) {

            if (newState && newState instanceof Object) {
                const toMerge = [ { src: this._current, dst: newState } ];
                while (toMerge.length) {
                    const pair = toMerge.pop();
                    Object.keys(pair.dst).forEach(p => {
                        if (pair.dst[p] instanceof Object && pair.src.hasOwnProperty(p)) {
                            toMerge.push({ src: pair.src[p], dst: pair.dst[p] });
                        }
                    });
                    Object.assign(pair.src, pair.dst);
                }
            }

            document.state.apply();
        }
    };
})();