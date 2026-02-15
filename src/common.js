
function buildJSONPath(root, path, leaf, forceLeaf = false) {
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
    if (!parent.hasOwnProperty(leafp) || forceLeaf) {
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

function placeholderFactory(attrs) {
    const placeholder = document.createElement('template');
    placeholder.setAttribute('state-placeholder', '');
    placeholder.setAttribute('state-mutation-ignore', '');
    Object.keys(attrs).forEach(k => placeholder.setAttribute(k, attrs[k]));
    return placeholder;
}

function ignoreMutations(element) {
    element.setAttribute('state-mutation-ignore', '');
}

function registerBinding(state, absPath, type, element) {
    if (!state._bindings.has(absPath)) {
        state._bindings.set(absPath, new Map());
    }
    if (!state._bindings.get(absPath).has(element)) {
        state._bindings.get(absPath).set(element, []);
    }
    state._bindings.get(absPath).get(element).push(type);
}

function unregisterBinding(state, absPath, elementOrPath, stateType = undefined) {
    if (stateType) {
        if (state._bindings.has(absPath) && state._bindings.get(absPath).has(elementOrPath)) {
            const types = state._bindings.get(absPath).get(elementOrPath);
            types.splice(types.indexOf(stateType), 1);
            if (!types.length) {
                state._bindings.get(absPath).delete(elementOrPath);
            }
        }
    } else {
        state._bindings.has(absPath) && state._bindings.get(absPath).delete(elementOrPath);
    }
    if (!state._bindings.get(absPath).size) {
        state._bindings.delete(absPath);
    }
}

function bindToValueAttr(element, absPath, state) {
    if (element.tagName === 'SELECT') {
        element.addEventListener('change', (event) => state.update([{ jsonPath: absPath, value: event.target.value }]));
    }
    else if (element.getAttribute('contenteditable') === 'true') {
        element.addEventListener('input', (event) => state.update([{ jsonPath: absPath, value: event.target.textContent }], `state-attr-value="${absPath}"`));
    }
    else if (element.tagName === 'INPUT' && (element.getAttribute('type') === 'checkbox' || element.getAttribute('type') === 'radio')) {
        element.addEventListener('change', (event) => state.update([{ jsonPath: absPath, value: event.target.checked }], `state-attr-value="${absPath}"`));
    }
    else if (element.tagName === 'INPUT' && element.getAttribute('type') === 'file') {
        element.addEventListener('change', (event) => state.update([{ jsonPath: absPath, value: event.target.files }], `state-attr-value="${absPath}"`));
    }
    else if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' )) {
        element.addEventListener('input', (event) => state.update([{ jsonPath: absPath, value: event.target.value }], `state-attr-value="${absPath}"`));
    }
}

function bindToOpenAttr(element, absPath, state) {
    if (element.tagName === 'DETAILS') {
        element.addEventListener('toggle', (event) => state.update([{ jsonPath: absPath, value: event.target.open }], `state-attr-open="${absPath}"`));
    }
}

function setValueOrOpenAttr(element, attrName, stateValue) {
    if (attrName === 'value') {
        element.value = stateValue;
    } else if (attrName === 'checked') {
        element.checked = !!stateValue;
    } else if (attrName === 'open') {
        element.open = !!stateValue;
    }
}

function loadView(state, element, absPath) {
    if (!state._composeTags.has(element.tagName)) {
        return Promise.reject(`Failed to load view for ${element.tagName}.`);
    }
    if (state._depth >= document.state._maxDepth) {
        return Promise.reject(`Cannot load view for ${element.tagName}. Maximum state nesting depth exceeded.`)
    }
    return state._composeTags.get(element.tagName)
        .then(html => {
            if (html) {
                element.innerHTML = html;
                return document.state.create(element);
            } else {
                return undefined;
            }
        })
        .then(newState => {
            if (newState) {
                newState._parentStateRoot = state._element;
                newState._parentStateAbsPath = absPath;
                newState._depth = state._depth + 1;
                element.dispatchEvent(new CustomEvent("StateComposed", {
                    bubbles: true,
                    detail: { state: newState }
                }));
            } else {
                return undefined;
            }
        })
        .then(() => [element,absPath,undefined]);
}

function domVisitor(state, rootElement, absPath, composeTags, visit) {

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
                || node.hasAttribute('state-root')
                || composeTags.has(node.tagName)
                || Array.from(node.attributes).find(a => a.name.startsWith('state-attr-') || a.name.startsWith('state-class-'))
            )
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP)
        }
    );

    const stack = [ { scope: state._current, scopeRootElement: state._element, absJsonPath: absPath, isStateForeachItemScope: false } ];

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

