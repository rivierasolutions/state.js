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

function isAbsoluteJSONPath(path) {
    return path.split('.')[0] === '$';
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

  const stack = [ { scope: rootScope, element: rootElement, absPath: '$' } ];

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    while (true) {
        const scopeTuple = stack[stack.length-1];
        
        if (scopeTuple.element !== currentNode && scopeTuple.element.contains(currentNode)) {
            const newScopeAndElem = visit(currentNode, scopeTuple.scope, scopeTuple.absPath, walker);
            if (newScopeAndElem && newScopeAndElem.scope && newScopeAndElem.element && newScopeAndElem.absPath) {
                stack.push(newScopeAndElem);
            }
            break;
        } else {
            stack.pop();
        }
    }
  }
}

function placeholderFactory(tag, attrs, ignore = true) {
    const placeholder = document.createElement(tag);
    const template = document.createElement('template');
    if (ignore) {
        template.setAttribute("state-ignore", "state-ignore");
    }
    placeholder.appendChild(template);
    Object.keys(attrs).forEach(k => {
        placeholder.setAttribute(k, attrs[k]);
    });
    return placeholder;
}

function register(registry, absPath, type, element) {
    if (!registry.has(absPath)) {
        registry.set(absPath, []);
    }
    registry.get(absPath).push({ stateType: type, element });
}

function visitAndBuild(node, scope, absPath, walker, idSequence, registry, foreachItemTemplates) {
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        result = { scope: /.*\[\]$/g.test(jsonPath) ? {} : buildJSONPath(scope, jsonPath, {}), element: node, absPath: jsonPath.replace('@', absPath) };
        scope = result.scope;
        absPath = result.absPath;
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        buildJSONPath(scope, jsonPath, []);
        
        const placeholder = placeholderFactory('state-foreach-placeholder', { "state-foreach": jsonPath, id: `state-auto-id-${++(idSequence.next)}` }, false);
        node.removeAttribute('state-foreach');
        node.setAttribute('state-scope', `${jsonPath}[]`);
        node.replaceWith(placeholder);
        placeholder.querySelector('template').appendChild(node);
        walker.currentNode = placeholder;
        foreachItemTemplates.push(placeholder.querySelector('template'));

        register(registry, jsonPath.replace('@', absPath), 'state-foreach', placeholder);
        return result;
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        buildJSONPath(scope, jsonPath, false);
        register(registry, jsonPath.replace('@', absPath), 'state-if', node);
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        buildJSONPath(scope, jsonPath, false);
        register(registry, jsonPath.replace('@', absPath), 'state-if-not', node);
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        buildJSONPath(scope, jsonPath, node.textContent ?? '');
        register(registry, jsonPath.replace('@', absPath), 'state-content', node);
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        buildJSONPath(scope, jsonPath, node.getAttribute(attr.name.replace('state-attr-', '')) ?? '');
        register(registry, jsonPath.replace('@', absPath), attr, node);
    });
    if (node.hasAttribute('state-listen')) {
        const jsonPath = node.getAttribute('state-listen');
        if (!node.hasAttribute("id")) {
            node.setAttribute("id", `state-auto-id-${++(idSequence.next)}`)
        }
        buildJSONPath(scope, jsonPath, node.getAttribute("id"));
        register(registry, jsonPath.replace('@', absPath), 'state-listen', node);
    }
    return result;
}

function visitAndApply(node, scope, absPath, walker, rootScope) {
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        result = { scope: getJSONPath(scope, jsonPath), element: node, absPath: jsonPath.replace('@', absPath) };
        scope = result.scope;
        absPath = result.absPath;
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        const stateIf = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);

        if (!stateIf && node.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = placeholderFactory('state-if-placeholder', { "state-if": jsonPath });
            node.replaceWith(placeholder);
            placeholder.querySelector('template').appendChild(node);
            walker.currentNode = placeholder;
            return result;

        } else if (stateIf && node.tagName === 'STATE-IF-PLACEHOLDER') {

            const content = node.querySelector('template').firstElementChild;

            node.replaceWith(content);
            walker.currentNode = content;
            node = content;
        }
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        const stateIf = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);

        if (stateIf && node.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = placeholderFactory('state-if-placeholder', { "state-if-not": jsonPath });
            node.replaceWith(placeholder);
            placeholder.querySelector('template').appendChild(node);
            walker.currentNode = placeholder;
            return result;

        } else if (!stateIf && node.tagName === 'STATE-IF-PLACEHOLDER') {

            const content = node.querySelector('template').firstElementChild;

            node.replaceWith(content);
            walker.currentNode = content;
            node = content;
        }
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        const stateForeach = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);
        node.parentNode.querySelectorAll(`[state-foreach-id="${node.getAttribute("id")}"]`).forEach(el => el.remove());
        if (stateForeach) {
            (Array.isArray(stateForeach) ? stateForeach : [ stateForeach ]).map((item, index) => {
                item.$index = index;
                const domItem = node.querySelector("template").firstElementChild.cloneNode(true);
                domItem.setAttribute("state-foreach-id", node.getAttribute("id"));
                domItem.setAttribute('state-scope', `${jsonPath}[${index}]`);
                return domItem;
            }).reverse().forEach(i => node.after(i));
        }
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        const stateContent = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);
        node.textContent = stateContent;
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        const stateAttr = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);
        node.setAttribute(attr.name.replace('state-attr-', ''), stateAttr);
    });
    return result;
}

document.state = {
    build: function(initialState) {

        this._current = {};
        this._idSequence = { next: 0 };
        const foreachItemTemplates = [];
        this._registry = new Map();
        domVisitor(document.documentElement, this._current, (n,s,p,w) => visitAndBuild(n,s,p,w,this._idSequence,this._registry,foreachItemTemplates));
        foreachItemTemplates.forEach(el => {
            el.setAttribute('state-ignore', 'state-ignore');
        });

        this._referenceState = structuredClone(this._current);

        this.update(initialState);
    },
    current: function() {
        return document.state._current;
    },
    apply: function() {
        domVisitor(document.documentElement, document.state._current, (n,s,p,w) => visitAndApply(n,s,p,w,document.state._current));
    },
    update: function(newState) {

        if (newState && newState instanceof Object) {
            const toMerge = [ { src: document.state._current, dst: newState } ];
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