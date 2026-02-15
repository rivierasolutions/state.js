import { registerBinding, placeholderFactory, bindToOpenAttr, bindToValueAttr, loadView, buildJSONPath, ignoreMutations, domVisitor, registerStateForeachScope, registerStateForeachBinding, registerStateForeachComposeTag } from "./common";

function visitAndBuild(visitContext, state, componentUpdates) {
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
            ignoreMutations(node);
            ignoreMutations(placeholder.parentElement);
            visitContext.walker.currentNode = placeholder;
        }

        if (isStateForeachItemScope) {
            registerStateForeachBinding(state, jsonPath, 'state-foreach', placeholder, scopeRootElement);
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
            registerStateForeachBinding(state, jsonPath, 'state-if', node, scopeRootElement);
        }
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        buildJSONPath(scope, jsonPath, false);
        if (!isStateForeachItemScope) {
            registerBinding(state, jsonPath.replace('@', absPath), 'state-if-not', node);
        } else {
            registerStateForeachBinding(state, jsonPath, 'state-if-not', node, scopeRootElement);
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
                ignoreMutations(node);
            }
            registerBinding(state, jsonPath.replace('@', absPath), 'state-listen', node);
        } else {
            registerStateForeachBinding(state, jsonPath, 'state-listen', node, scopeRootElement);
        }
    }
    if (state._composeTags.has(node.tagName)) {
        let passJsonPath = undefined;
        if (node.hasAttribute('state-pass')) {
            passJsonPath = node.getAttribute('state-pass');
        }
        if (!isStateForeachItemScope) {
            componentUpdates.set(node, loadView(state, node, passJsonPath?.replace('@', absPath)));
            if (passJsonPath) {
                registerBinding(state, passJsonPath.replace('@', absPath), 'state-pass', node);
            }
        } else {
            registerStateForeachComposeTag(state, node.tagName, node, scopeRootElement);
            if (passJsonPath) {
                registerStateForeachBinding(state, passJsonPath, 'state-pass', node, scopeRootElement);
            }
        }
    }
    return result;
}

function buildState(rootElement, componentUpdates) {
    domVisitor(rootElement.state, rootElement, '$', rootElement.state._composeTags, (ctx) => visitAndBuild(ctx,rootElement.state,componentUpdates));
}

export { buildState };