
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

function registerBinding(state, absPath, type, element) {
    if (!state._bindings.has(absPath)) {
        state._bindings.set(absPath, new Map());
    }
    state._bindings.get(absPath).set(element, type);
}

function unregisterBinding(state, absPath, elementOrPath) {
    state._bindings.has(absPath) && state._bindings.get(absPath).delete(elementOrPath);
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