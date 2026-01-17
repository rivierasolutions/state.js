
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

function placeholderFactory(attrs) {
    const placeholder = document.createElement('template');
    placeholder.setAttribute('state-placeholder', '');
    Object.keys(attrs).forEach(k => placeholder.setAttribute(k, attrs[k]));
    return placeholder;
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
}

function bindToValueAttr(element, absPath, state) {
    if (element.tagName === 'SELECT') {
        element.addEventListener('change', (event) => state.update([{ jsonPath: absPath, value: event.target.value }]));
    }
    else if (element.getAttribute('contenteditable') === 'true') {
        element.addEventListener('input', (event) => state.update([{ jsonPath: absPath, value: event.target.textContent }]));
    }
    else if (element.tagName === 'INPUT' && (element.getAttribute('type') === 'checkbox' || element.getAttribute('type') === 'radio')) {
        element.addEventListener('change', (event) => state.update([{ jsonPath: absPath, value: event.target.checked }]));
    }
    else if (element.tagName === 'INPUT' && element.getAttribute('type') === 'file') {
        element.addEventListener('change', (event) => state.update([{ jsonPath: absPath, value: event.target.files }]));
    }
    else if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' )) {
        element.addEventListener('input', (event) => state.update([{ jsonPath: absPath, value: event.target.value }]));
    }
}

function bindToOpenAttr(element, absPath, state) {
    if (element.tagName === 'DETAILS') {
        element.addEventListener('toggle', (event) => state.update([{ jsonPath: absPath, value: event.target.open }]));
    }
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

export { buildJSONPath, getJSONPath, registerBinding, unregisterBinding, placeholderFactory, bindToValueAttr, bindToOpenAttr, loadView };