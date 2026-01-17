import { loadView, bindToValueAttr, bindToOpenAttr, getJSONPath, unregisterBinding, registerBinding, placeholderFactory } from "./common";

function bindToStateListenAttr(element, previousStateValue, stateValue) {
    Object.keys(previousStateValue ?? {}).forEach(k => {
        element.removeEventListener(k, previousStateValue[k]);
    });
    Object.keys(stateValue ?? {}).forEach(k => {
        element.addEventListener(k, stateValue[k]);
    });
}

function bindFoeachListItemState(state, stateForeachItemRoot, absPath, DOMPath, stateType) {
    const element = DOMPath.reduce((el,child) => el.children[child], stateForeachItemRoot)
    if (stateType.startsWith('state-attr-')) {
        const attrName = stateType.replace('state-attr-', '');
        if (attrName === 'value') {
            bindToValueAttr(element, absPath, state);
        } else if (attrName === 'open') {
            bindToOpenAttr(element, absPath, state);
        }
    }
    else if (stateType === 'state-listen' && !element.hasAttribute("id")) {
        element.setAttribute("id", `state-auto-id-${++(state._idSequence.next)}`);
    }
}

function loadForeachListItemView(state, stateForeachItemRoot, DOMPath, tagName) {
    const element = DOMPath.reduce((el,child) => el.children[child], stateForeachItemRoot)
    loadView(state, element, state._composeTags.get(tagName));
}

function removeStateForeachItem(state, absPath, statForeachElement, existingItemsQuery, index) {
    const stateTemplate = state._stateForeachItemBindings.get(statForeachElement.getAttribute("id"));
    function remove(el, index) {
        Array.from(stateTemplate.keys()).map(path => path.replace('@', `${absPath}[${index}]`)).forEach(path => unregisterBinding(state, path, el));
        el.remove();
    }
    if (index === undefined) {
        existingItemsQuery.forEach(remove);
    } else {
        let el = Array.from(existingItemsQuery).at(index);
        if (el) {
            remove(el, index);
        }
    }
}

function foreachStateItemFactory(state, absPath, statForeachElement, index) {
    const domItem = statForeachElement.firstElementChild.cloneNode(true);
    const stateForeachId = statForeachElement.getAttribute("id");
    domItem.setAttribute("state-foreach-id", stateForeachId);
    domItem.setAttribute('state-scope', `${absPath}[${index}]`);

    const stateTemplate = state._stateForeachItemBindings.get(stateForeachId);
    if (stateTemplate) {
        Array.from(stateTemplate.keys()).forEach(itemPath => {
            const tempaltePathMap = stateTemplate.get(itemPath);
            Array.from(tempaltePathMap.keys()).forEach(DOMPath => {
                registerBinding(state, itemPath.replace('@', `${absPath}[${index}]`), tempaltePathMap.get(DOMPath), { DOMPath: DOMPath, stateForeachItemRoot: domItem });
                bindFoeachListItemState(state, domItem, itemPath.replace('@', `${absPath}[${index}]`), DOMPath, tempaltePathMap.get(DOMPath));
            });
        });
    }
    const composeTags = state._stateForeachComposeTags.get(stateForeachId);
    if (composeTags) {
        Array.from(composeTags.keys()).forEach(composeTag => {
            const templatePathMap = composeTags.get(composeTag);
            Array.from(templatePathMap.keys()).forEach(DOMPath => {
                loadForeachListItemView(state, domItem, DOMPath, composeTag);
            });
        });
    }

    return domItem;
}

function applyStateChange(state, elementMap, absPath, elementOrPath, src, dst) {
    const stateType = elementMap.get(elementOrPath);
    const stateValue = getJSONPath(state._current, absPath);
    const element = elementOrPath instanceof HTMLElement
        ? elementOrPath
        : elementOrPath.DOMPath.reduce((el,child) => el.children[child], elementOrPath.stateForeachItemRoot);

    if (stateType === 'state-content') {    
        element.textContent = stateValue;
    }
    else if (stateType.startsWith('state-attr-')) {
        const attrName = stateType.replace('state-attr-', '');
        if (attrName === 'value') {
            element.value = stateValue;
        } else if (attrName === 'open') {
            element.open = !!stateValue;
        } else if (attrName.endsWith('-if')) {
            if (stateValue) {
                element.setAttribute(attrName.slice(0,-3), '');
            } else {
                element.removeAttribute(attrName.slice(0,-3));
            }
        } else if (attrName.endsWith('-if-not')) {
            if (stateValue) {
                element.removeAttribute(attrName.slice(0,-7));
            } else {
                element.setAttribute(attrName.slice(0,-7), '');
            }
        } else {
            element.setAttribute(attrName, stateValue);
        }
    }
    else if (stateType.startsWith('state-bool-attr-')) {
        const attrName = stateType.replace('state-bool-attr-', '');
        
    }
    else if (stateType === 'state-if') {
        if (!stateValue && !element.hasAttribute('state-placeholder')) {

            const placeholder = placeholderFactory({ 'state-if': element.getAttribute('state-if') });
            element.replaceWith(placeholder);
            placeholder.appendChild(element);
            elementMap.delete(element);
            elementMap.set(placeholder, 'state-if');

        } else if (stateValue && element.tagName === 'TEMPLATE' && element.hasAttribute('state-placeholder')) {

            const content = element.firstElementChild;
            element.replaceWith(content);
            elementMap.delete(element);
            elementMap.set(content, 'state-if');
        }
    }
    else if (stateType === 'state-if-not') {
        if (stateValue && !element.hasAttribute('state-placeholder')) {

            const placeholder = placeholderFactory({ 'state-if-not': element.getAttribute('state-if-not') });
            element.replaceWith(placeholder);
            placeholder.appendChild(element);
            elementMap.delete(element);
            elementMap.set(placeholder, 'state-if-not');

        } else if (!stateValue && element.tagName === 'TEMPLATE' && element.hasAttribute('state-placeholder')) {

            const content = element.firstElementChild;
            element.replaceWith(content);
            elementMap.delete(element);
            elementMap.set(content, 'state-if-not');
        }
    }
    else if (stateType === 'state-foreach') {
        const forEachId = element.getAttribute("id");
        const existingItemsQuery = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
        if (src === undefined && dst === undefined) {
            removeStateForeachItem(state, absPath, element, existingItemsQuery);
            if (stateValue) {
                (Array.isArray(stateValue) ? stateValue : [ stateValue ])
                    .map((item, index) => foreachStateItemFactory(state, absPath, element, index))
                    .reverse()
                    .forEach(el => element.after(el));
            }
        } else {
            if (src.length > stateValue.length) {
                Array.from(existingItemsQuery).slice(-1*(src.length - stateValue.length)).forEach((el, index) => {
                    removeStateForeachItem(state, absPath, element, existingItemsQuery, src.length-1-index);
                });
            } else if (src.length < stateValue.length) {
                for (let i=0; i<stateValue.length - src.length; ++i) {
                    const el = foreachStateItemFactory(state, absPath, element, src.length+i);
                    const query = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
                    (query.length ? Array.from(query).at(-1) : element).after(el);
                }
            }
        }
    }
    else if (stateType === 'state-listen') {
        bindToStateListenAttr(element, src, dst ?? stateValue);
    }
}

export { applyStateChange };