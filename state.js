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
        if (match) {
            let array = obj[match[1]];
            if (array.$discriminator === 'state-foreach') {
                array = array.value;
            }
            return array[parseInt(match[2])];
        } else {
            return obj[p];
        }
    }, root);
    return res;
}

function isAbsoluteJSONPath(path) {
    return path.split('.')[0] === '$';
}

function scopeHierarchyVisitor(rootScope, visit) {

  const walker = document.createTreeWalker(
    rootScope.element,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => (node.hasAttribute('state-scope') 
            || node.hasAttribute('state-if')
            || node.hasAttribute('state-if-not')
            || node.hasAttribute('state-foreach')
            || node.hasAttribute('state-content')
            || node.hasAttribute('state-listen')
            || Array.from(node.attributes).find(a => a.name.startsWith('state-attr-'))
        )
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    }
  );

  const stack = [ rootScope ];

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    while (true) {
        const scope = stack[stack.length-1];
        
        if (scope.element !== currentNode && scope.element.contains(currentNode)) {
            const newScope = visit(currentNode, scope, walker);
            if (newScope) {
                stack.push(newScope);
            }
            break;
        } else {
            stack.pop();
        }
    }
  }
}

function stateRawValuesVisitor(rootScope) {
    let result = {};
    let objectsToVisit = [ { state: rootScope.children, res: result } ];
    while(objectsToVisit.length) {
        let pair = objectsToVisit.pop();
        Object.keys(pair.state).forEach(pname => {
            let prop = pair.state[pname];
            if (!prop.$discriminator) {
                if (!pair.res.hasOwnProperty(pname)) {
                    pair.res[pname] = {};
                }
                objectsToVisit.push({ state: prop, res: pair.res[pname] });
            }
            if (prop.$discriminator === 'state-scope') {
                if (!pair.res.hasOwnProperty(pname)) {
                    pair.res[pname] = {};
                }
                objectsToVisit.push({ oldS: prop.children, newS: pair.res[pname] });
            }
            if (prop.$discriminator === 'state-if') {
                if (!pair.res.hasOwnProperty(pname)) {
                    pair.res[pname] = prop.value;
                }
            }
            if (prop.$discriminator === 'state-foreach') {
                pair.res[pname] = [];
                if (prop.value) {
                    (Array.isArray(prop.value) ? prop.value : [ prop.value ]).forEach(item => {
                        pair.res[pname].push({});
                        objectsToVisit.push({ state: item.children, res: pair.res[pname][pair.res[pname].length-1] });
                    });
                }
            }
            if (prop.$discriminator === 'state-content') {
                if (!pair.res.hasOwnProperty(pname)) {
                    pair.res[pname] = prop.value;
                }
            }
            if (prop.$discriminator === 'state-attr') {
                if (!pair.res.hasOwnProperty(pname)) {
                    pair.res[pname] = prop.value;
                }
            }
            if (prop.$discriminator === 'state-listen') {
                if (!pair.res.hasOwnProperty(pname)) {
                    pair.res[pname] = prop.element;
                }
            }
        });
    }
    return result;
}

function stateUpdateVisitor(rootScope, newState) {
    if (newState) {
        let objectsToVisit = [ { oldS: rootScope.children, newS: newState } ];
        while(objectsToVisit.length) {
            let pair = objectsToVisit.pop();
            Object.keys(pair.oldS).forEach(pname => {
                if (!pair.newS.hasOwnProperty(pname)) {
                    return;
                }
                let prop = pair.oldS[pname];
                if (!prop.$discriminator) {
                    objectsToVisit.push({ oldS: prop, newS: pair.newS[pname] });
                }
                if (prop.$discriminator === 'state-scope') {
                    objectsToVisit.push({ oldS: prop.children, newS: pair.newS[pname] });
                }
                if (prop.$discriminator === 'state-if') {
                    prop.value = pair.newS[pname];
                }
                if (prop.$discriminator === 'state-foreach') {
                    if (!pair.newS[pname]) {
                        prop.value = [];
                    } else {
                        prop.value = (Array.isArray(pair.newS[pname]) ? pair.newS[pname] : [ pair.newS[pname] ]).map((item, index) => {
                            const res = structuredClone(prop.scopeTemplate);
                            stateUpdateVisitor(res, { $index: index, ...item });
                            return res;
                        });
                    }
                }
                if (prop.$discriminator === 'state-content') {
                    prop.value = pair.newS[pname];
                }
                if (prop.$discriminator === 'state-attr') {
                    prop.value = pair.newS[pname];
                }
            });
        }
    }
}

function stateScopeFactory(element) {
    return { $discriminator: 'state-scope', element, children: {} };
}

function stateIfFactory() {
    return { $discriminator: 'state-if', value: false, bindings: new Map() };
}

function stateContentFactory(element) {
    return { $discriminator: 'state-content', value: element?.textContent ?? "" };
}

function stateAttrFactory(element, attrName) {
    return { $discriminator: 'state-attr', attr: attrName, value: element.getAttribute(attrName) ?? null };
}

function stateListenFactory(element) {
    return { $discriminator: 'state-listen', element };
}

function stateForeachFactory(element) {
    const scopeTemplate = stateScopeFactory(null);
    scopeTemplate.children.$index = stateContentFactory(null);
    return { $discriminator: 'state-foreach', value: [], bindings: new Map(), scopeTemplate };
}