function registerStateForeachScope(state, absPath) {
    if (!state._stateForeachScopes.has(absPath)) {
        state._stateForeachScopes.set(absPath, {});
    }
    return state._stateForeachScopes.get(absPath);
}

function unregisterStateForeachScope(state, absPath) {
    state._stateForeachScopes.delete(absPath);
}

function registerStateForeachBinding(state, relPath, stateType, element, statForeachRootScope) {
    const id = statForeachRootScope.parentElement.getAttribute('id');
    if (!state._stateForeachItemBindings.has(id)) {
        state._stateForeachItemBindings.set(id, new Map());
    }
    const itemBindings = state._stateForeachItemBindings.get(id);
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
    if (!itemBindings.get(relPath).has(path)) {
        itemBindings.get(relPath).set(path, []);
    }
    itemBindings.get(relPath).get(path).push(stateType);
}

function unregisterStateForeachBinding(state, relPath, stateType, element, statForeachRootScope) {
    const id = statForeachRootScope.parentElement.getAttribute('id');
    const itemBindings = state._stateForeachItemBindings.get(id)?.get(relPath);
    if (!itemBindings) {
        return;
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
    if (!itemBindings.get(relPath).has(path)) {
        return;
    }
    const index = itemBindings.get(relPath).get(path).indexOf(stateType);
    if (index > -1) {
        itemBindings.get(relPath).get(path).splice(index, 1);
    }
    if (!itemBindings.get(relPath).get(path).length) {
        itemBindings.get(relPath).delete(path);
    }
    if (!itemBindings.get(relPath).size) {
        itemBindings.delete(relPath);
    }
    if (!state._stateForeachItemBindings.get(id).size) {
        state._stateForeachItemBindings.delete(id);
    }
}

function registerStateForeachComposeTag(state, composeTag, element, statForeachRootScope) {
    const id = statForeachRootScope.parentElement.getAttribute('id');
    if (!state._stateForeachComposeTags.has(id)) {
        state._stateForeachComposeTags.set(id, new Map());
    }
    const itemBindings = state._stateForeachComposeTags.get(id);
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

function unregisterStateForeachComposeTag(state, composeTag, element, statForeachRootScope) {
    const id = statForeachRootScope.parentElement.getAttribute('id');
    const itemBindings = state._stateForeachComposeTags.get(id)?.get(composeTag);
    if (!itemBindings) {
        return;
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
    itemBindings.delete(path);
    if (!itemBindings.size) {
        state._stateForeachComposeTags.get(id).delete(composeTag);
    }
    if (!state._stateForeachComposeTags.get(id).size) {
        state._stateForeachComposeTags.delete(id);
    }
}

export { 
    buildJSONPath,
    getJSONPath,
    registerBinding,
    unregisterBinding,
    placeholderFactory,
    bindToValueAttr,
    setValueOrOpenAttr,
    bindToOpenAttr,
    loadView,
    ignoreMutations,
    domVisitor,
    registerStateForeachScope,
    unregisterStateForeachScope,
    registerStateForeachBinding,
    unregisterStateForeachBinding,
    registerStateForeachComposeTag,
    unregisterStateForeachComposeTag
};