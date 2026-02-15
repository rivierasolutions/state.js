import { domVisitor, getJSONPath, unregisterStateForeachScope, unregisterBinding, unregisterStateForeachBinding, unregisterStateForeachComposeTag } from "./common";

function lastInSubtree(element) {
    let result = element;
    while (result.lastElementChild) {
        result = result.lastElementChild;
    }
    return result;
}

function scopeOf(element) {
    const closest = element.closest('[state-root], [state-scope]');
    return (!closest || closest.hasAttribute('state-root')) ? '$' : closest.getAttribute('state-scope');
}

function visitAndDestroy(visitContext, state) {
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
            scope: isStateForeachItemScope ? scope : getJSONPath(state._current, jsonPath.replace('@', absPath), {}),
            scopeRootElement: node,
            absJsonPath: jsonPath.replace('@', absPath),
            isStateForeachItemScope
        };
        scope = result.scope;
        scopeRootElement = result.scopeRootElement;
        absPath = result.absPath;
    }
    if (node.hasAttribute('state-foreach')) {
        const jsonPath = node.getAttribute('state-foreach');
        unregisterStateForeachScope(state, node.getAttribute('state-foreach').replace('@', absPath));
        if (isStateForeachItemScope) {
            unregisterStateForeachBinding(state, jsonPath, 'state-foreach', node, scopeRootElement);
        } else {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, 'state-foreach');
        }
    }
    if (node.hasAttribute('state-if')) {
        const jsonPath = node.getAttribute('state-if');
        if (!isStateForeachItemScope) {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, 'state-if');
        } else {
            unregisterStateForeachBinding(state, jsonPath, 'state-if', node, scopeRootElement);
        }
    }
    if (node.hasAttribute('state-if-not')) {
        const jsonPath = node.getAttribute('state-if-not');
        if (!isStateForeachItemScope) {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, 'state-if-not');
        } else {
            unregisterStateForeachBinding(state, jsonPath, 'state-if-not', node, scopeRootElement);
        }
    }
    if (node.hasAttribute('state-content')) {
        const jsonPath = node.getAttribute('state-content');
        if (!isStateForeachItemScope) {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, 'state-content');
        } else {
            unregisterStateForeachBinding(state, jsonPath, 'state-content', node, scopeRootElement)
        }
    }
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-attr-')).forEach(attr => {
        const jsonPath = attr.value;
        if (!isStateForeachItemScope) {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, attr.name);
        } else {
            unregisterStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement);
        }
    });
    Array.from(node.attributes).filter(attr => attr.name.startsWith('state-class-')).forEach(attr => {
        const jsonPath = attr.value;
        if (!isStateForeachItemScope) {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, attr.name);
        } else {
            registerStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement);
        }
    });
    if (node.hasAttribute('state-listen')) {
        const jsonPath = node.getAttribute('state-listen');
        if (!isStateForeachItemScope) {
            unregisterBinding(state, jsonPath.replace('@', absPath), node, 'state-listen');
        } else {
            unregisterStateForeachBinding(state, jsonPath, 'state-listen', node, scopeRootElement);
        }
    }
    if (state._composeTags.has(node.tagName)) {
        node.state?.destroy();
        let passJsonPath = undefined;
        if (node.hasAttribute('state-pass')) {
            passJsonPath = node.getAttribute('state-pass');
        }
        if (!isStateForeachItemScope) {
            if (passJsonPath) {
                unregisterBinding(state, passJsonPath.replace('@', absPath), node, 'state-pass');
            }
        } else {
            unregisterStateForeachComposeTag(state, node.tagName, node, scopeRootElement);
            if (passJsonPath) {
                unregisterStateForeachBinding(state, passJsonPath, 'state-pass', node, scopeRootElement);
            }
        }
        visitContext.walker.currentNode = lastInSubtree(node);
    }
    if (node.hasAttribute('state-root') && !state._composeTags.has(node.tagName)) {
        node.state?.destroy();
        visitContext.walker.currentNode = lastInSubtree(node);
    }
    return result;
}

function elementRemoved(state, element, mutation) {
    domVisitor(state, element, scopeOf(element), state._composeTags, (ctx) => visitAndDestroy(ctx,state));
}

function elementAdded(state, element, mutation) {

}

function processMutation(state, mutation) {
    const element = mutation.target;
    console.log(`processing mutation for: ${element.tagName}, type: ${mutation.type}`);
    if (mutation.type === 'childList') {
        mutation.removedNodes.forEach(el => elementRemoved(state, el, mutation));
        mutation.addedNodes.forEach(el => elementAdded(state, el, mutation));
    }
}

export function processMutations(state, mutations) {
    const elementsToUnignore = new Set();
    mutations.forEach(m => {
        const element = m.target.nodeType === Node.ELEMENT_NODE  ? m.target : m.target.parentElement;
        if (!element) {
            return;
        }
        if (m.type === 'attributes' && m.attributeName === 'state-mutation-ignore' && !m.target.hasAttribute('state-mutation-ignore')) {
            return;
        }
        if (state.of(element) !== state._element) {
            return;
        }
        if (element.hasAttribute('state-mutation-ignore')) {
            elementsToUnignore.add(element);
            return;
        }
        processMutation(state, m);
    });
    elementsToUnignore.forEach(el => el.removeAttribute('state-mutation-ignore'));
}