function visitAndBuild(node, scope, walker, listItemScopeTemplates) {
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        result = buildJSONPath(scope.children, jsonPath, stateScopeFactory(node));
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        const stateIf = buildJSONPath(scope.children, jsonPath, stateIfFactory());
        stateIf.bindings.set(node, { outerHtml: node.outerHTML });
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        const stateIf = buildJSONPath(scope.children, jsonPath, stateIfFactory());
        stateIf.bindings.set(node, { outerHtml: node.outerHTML });
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        const stateForeach = buildJSONPath(scope.children, jsonPath, stateForeachFactory());
        
        const placeholder = document.createElement('state-foreach-placeholder');
        placeholder.setAttribute("state-foreach", jsonPath);
        stateForeach.bindings.set(placeholder, { outerHtml: node.outerHTML });
        listItemScopeTemplates.push({ element: node, scopeTemplate: stateForeach.scopeTemplate });
        node.replaceWith(placeholder);
        walker.currentNode = placeholder;
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        buildJSONPath(scope.children, jsonPath, stateContentFactory(node));
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        buildJSONPath(scope.children, jsonPath, stateAttrFactory(node, attr.name.replace('state-attr-', '')));
    });
    if (node.hasAttribute('state-listen')) {
        const jsonPath = node.getAttribute('state-listen');
        buildJSONPath(scope.children, jsonPath, stateListenFactory(node));
    }
    return result;
}

function visitAndApply(node, scope, rootScope, walker) {
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        result = getJSONPath(scope.children, jsonPath);
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        const stateIf = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope).children, jsonPath);

        if (!stateIf.value && node.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = document.createElement('state-if-placeholder');
            placeholder.setAttribute("state-if", jsonPath);

            stateIf.bindings.set(placeholder, stateIf.bindings.get(node));
            stateIf.bindings.delete(node);

            node.replaceWith(placeholder);
            walker.currentNode = placeholder;
            return result;

        } else if (stateIf.value && node.tagName === 'STATE-IF-PLACEHOLDER') {

            const range = document.createRange();
            const fragment = range.createContextualFragment(stateIf.bindings.get(node).outerHtml);
            const content = fragment.firstElementChild;

            stateIf.bindings.set(content, stateIf.bindings.get(node));
            stateIf.bindings.delete(node);

            node.replaceWith(content);
            walker.currentNode = content;
            node = content;
        }
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        const stateIf = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope).children, jsonPath);

        if (stateIf.value && node.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = document.createElement('state-if-placeholder');
            placeholder.setAttribute("state-if-not", jsonPath);

            stateIf.bindings.set(placeholder, stateIf.bindings.get(node));
            stateIf.bindings.delete(node);

            node.replaceWith(placeholder);
            walker.currentNode = placeholder;
            return result;

        } else if (!stateIf.value && node.tagName === 'STATE-IF-PLACEHOLDER') {

            const range = document.createRange();
            const fragment = range.createContextualFragment(stateIf.bindings.get(node).outerHtml);
            const content = fragment.firstElementChild;

            stateIf.bindings.set(content, stateIf.bindings.get(node));
            stateIf.bindings.delete(node);

            node.replaceWith(content);
            walker.currentNode = content;
            node = content;
        }
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        const stateForeach = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope).children, jsonPath);
        node.replaceChildren();
        if (stateForeach.value) {
            (Array.isArray(stateForeach.value) ? stateForeach.value : [ stateForeach.value ]).forEach((item, index) => {
                const range = document.createRange();
                const fragment = range.createContextualFragment(stateForeach.bindings.get(node).outerHtml);
                const domItem = fragment.firstElementChild;
                item.element = domItem;
                domItem.removeAttribute('state-foreach');
                domItem.setAttribute('state-scope', `${jsonPath}[${index}]`);
                node.appendChild(domItem);
            });
        }
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        const stateContent = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope).children, jsonPath);
        node.textContent = stateContent.value;
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        const stateAttr = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope).children, jsonPath);
        node.setAttribute(stateAttr.attr, stateAttr.value);
    });
    return result;
}


document.state = {
    build: function(initialState) {

        this._current = stateScopeFactory(document.documentElement);
        const listItemScopeTemplates = [];
        scopeHierarchyVisitor(this._current, (n,s,w) => visitAndBuild(n,s,w,listItemScopeTemplates));

        while(listItemScopeTemplates.length) {
            const listItemAndScopeTpl = listItemScopeTemplates.pop();
            listItemAndScopeTpl.scopeTemplate.element = listItemAndScopeTpl.element;
            scopeHierarchyVisitor(listItemAndScopeTpl.scopeTemplate, (n,s,w) => visitAndBuild(n,s,w,listItemScopeTemplates));
            listItemAndScopeTpl.scopeTemplate.element = null;
        }

        this.update(initialState);
    },
    current: function() {
        return stateRawValuesVisitor(document.state._current);
    },
    apply: function() {
        scopeHierarchyVisitor(document.state._current, (n,s,w) => visitAndApply(n,s,document.state._current,w));
    },
    update: function(newState) {

        stateUpdateVisitor(document.state._current, newState);
        document.state.apply();
    }
};