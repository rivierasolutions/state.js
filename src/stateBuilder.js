import { registerBinding, placeholderFactory, bindToOpenAttr, bindToValueAttr, loadView, buildJSONPath } from "./common";

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
                || Array.from(node.attributes).find(a => a.name.startsWith('state-attr-') || a.name.startsWith('state-class-'))
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

function registerStateForeachBinding(state, relPath, stateType, element, statForeachRootScope) {
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
    if (!itemBindings.get(relPath).has(path)) {
        itemBindings.get(relPath).set(path, []);
    }
    itemBindings.get(relPath).get(path).push(stateType);
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

function visitAndBuild(visitContext, state) {
    const node = visitContext.element;
    let scope = visitContext.scope;
    let scopeRootElement = visitContext.scopeRootElement;
    let absPath = visitContext.absJsonPath;
    let isStateForeachItemScope = visitContext.isStateForeachItemScope;
    let result = undefined;

    if (node.hasAttribute('state-scope')) {
        const jsonPath = node.getAttribute('state-scope');
        isStateForeachItemScope = node.parentElement?.tagName === 'TEMPLATE'
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
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        buildJSONPath(scope, jsonPath, [], true);

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
        let initialValue = node.getAttribute(attrName) ?? '';
        if (attrName.endsWith('-if')) {
            initialValue = node.hasAttribute(attrName.slice(0, -3));
        } else if (attrName.endsWith('-if-not')) {
            initialValue = !node.hasAttribute(attrName.slice(0, -7));
        }
        buildJSONPath(scope, jsonPath, initialValue);
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
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-class-')).forEach(attr => {
        const jsonPath = attr.value;
        let className = attr.name.replace('state-class-', '');
        if (className.endsWith('-if-not')) {
            className = className.slice(0, -7);
        } else if (className.endsWith('-if')) {
            className = className.slice(0, -3);
        }
        buildJSONPath(scope, jsonPath, node.classList.contains(className));
        if (!isStateForeachItemScope) {
            registerBinding(state, jsonPath.replace('@', absPath), attr.name, node);
        } else {
            registerStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement)
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

function buildState(rootElement) {
    domVisitor(rootElement, rootElement.state._current, rootElement.state._composeTags, (ctx) => visitAndBuild(ctx,rootElement.state));
}

export { buildState };