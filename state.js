(function polyfill() {

    function buildJSONPath(root, path, leaf) {
        let split = path.split('.');
        if (split[0] === '$' || split[0] === '@') {
            split = split.slice(1);
        }
        let leafp = split[split.length-1];
        let parent = split.slice(0, split.length-1).reduce((obj, p) => {
            const match = /^(.*)\[([0-9]+)\]$/.exec(p);
            if (match) {
                if (!obj.hasOwnProperty(match[1])) {
                    obj[match[1]] = [];
                }
                return obj[match[1]].at(parseInt(match[2]));
            } else {
                if (!obj.hasOwnProperty(p)) {
                    obj[p] = {};
                }
                return obj[p];
            }
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
        if (!split.length) {
            return root;
        }
        const res = split.reduce((obj, p) => {
            if (!(obj instanceof Object)) { return undefined; }
            const match = /^(.*)\[([0-9]+)\]$/.exec(p);
            return match ? (Array.isArray(obj[match[1]]) ? obj[match[1]].at(parseInt(match[2])) : undefined) : obj[p];
        }, root);
        return res;
    }

    function setFrozenJSONPath(state, path, value) {
        state._current = { ...state._current };
        const thawed = [ state._current ];
        let split = path.split('.');
        if (split[0] === '$' || split[0] === '@') {
            split = split.slice(1);
        }
        const parent = split.slice(0, split.length-1).reduce((obj, p) => {
            if (!(obj instanceof Object)) { return undefined; }
            const match = /^(.*)\[([0-9]+)\]$/.exec(p);
            if (match) {
                obj[match[1]] = [...(obj[match[1]])];
                thawed.push(obj[match[1]]);
                const index = parseInt(match[2]);
                obj[match[1]][index] = { ...(obj[match[1]][index]) };
                return obj[match[1]][index];
            } else {
                obj[p] = {...obj[p]};
                thawed.push(obj[p]);
                return obj[p];
            }
        }, state._current);
        if (parent) {
            const match = /^(.*)\[([0-9]+)\]$/.exec(split.at(-1));
            if (match && Array.isArray(parent[match[1]])) {
                const index = parseInt(match[2]);
                if (index < parent[match[1]].length) {
                    parent[match[1]][index] = value;
                }
            } else if (!match) {
                parent[split.at(-1)] = value;
            }
        }
        thawed.forEach(o => Object.freeze(o));
        if (value instanceof Object) {
            Object.freeze(value);
        }
    }

    function placeholderFactory(attrs) {
        const placeholder = document.createElement('template');
        placeholder.setAttribute('state-placeholder', '');
        Object.keys(attrs).forEach(k => placeholder.setAttribute(k, attrs[k]));
        return placeholder;
    }

    function domVisitor(rootElement, rootScope, composeTags, visit) {

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
                    || composeTags.has(node.tagName)
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

    function unregisterBinding(state, absPath, elementOrPath) {
        state._bindings.has(absPath) && state._bindings.get(absPath).delete(elementOrPath);
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

    function registerStateForeachComposeTag(state, composeTag, element, statForeachRootScope) {
        const id = statForeachRootScope.parentElement.getAttribute('id');
        if (!state._stateForeachComposeTags.has(id)) {
            state._stateForeachComposeTags.set(id, new Map());
        }
        itemBindings = state._stateForeachComposeTags.get(id);
        if (!itemBindings.has(composeTag)) {
            itemBindings.set(composeTag, new Set());
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
        itemBindings.get(composeTag).add(path);
    }

    function registerStateForeachScope(state, absPath) {
        if (!state._stateForeachScopes.has(absPath)) {
            state._stateForeachScopes.set(absPath, {});
        }
        return state._stateForeachScopes.get(absPath);
    }

    function bindToValueAttr(element, absPath, state) {
        if (element.tagName === 'SELECT') {
            element.addEventListener('change', (event) => {
                setFrozenJSONPath(state, absPath, event.target.value);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.value }]);
            });
        }
        else if (element.getAttribute('contenteditable') === 'true') {
            element.addEventListener('input', (event) => {
                setFrozenJSONPath(state, absPath, event.target.textContent);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.textContent }]);
            });
        }
        else if (element.tagName === 'INPUT' && (element.getAttribute('type') === 'checkbox' || element.getAttribute('type') === 'radio')) {
            element.addEventListener('change', (event) => {
                setFrozenJSONPath(state, absPath, event.target.checked);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.checked }]);
            });
        }
        else if (element.tagName === 'INPUT' && element.getAttribute('type') === 'file') {
            element.addEventListener('change', (event) => {
                setFrozenJSONPath(state, absPath, event.target.files);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.files }]);
            });
        }
        else if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' )) {
            element.addEventListener('input', (event) => {
                setFrozenJSONPath(state, absPath, event.target.value);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.value }]);
            });
        }
    }

    function bindToOpenAttr(element, absPath, state) {
        if (element.tagName === 'DETAILS') {
            element.addEventListener('toggle', (event) => {
                setFrozenJSONPath(state, absPath, event.target.open);
                state.apply([{ path: absPath, src: getJSONPath(state._current, absPath), dst: event.target.open }]);
            });
        }
    }

    function bindToStateListenAttr(element, previousStateValue, stateValue) {
        Object.keys(previousStateValue ?? {}).forEach(k => {
            element.removeEventListener(k, previousStateValue[k]);
        });
        Object.keys(stateValue ?? {}).forEach(k => {
            element.addEventListener(k, stateValue[k]);
        });
    }

    function loadView(state, element, templatePath) {
        if (state._depth >= document.state._maxDepth) {
            throw new Error(`Cannot load view ${templatePath} for ${element.tagName}. Maximum state nesting depth exceeded.`);
        }
        const local = document.getElementById(templatePath);
        (local && local.tagName === 'TEMPLATE'
            ? Promise.resolve(local.innerHTML)
            : fetch(templatePath).then(res => res.ok ? res.text() : ''))
        .then(html => {
            if (html) {
                element.innerHTML = html;
                newState = document.state.create(element);
                newState._depth = state._depth + 1;
                element.dispatchEvent(new CustomEvent("StateComposed", {
                    bubbles: true,
                    detail: { view: templatePath, state: newState }
                }));
            }
        });
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
                scope: isStateForeachItemScope 
                    ? registerStateForeachScope(state, node.parentElement?.getAttribute('state-foreach').replace('@', absPath))
                    : buildJSONPath(scope, jsonPath, {}),
                scopeRootElement: node,
                absJsonPath: jsonPath.replace('@', absPath),
                isStateForeachItemScope
            };
            node.setAttribute('state-scope', jsonPath.replace('@', absPath));
            scope = result.scope;
            scopeRootElement = result.scopeRootElement;
            absPath = result.absPath;
            isStateForeachItemScope = result.isStateForeachItemScope;
        }
        if (node.hasAttribute('state-foreach')) {
            const jsonPath = node.getAttribute('state-foreach');
            buildJSONPath(scope, jsonPath, []);

            let placeholder = node;
            if (!node.hasAttribute('state-placeholder')) {
                placeholder = placeholderFactory({ 'state-foreach': jsonPath, 'id': `state-auto-id-${++(state._idSequence.next)}` });
                node.removeAttribute('state-foreach');
                node.setAttribute('state-scope', `${jsonPath.replace('@', absPath)}[]`);
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
            buildJSONPath(scope, jsonPath, false);
            if (!isStateForeachItemScope) {
                registerBinding(state, jsonPath.replace('@', absPath), 'state-if', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-if', node, scopeRootElement)
            }
        }
        if (node.hasAttribute('state-if-not')) {
            const jsonPath = node.getAttribute('state-if-not');
            buildJSONPath(scope, jsonPath, false);
            if (!isStateForeachItemScope) {
                registerBinding(state, jsonPath.replace('@', absPath), 'state-if-not', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-if-not', node, scopeRootElement)
            }
        }
        if (node.hasAttribute('state-content')) {
            const jsonPath = node.getAttribute('state-content');
            buildJSONPath(scope, jsonPath, node.textContent ?? '');
            if (!isStateForeachItemScope) {
                registerBinding(state, jsonPath.replace('@', absPath), 'state-content', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-content', node, scopeRootElement)
            }
        }
        Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
            const jsonPath = attr.value;
            const attrName = attr.name.replace('state-attr-', '');
            buildJSONPath(scope, jsonPath, node.getAttribute(attrName) ?? '');
            if (!isStateForeachItemScope) {
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
            if (!isStateForeachItemScope) {
                if (!node.hasAttribute("id")) {
                    node.setAttribute("id", `state-auto-id-${++(state._idSequence.next)}`);
                }
                registerBinding(state, jsonPath.replace('@', absPath), 'state-listen', node);
            } else {
                registerStateForeachBinding(state, jsonPath, 'state-listen', node, scopeRootElement);
            }
        }
        if (state._composeTags.has(node.tagName)) {
            const templatePath = state._composeTags.get(node.tagName);
            if (!isStateForeachItemScope) {
                loadView(state, node, templatePath);
            } else {
                registerStateForeachComposeTag(state, node.tagName, node, scopeRootElement);
            }
        }
        return result;
    }

    function removeStateForeachItem(state, absPath, statForeachElement, existingItemsQuery, index) {
        const stateTemplate = state._stateForeachItemBindings.get(statForeachElement.getAttribute("id"));
        function remove(el, index) {
            Array.from(stateTemplate.keys()).map(path => path.replace('@', `${absPath}[${index}]`)).forEach(path => unregisterBinding(state, path, el));
            el.remove();
        }
        if (index === undefined) {
            existingItemsQuery.forEach(remove);
        } else {
            let el = Array.from(existingItemsQuery).at(index);
            if (el) {
                remove(el, index);
            }
        }
    }

    function foreachStateItemFactory(state, absPath, statForeachElement, index) {
        const domItem = statForeachElement.firstElementChild.cloneNode(true);
        const stateForeachId = statForeachElement.getAttribute("id");
        domItem.setAttribute("state-foreach-id", stateForeachId);
        domItem.setAttribute('state-scope', `${absPath}[${index}]`);

        const stateTemplate = state._stateForeachItemBindings.get(stateForeachId);
        if (stateTemplate) {
            Array.from(stateTemplate.keys()).forEach(itemPath => {
                const tempaltePathMap = stateTemplate.get(itemPath);
                Array.from(tempaltePathMap.keys()).forEach(DOMPath => {
                    registerBinding(state, itemPath.replace('@', `${absPath}[${index}]`), tempaltePathMap.get(DOMPath), { DOMPath: DOMPath, stateForeachItemRoot: domItem });
                    bindFoeachListItemState(state, domItem, itemPath.replace('@', `${absPath}[${index}]`), DOMPath, tempaltePathMap.get(DOMPath));
                });
            });
        }
        const composeTags = state._stateForeachComposeTags.get(stateForeachId);
        if (composeTags) {
            Array.from(composeTags.keys()).forEach(composeTag => {
                const templatePathMap = composeTags.get(composeTag);
                Array.from(templatePathMap.keys()).forEach(DOMPath => {
                    loadForeachListItemView(state, domItem, DOMPath, composeTag);
                });
            });
        }

        return domItem;
    }

    function bindFoeachListItemState(state, stateForeachItemRoot, absPath, DOMPath, stateType) {
        const element = DOMPath.reduce((el,child) => el.children[child], stateForeachItemRoot)
        if (stateType.startsWith('state-attr-')) {
            const attrName = stateType.replace('state-attr-', '');
            if (attrName === 'value') {
                bindToValueAttr(element, absPath, state);
            } else if (attrName === 'open') {
                bindToOpenAttr(element, absPath, state);
            }
        }
        else if (stateType === 'state-listen' && !element.hasAttribute("id")) {
            element.setAttribute("id", `state-auto-id-${++(state._idSequence.next)}`);
        }
    }

    function loadForeachListItemView(state, stateForeachItemRoot, DOMPath, tagName) {
        const element = DOMPath.reduce((el,child) => el.children[child], stateForeachItemRoot)
        loadView(state, element, state._composeTags.get(tagName));
    }

    function applyStateChange(state, elementMap, absPath, elementOrPath, src, dst) {
        const stateType = elementMap.get(elementOrPath);
        const stateValue = getJSONPath(state._current, absPath);
        const element = elementOrPath instanceof HTMLElement
            ? elementOrPath
            : elementOrPath.DOMPath.reduce((el,child) => el.children[child], elementOrPath.stateForeachItemRoot);

        if (stateType === 'state-content') {    
            element.textContent = stateValue;
        }
        else if (stateType.startsWith('state-attr-')) {
            const attrName = stateType.replace('state-attr-', '');
            if (attrName === 'value') {
                element.value = stateValue;
            } else if (attrName === 'open') {
                element.open = !!stateValue;
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
            const forEachId = element.getAttribute("id");
            const existingItemsQuery = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
            if (src === undefined && dst === undefined) {
                removeStateForeachItem(state, absPath, element, existingItemsQuery);
                if (stateValue) {
                    (Array.isArray(stateValue) ? stateValue : [ stateValue ])
                        .map((item, index) => foreachStateItemFactory(state, absPath, element, index))
                        .reverse()
                        .forEach(el => element.after(el));
                }
            } else {
                if (src.length > stateValue.length) {
                    Array.from(existingItemsQuery).slice(-1*(src.length - stateValue.length)).forEach((el, index) => {
                        removeStateForeachItem(state, absPath, element, existingItemsQuery, src.length-1-index);
                    });
                } else if (src.length < stateValue.length) {
                    for (let i=0; i<stateValue.length - src.length; ++i) {
                        const el = foreachStateItemFactory(state, absPath, element, src.length+i);
                        const query = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
                        (query.length ? Array.from(query).at(-1) : element).after(el);
                    }
                }
            }
        }
        else if (stateType === 'state-listen') {
            bindToStateListenAttr(element, src, dst ?? stateValue);
        }
    }

    function buildArrayChanges(path, src, dst, res, toMerge, stateForeachScopes, onNotEqual) {
        const stateScope = stateForeachScopes.get(path.replace(/\[[0-9+]\]/g, '[]'));
        const arrayChanges = { path, src, dst, pending: true };
        dst.forEach((e,i) => { e.$index = i; });
        toMerge.push({ commit: res, src, dst });
        if (!Array.isArray(src)) {
            arrayChanges.pending = false;
            onNotEqual?.forEach(f => f());
            dst.forEach((e,i) => {
                toMerge.push({ path: `${path}[${i}]`, src: i == 0 ? src : structuredClone(stateScope), dst: e, res: res[i] });
            });
        } else if (dst.length != src.length) {
            arrayChanges.pending = false;
            onNotEqual?.forEach(f => f());
            dst.forEach((e,i) => {
                toMerge.push({ path: `${path}[${i}]`, src: src.at(i) ?? structuredClone(stateScope), dst: e, res: res[i] });
            });
        } else {
            dst.forEach((e, i) => {
                toMerge.push({ path: `${path}[${i}]`, src: src[i], dst: e, res: res[i], onNotEqual: [ ...(onNotEqual ?? []), () => { arrayChanges.pending = false; } ] });
            });
        }
        return arrayChanges;
    }

    function buildObjectChanges(path, src, dst, res, toMerge, changeIndex, onNotEqual) {
        toMerge.push({ commit: res, src, dst });
        const objectChanges = { path, src, dst, pending: true };
        changeIndex.push(objectChanges);
        Object.keys(dst).forEach((key) => {
            toMerge.push({
                path: `${path}.${key}`,
                src: src?.hasOwnProperty(key) ? src[key] : undefined,
                dst: dst[key],
                onNotEqual: [ ...(onNotEqual ?? []), () => { objectChanges.pending = false; } ],
                res: res[key]
            });
        });
    }

    function mergeChanges(src, dst, state) {
        const stateForeachScopes = state._stateForeachScopes;
        const changeIndex = [];
        if (dst && dst instanceof Object) {
            const res = { ...src, ...dst };
            const toMerge = [ { path: "$", src, dst, res } ];
            while (toMerge.length) {
                const tuple = toMerge.pop();
                if (tuple.commit) {
                    if (tuple.commit !== tuple.dst) {
                        Object.assign(tuple.commit, { ...(Array.isArray(tuple.dst) ? [] : tuple.src), ...tuple.dst });
                        Object.freeze(tuple.commit);
                    }
                } else if (Array.isArray(tuple.dst)) {
                    changeIndex.push(buildArrayChanges(tuple.path, tuple.src, tuple.dst, tuple.res, toMerge, stateForeachScopes, tuple.onNotEqual));
                } else if (tuple.dst instanceof Object && !(tuple.dst instanceof Function)) {
                    buildObjectChanges(tuple.path, tuple.src, tuple.dst, tuple.res, toMerge, changeIndex, tuple.onNotEqual);
                } else {
                    if (tuple.dst !== tuple.src) {
                        changeIndex.push(tuple);
                        tuple.onNotEqual?.forEach(f => f());
                    }
                }
            }
            state._current = res;
        }
        return changeIndex.filter(ch => !ch.pending);
    }

    function serializeContractIface(ifaceName, ifaceRoot, allIfaces, ifaceNameSeq) {
        let contractStr = `export interface ${ifaceName} { `;
        const serializeStack = Object.keys(ifaceRoot).map(k => ({ name: k, value: ifaceRoot[k] }));
        while (serializeStack.length) {
            const next = serializeStack.pop();
            if (next.commit) {
                contractStr += next.commit;
                continue;
            }
            const props = Object.keys(next.value).filter(p => p !== '$attr' && p !== '$arrayContract');
            if (props.length) {
                contractStr += `${next.name}: { `;
                serializeStack.push({ commit: '}; ' });
                props.forEach(p => serializeStack.push({ name: p, value: ifaceRoot[p] }));
            } else if (next.value.$attr?.find(a => a === 'state-listen')) {
                contractStr += `${next.name}: { [eventName: string]: (event: Event) => void; }; `;
            } else if (next.value.$arrayContract) {
                const acName = `StateForeachContract${++(ifaceNameSeq.next)}`;
                allIfaces.push({ name: acName, root: next.value.$arrayContract });
                contractStr += `${next.name}: Array<${acName}>; `;
            } else if (next.value.$attr.length) {
                contractStr += `${next.name}: any; `;
            }
        }
        contractStr += '} ';
        return contractStr;
    }

    function buildContract(state) {
        const contractRoot = {};
        const foreachItemQueue = [];
        state._bindings.keys().forEach(b => {
            const def = buildJSONPath(contractRoot, b);
            def.$attr = [ ...(def.$attr ?? []), ...state._bindings.get(b).values().filter(a => a !== 'state-foreach') ];
            state._bindings.get(b).keys()
                .filter(a => state._bindings.get(b).get(a) === 'state-foreach')
                .forEach(el => {
                    const id = el.getAttribute('id');
                    if (!def.$arrayContract) {
                        def.$arrayContract = {};
                    }
                    foreachItemQueue.push({ id: el.getAttribute('id'), foreachStateRoot: el, contract: def.$arrayContract })
                });
        });
        while (foreachItemQueue.length) {
            const next = foreachItemQueue.shift();

            const iBindings = state._stateForeachItemBindings.get(next.id);
            iBindings.keys().forEach(ib => {
                const idef = buildJSONPath(next.contract, ib);
                idef.$attr = [ ...(idef.$attr ?? []), ...iBindings.get(ib).values().filter(a => a !== 'state-foreach') ];
                iBindings.get(ib).keys()
                    .filter(ia => iBindings.get(ib).get(ia) === 'state-foreach')
                    .map(ipath => ipath.reduce((el, child) => el.children[child], next.foreachStateRoot.children[0]).getAttribute('id'))
                    .forEach(iid => {
                        if (!idef.$arrayContract) {
                            idef.$arrayContract = {};
                        }
                        foreachItemQueue.push({ id: iid, contract: idef.$arrayContract })
                    });
            });
        }
        let stateStr = '';
        const interfacesQueue = [ { name: 'ViewState', root: contractRoot } ];
        const ifaceNameSeq = { next: 0 };
        while (interfacesQueue.length) {
            const next = interfacesQueue.shift();
            stateStr += serializeContractIface(next.name, next.root, interfacesQueue, ifaceNameSeq);
        }
        return stateStr;
    }

    const stateDTs = 
`declare namespace StateJs {

    type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
    };

    export interface StateInstance<T> {
        current(): Readonly<T>;
        update(patch: DeepPartial<T>): void;
        scopeOf(el: HTMLElement): any;
        subState<S>(el: HTMLElement): StateInstance<S>;
    }
}`;
    
    function load(rootElement) {
        rootElement.state = {
            current: function() {
                return this._current;
            },
            scopeOf(element) {
                if (!rootElement.contains(element)) {
                    return undefined;
                }
                while (element != rootElement) {
                    if (element.hasAttribute("state-scope")) {
                        return getJSONPath(this._current, element.getAttribute("state-scope"));
                    }
                    element = element.parentElement;
                }
                return this._current;
            },
            update: function(newState) {

                const changes = mergeChanges(this._current, newState, this);
                this.apply(changes);

                rootElement.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
            },
            apply: function(changes) {
                if (!changes && !Array.isArray(changes)) {
                    this._bindings.keys().forEach(path => {
                        const elementMap = this._bindings.get(path);
                        elementMap.keys().forEach(element => applyStateChange(this, elementMap, path, element, undefined, undefined));
                    });
                    return;
                }
                changes.forEach(({ path, src, dst }) => {
                    if (this._bindings.has(path)) {
                        const elementMap = this._bindings.get(path);
                        elementMap.keys().forEach(element => applyStateChange(this, elementMap, path, element, src, dst));
                    }
                });
            },
            create(element) {
                return load(element);
            },
            contract(namespace = 'Generated') {
                if (!this._contract) {
                    return stateDTs + ` declare namespace StateJs.${namespace} { export interface ViewState { } }`
                        + ' export interface Document { state: StateJs.StateInstance<ViewState>; }'
                        + ' export interface DocumentEventMap { "StateLoaded": Event; "StateUpdated": Event; }'
                }
                return stateDTs + ` declare namespace StateJs.${namespace} { ${this._contract} }`
                    + ' export interface Document { state: StateJs.StateInstance<StateJs.Generated.ViewState>; }'
                    + ' export interface DocumentEventMap { "StateLoaded": Event; "StateUpdated": Event; }'
            }
        };

        rootElement.state._current = {};
        rootElement.state._idSequence = { next: 0 };
        rootElement.state._bindings = new Map();
        rootElement.state._composeTags = new Map();
        rootElement.state._stateForeachItemBindings = new Map();
        rootElement.state._stateForeachComposeTags = new Map();
        rootElement.state._stateForeachScopes = new Map();
        rootElement.state._depth = 0;
        if (rootElement === document) {
            rootElement.state._maxDepth = 1;
        }

        rootElement.querySelectorAll("state-compose").forEach(compose => {
            const tag = compose.getAttribute('tag');
            const src = compose.getAttribute('src');
            if (tag && src) {
                rootElement.state._composeTags.set(tag.toUpperCase(), src);
            }
        });
        if (!(rootElement == document && rootElement.documentElement.hasAttribute('state-ignore'))) {
            domVisitor(rootElement, rootElement.state._current, rootElement.state._composeTags, (ctx) => visitAndBuild(ctx,rootElement.state));
            rootElement.state.apply();
            
            rootElement.state._contract = buildContract(rootElement.state);
        }
        rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));
        return rootElement.state;
    }

    document.addEventListener('DOMContentLoaded', () => load(document));
})();