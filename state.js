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

  const stack = [ { scope: rootScope, scopeRootElement: rootElement, absJsonPath: '$' } ];

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

function placeholderFactory(tag, attrs) {
    const placeholder = document.createElement(tag);
    const template = document.createElement('template');
    placeholder.appendChild(template);
    Object.keys(attrs).forEach(k => {
        placeholder.setAttribute(k, attrs[k]);
    });
    return placeholder;
}

function register(templateRegistry, registry, absPath, type, element, relPath, scope) {
    if (scope.$stateForeachScopeRoot) {
        registerTemplate(templateRegistry.get(scope.$stateForeachScopeRoot.parentElement.parentElement.getAttribute('id')), relPath, type, element, scope.$stateForeachScopeRoot);
        return;
    }
    if (!registry.has(absPath)) {
        registry.set(absPath, new Map());
    }
    registry.get(absPath).set(element, type);
}

function registerTemplate(registry, relPath, type, element, listScopeRoot) {
    if (!registry.has(relPath)) {
        registry.set(relPath, new Map());
    }
    const path = [];
    while (element && element !== listScopeRoot) {
        if (!element.parentElement) {
            break;
        }
        const index = ((el) => { let index=0; while((el = el.previousElementSibling)) { ++index; } return index; })(element);
        path.unshift(index);
        element = element.parentElement;
    }
    registry.get(relPath).set(path, type);
}

function visitAndBuild(visitContext, state) {
    const node = visitContext.element;
    const walker = visitContext.walker;
    const idSequence = state._idSequence;
    const registry = state._bindings;
    const templateRegistry = state._stateForeachItemBindings;
    let scope = visitContext.scope;
    let absPath = visitContext.absJsonPath;
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        const isArrayScope = /.*\[\]$/g.test(jsonPath);
        result = { scope: isArrayScope ? { $stateForeachScopeRoot: node } : buildJSONPath(scope, jsonPath, {}), scopeRootElement: node, absJsonPath: jsonPath.replace('@', absPath) };
        scope = result.scope;
        absPath = result.absPath;
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        buildJSONPath(scope, jsonPath, []);
        
        const placeholder = placeholderFactory('state-foreach-placeholder', { "state-foreach": jsonPath, id: `state-auto-id-${++(idSequence.next)}` });
        node.removeAttribute('state-foreach');
        node.setAttribute('state-scope', `${jsonPath}[]`);
        templateRegistry.set(placeholder.getAttribute('id'), new Map());
        node.replaceWith(placeholder);
        placeholder.querySelector('template').appendChild(node);
        walker.currentNode = placeholder;

        register(templateRegistry, registry, jsonPath.replace('@', absPath), 'state-foreach', placeholder, jsonPath, scope);
        return result;
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        buildJSONPath(scope, jsonPath, false);
        
        register(templateRegistry, registry, jsonPath.replace('@', absPath), 'state-if', node, jsonPath, scope);
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        buildJSONPath(scope, jsonPath, false);
        register(templateRegistry, registry, jsonPath.replace('@', absPath), 'state-if-not', node, jsonPath, scope);
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        buildJSONPath(scope, jsonPath, node.textContent ?? '');
        register(templateRegistry, registry, jsonPath.replace('@', absPath), 'state-content', node, jsonPath, scope);
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        buildJSONPath(scope, jsonPath, node.getAttribute(attr.name.replace('state-attr-', '')) ?? '');
        register(templateRegistry, registry, jsonPath.replace('@', absPath), attr.name, node, jsonPath, scope);
    });
    if (node.hasAttribute('state-listen')) {
        const jsonPath = node.getAttribute('state-listen');
        if (!node.hasAttribute("id")) {
            node.setAttribute("id", `state-auto-id-${++(idSequence.next)}`)
        }
        buildJSONPath(scope, jsonPath, node.getAttribute("id"));
        register(templateRegistry, registry, jsonPath.replace('@', absPath), 'state-listen', node, jsonPath, scope);
    }
    return result;
}

function elementOrPath(elementOrPath, listItem) {
    return Array.isArray(elementOrPath) ? elementOrPath.reduce((el,child) => el.children[child], listItem) : elementOrPath;
}

function applyState(elementMap, element, stateType, absPath, rootScope, templateRegistry, listItem = null) {
    if (stateType === 'state-content') {
        const stateContent = getJSONPath(rootScope, absPath);
        element = elementOrPath(element, listItem);
        element.textContent = stateContent;
    }
    else if (stateType.startsWith('state-attr-')) {
        const stateAttr = getJSONPath(rootScope, absPath);
        element = elementOrPath(element, listItem);
        element.setAttribute(stateType.replace('state-attr-', ''), stateAttr);
    }
    else if (stateType === 'state-if') {
        const stateIf = getJSONPath(rootScope, absPath);
        element = elementOrPath(element, listItem);
        if (!stateIf && element.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = placeholderFactory('state-if-placeholder', { "state-if": element.getAttribute('state-if') });
            element.replaceWith(placeholder);
            placeholder.querySelector('template').appendChild(element);
            elementMap.delete(element);
            elementMap.set(placeholder, 'state-if');

        } else if (stateIf && element.tagName === 'STATE-IF-PLACEHOLDER') {

            const content = element.querySelector('template').firstElementChild;
            element.replaceWith(content);
            elementMap.delete(element);
            elementMap.set(content, 'state-if');
        }
    }
    else if (stateType === 'state-if-not') {
        const stateIf = getJSONPath(rootScope, absPath);
        element = elementOrPath(element, listItem);
        if (stateIf && element.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = placeholderFactory('state-if-placeholder', { "state-if-not": element.getAttribute('state-if') });
            element.replaceWith(placeholder);
            placeholder.querySelector('template').appendChild(element);
            elementMap.delete(element);
            elementMap.set(placeholder, 'state-if-not');

        } else if (!stateIf && element.tagName === 'STATE-IF-PLACEHOLDER') {

            const content = element.querySelector('template').firstElementChild;
            element.replaceWith(content);
            elementMap.delete(element);
            elementMap.set(content, 'state-if-not');
        }
    }
    else if (stateType === 'state-foreach') {
        element = elementOrPath(element, listItem);
        const jsonPath = element.getAttribute('state-foreach');
        const stateForeach = getJSONPath(rootScope, absPath);
        const stateTemplate = templateRegistry.get(element.getAttribute("id"));

        element.parentNode.querySelectorAll(`[state-foreach-id="${element.getAttribute("id")}"]`).forEach(el => el.remove());
        if (stateForeach) {
            (Array.isArray(stateForeach) ? stateForeach : [ stateForeach ]).map((item, index) => {
                item.$index = index;
                const domItem = element.querySelector("template").firstElementChild.cloneNode(true);
                domItem.setAttribute("state-foreach-id", element.getAttribute("id"));
                domItem.setAttribute('state-scope', `${jsonPath}[${index}]`);

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