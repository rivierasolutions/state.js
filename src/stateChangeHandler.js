import { loadView, bindToValueAttr, bindToOpenAttr, setValueOrOpenAttr, getJSONPath, unregisterBinding, registerBinding, placeholderFactory } from "./common";

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
    else if (stateType === 'state-pass') {
        const statePass = getJSONPath(state._current, absPath);
        if (statePass) {
            element.addEventListener('StateLoaded', () => element.state.update(statePass), { once: true });
        }
    }
}

function loadForeachListItemView(state, stateForeachItemRoot, absPath, DOMPath, tagName, componentUpdates) {
    const element = DOMPath.reduce((el,child) => el.children[child], stateForeachItemRoot);
    let passJsonPath = element.getAttribute('state-pass')?.replace('@', absPath);
    componentUpdates.set(element, loadView(state, element, state._composeTags.get(tagName), passJsonPath));
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

function foreachStateItemFactory(state, absPath, statForeachElement, index, componentUpdates) {
    const domItem = statForeachElement.firstElementChild.cloneNode(true);
    const stateForeachId = statForeachElement.getAttribute("id");
    domItem.setAttribute("state-foreach-id", stateForeachId);
    domItem.setAttribute('state-scope', `${absPath}[${index}]`);

    const composeTags = state._stateForeachComposeTags.get(stateForeachId);
    if (composeTags) {
        Array.from(composeTags.entries())
            .flatMap(([composeTag,templatePathMap]) => Array.from(Array.from(templatePathMap.keys())).map(DOMPath => [composeTag,DOMPath]))
            .forEach(([composeTag,DOMPath]) => loadForeachListItemView(state, domItem, `${absPath}[${index}]`, DOMPath, composeTag, componentUpdates));
    }
    const stateTemplate = state._stateForeachItemBindings.get(stateForeachId);
    if (stateTemplate) {
        Array.from(stateTemplate.entries())
            .flatMap(([itemPath, templatePathMap]) => 
                Array.from(templatePathMap.entries())
                    .flatMap(([DOMPath, types]) => types.map(stateType => [itemPath,DOMPath,stateType]))
            )
            .forEach(([itemPath,DOMPath,stateType]) => {
                registerBinding(state, itemPath.replace('@', `${absPath}[${index}]`), stateType, { DOMPath: DOMPath, stateForeachItemRoot: domItem });
                bindFoeachListItemState(state, domItem, itemPath.replace('@', `${absPath}[${index}]`), DOMPath, stateType);
            });
    }

    return domItem;
}

function applyStateChange(state, absPath, elementOrPath, stateType, src, dst, componentUpdates) {
    const stateValue = getJSONPath(state._current, absPath);
    const element = elementOrPath instanceof HTMLElement
        ? elementOrPath
        : elementOrPath.DOMPath.reduce((el,child) => el.children[child], elementOrPath.stateForeachItemRoot);

    if (stateType === 'state-content') {    
        element.textContent = stateValue;
    }
    else if (stateType.startsWith('state-attr-')) {
        let attrName = stateType.replace('state-attr-', '');
        let bool = false;
        let boolNegated = false;
        if (attrName.endsWith('-if')) {
            bool = true;
            attrName = attrName.slice(0,-3);
        } else if (attrName.endsWith('-if-not')) {
            boolNegated = true;
            attrName = attrName.slice(0,-7);
        }
        if (bool) {
            if (stateValue) {
                element.setAttribute(attrName, '');
            } else {
                element.removeAttribute(attrName);
            }
        } else if (boolNegated) {
            if (stateValue) {
                element.removeAttribute(attrName);
            } else {
                element.setAttribute(attrName, '');
            }
        } else {
            element.setAttribute(attrName, stateValue);
        }
        setValueOrOpenAttr(element, attrName, boolNegated ? !stateValue : stateValue);
    }
    else if (stateType.startsWith('state-class-')) {
        const className = stateType.replace('state-class-', '');
        if (className.endsWith('-if-not')) {
            if (stateValue) {
                element.classList.remove(className.slice(0, -7));
            } else {
                element.classList.add(className.slice(0, -7));
            }
        } else {
            if (stateValue) {
                element.classList.add(className.endsWith('-if') ? className.slice(0, -3) : className);
            } else {
                element.classList.remove(className.endsWith('-if') ? className.slice(0, -3) : className);
            }
        }
    }
    else if (stateType === 'state-if') {
        if (!stateValue && !element.hasAttribute('state-placeholder')) {

            const placeholder = placeholderFactory({ 'state-if': element.getAttribute('state-if') });
            element.replaceWith(placeholder);
            placeholder.appendChild(element);
            registerBinding(state,absPath,'state-if',placeholder);
            unregisterBinding(state,absPath,element,'state-if');

        } else if (stateValue && element.tagName === 'TEMPLATE' && element.hasAttribute('state-placeholder')) {

            const content = element.firstElementChild;
            element.replaceWith(content);
            registerBinding(state,absPath,'state-if',content);
            unregisterBinding(state,absPath,element,'state-if');
        }
    }
    else if (stateType === 'state-if-not') {
        if (stateValue && !element.hasAttribute('state-placeholder')) {

            const placeholder = placeholderFactory({ 'state-if-not': element.getAttribute('state-if-not') });
            element.replaceWith(placeholder);
            placeholder.appendChild(element);
            registerBinding(state,absPath,'state-if-not',placeholder);
            unregisterBinding(state,absPath,element,'state-if-not');

        } else if (!stateValue && element.tagName === 'TEMPLATE' && element.hasAttribute('state-placeholder')) {

            const content = element.firstElementChild;
            element.replaceWith(content);
            registerBinding(state,absPath,'state-if-not',content);
            unregisterBinding(state,absPath,element,'state-if-not');
        }
    }
    else if (stateType === 'state-foreach') {
        const forEachId = element.getAttribute("id");
        const existingItemsQuery = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
        if (src === undefined && dst === undefined) {
            removeStateForeachItem(state, absPath, element, existingItemsQuery);
            if (stateValue) {
                (Array.isArray(stateValue) ? stateValue : [ stateValue ])
                    .map((item, index) => foreachStateItemFactory(state, absPath, element, index, componentUpdates))
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
                    const el = foreachStateItemFactory(state, absPath, element, src.length+i, componentUpdates);
                    const query = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
                    (query.length ? Array.from(query).at(-1) : element).after(el);
                }
            }
        }
    }
    else if (stateType === 'state-listen') {
        bindToStateListenAttr(element, src, dst ?? stateValue);
    }
    else if (stateType === 'state-pass' && stateValue) {
        componentUpdates.set(element, (componentUpdates.get(element) ?? Promise.resolve()).then(() => [element,absPath,stateValue]));
    }
}

export { applyStateChange };