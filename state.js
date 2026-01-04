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

  const stack = [ { scope: rootScope, element: rootElement } ];

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    while (true) {
        const scopeAndElem = stack[stack.length-1];
        
        if (scopeAndElem.element !== currentNode && scopeAndElem.element.contains(currentNode)) {
            const newScopeAndElem = visit(currentNode, scopeAndElem.scope, walker);
            if (newScopeAndElem && newScopeAndElem.scope && newScopeAndElem.element) {
                stack.push(newScopeAndElem);
            }
            break;
        } else {
            stack.pop();
        }
    }
  }
}

function visitAndBuild(node, scope, walker, idSequence) {
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        result = { scope: buildJSONPath(scope, jsonPath, {}), element: node };
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        buildJSONPath(scope, jsonPath, false);
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        buildJSONPath(scope, jsonPath, false);
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        buildJSONPath(scope, jsonPath, []);
        
        const placeholder = document.createElement('state-foreach-placeholder');
        placeholder.setAttribute("state-foreach", jsonPath);
        placeholder.setAttribute("id", `state-auto-id-${++(idSequence.next)}`);
        const template = document.createElement('template');
        template.setAttribute('state-ignore', 'state-ignore');
        template.innerHTML = node.outerHTML;
        placeholder.appendChild(template);
        node.replaceWith(placeholder);
        walker.currentNode = placeholder;
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        buildJSONPath(scope, jsonPath, node.textContent ?? '');
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        buildJSONPath(scope, jsonPath, node.getAttribute(attr.name.replace('state-attr-', '')) ?? '');
    });
    if (node.hasAttribute('state-listen')) {
        const jsonPath = node.getAttribute('state-listen');
        if (!node.hasAttribute("id")) {
            node.setAttribute("id", `state-auto-id-${++(idSequence.next)}`)
        }
        buildJSONPath(scope, jsonPath, node.getAttribute("id"));
    }
    return result;
}

function visitAndApply(node, scope, rootScope, walker) {
    let result = undefined;
    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        result = { scope: getJSONPath(scope, jsonPath), element: node };
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        const stateIf = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);

        if (!stateIf && node.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = document.createElement('state-if-placeholder');
            placeholder.setAttribute("state-if", jsonPath);
            const template = document.createElement('template');
            template.setAttribute("state-ignore", "state-ignore");
            template.innerHTML = node.outerHTML;
            placeholder.appendChild(template);

            node.replaceWith(placeholder);
            walker.currentNode = placeholder;
            return result;

        } else if (stateIf && node.tagName === 'STATE-IF-PLACEHOLDER') {

            const range = document.createRange();
            const fragment = range.createContextualFragment(node.querySelector('template').innerHTML);
            const content = fragment.firstElementChild;

            node.replaceWith(content);
            walker.currentNode = content;
            node = content;
        }
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        const stateIf = getJSONPath((isAbsoluteJSONPath(jsonPath) ? rootScope : scope), jsonPath);

        if (stateIf && node.tagName !== 'STATE-IF-PLACEHOLDER') {

            const placeholder = document.createElement('state-if-placeholder');
            placeholder.setAttribute("state-if-not", jsonPath);
            const template = document.createElement('template');
            template.setAttribute("state-ignore", "state-ignore");
            template.innerHTML = node.outerHTML;
            placeholder.appendChild(template);

            node.replaceWith(placeholder);
            walker.currentNode = placeholder;
            return result;

        } else if (!stateIf && node.tagName === 'STATE-IF-PLACEHOLDER') {

            const range = document.createRange();
            const fragment = range.createContextualFragment(node.querySelector('template').innerHTML);
            const content = fragment.firstElementChild;

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
                const range = document.createRange();
                const fragment = range.createContextualFragment(node.querySelector("template").innerHTML);
                const domItem = fragment.firstElementChild;
                domItem.setAttribute("state-foreach-id", node.getAttribute("id"));
                domItem.removeAttribute('state-foreach');
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
        domVisitor(document.documentElement, this._current, (n,s,w) => visitAndBuild(n,s,w,this._idSequence));

        this._referenceState = structuredClone(this._current);

        this.update(initialState);
    },
    current: function() {
        return document.state._current;
    },
    apply: function() {
        domVisitor(document.documentElement, document.state._current, (n,s,w) => visitAndApply(n,s,document.state._current,w));
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