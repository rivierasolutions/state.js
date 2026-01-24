import { getJSONPath } from './common';
import { buildContract, wrapContract } from "./contractBuilder";
import { mergeChanges } from './jsonMerger';
import { buildState } from "./stateBuilder";
import { applyState } from "./stateChangeHandler";

async function updateStateTree(rootElement, newState) {

    const statesToUpdate = [{ root: rootElement, update: newState, componentUpdates: undefined }];
    while(statesToUpdate.length) {
        const next = statesToUpdate.pop();
        if (next.componentUpdates) {
            mergeChanges(next.root.state, componentUpdates.map(([el,absPath,update]) => ({ jsonPath: absPath, value: el.state.current() })));
            next.root.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
        } else {
            const componentUpdates = (await applyState(next.root.state, mergeChanges(next.root.state, next.update)))
                .filter(([el,absPath,update]) => update !== undefined && el.state);
            if (componentUpdates.length) {
                statesToUpdate.push({ root: next.root, update: undefined, componentUpdates });
                statesToUpdate.push(...componentUpdates.map(([root,absPath,update]) => ({ root, update, componentUpdates: undefined })));
            }
        }
    }
    if (rootElement.state._parentStateRoot) {
        childStateUpdated(rootElement.state._parentStateRoot, rootElement.state._parentStateAbsPath, rootElement.state.current());
    }
}

function childStateUpdated(rootElement, jsonPath, value) {
    mergeChanges(rootElement.state, [{ jsonPath, value }]);
    rootElement.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
}

(function polyfill() {
    
    function load(rootElement) {
        rootElement.state = {
            current: function() {
                return this._current;
            },
            scopeOf(element) {
                if (!rootElement.contains(element)) {
                    return undefined;
                }
                while (element != rootElement) {
                    if (element.hasAttribute("state-scope")) {
                        return getJSONPath(this._current, element.getAttribute("state-scope"));
                    }
                    element = element.parentElement;
                }
                return this._current;
            },
            update: function(newState) {
                return updateStateTree(rootElement, newState);
            },
            apply: function() {
                applyState(this);
            },
            create(element) {
                return load(element);
            },
            contract(namespace = 'Generated', className = 'ViewState', wrap = true) {
                return wrap ? wrapContract(buildContract(this, className), namespace, className) : buildContract(this, className);
            }
        };

        rootElement.state._current = {};
        rootElement.state._parentStateRoot = undefined;
        rootElement.state._parentStateAbsPath = undefined;
        rootElement.state._idSequence = { next: 0 };
        rootElement.state._bindings = new Map();
        rootElement.state._initialBindings = new Map();
        rootElement.state._composeTags = rootElement === document ? new Map() : document.state._composeTags;
        rootElement.state._stateForeachItemBindings = new Map();
        rootElement.state._stateForeachComposeTags = new Map();
        rootElement.state._stateForeachScopes = new Map();
        rootElement.state._depth = 0;
        if (rootElement === document) {
            rootElement.state._maxDepth = 20;
        }

        rootElement.querySelectorAll("state-compose").forEach(compose => {
            const tag = compose.getAttribute('tag');
            const src = compose.getAttribute('src');
            if (tag && src) {
                const local = document.getElementById(src);
                const promise = (local && local.tagName === 'TEMPLATE'
                    ? Promise.resolve(local.innerHTML)
                    : fetch(src).then(res => res.ok ? res.text() : Promise.reject()));
                rootElement.state._composeTags.set(tag.toUpperCase(), promise);
            }
        });
        if (!(rootElement == document && rootElement.documentElement.hasAttribute('state-ignore'))) {
            const componentLoads = new Map();
            buildState(rootElement, componentLoads);
            return Promise.allSettled(componentLoads)
                .then(() => applyState(rootElement.state, undefined, componentLoads))
                .then(componentUpdates => {
                    mergeChanges(rootElement.state, componentUpdates.map(([el,absPath]) => ({ jsonPath: absPath, value: el.state.current() })));
                    rootElement.state._initialBindings = new Map(rootElement.state._bindings);
                    rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));            
                })
                .then(rootElement.state);
        } else {
            rootElement.dispatchEvent(new CustomEvent(`StateLoaded`))
            return Promise.resolve(rootElement.state);
        }
    }

    document.addEventListener('DOMContentLoaded', () => load(document));
})();