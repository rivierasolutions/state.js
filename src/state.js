import { getJSONPath } from './common';
import { buildContract, wrapContract } from "./contractBuilder";
import { mergeChanges } from './jsonMerger';
import { buildState } from "./stateBuilder";
import { applyState } from "./stateChangeHandler";

function updateState(rootElement, newState, triggeredByParent = false) {
    const state = rootElement.state;
    if (!state) {
        return Promise.reject();
    }
    const changes = mergeChanges(state, newState);
    return applyState(state, changes)
        .then(componentUpdates => Promise.allSettled(componentUpdates
            .map(res => (res.at(2) === undefined ? Promise.resolve() : updateState(res.at(0), res.at(2), true)).then(() => res))))
        .then(componentUpdates => {
            mergeChanges(state, componentUpdates
                .filter(res => res.status === 'fulfilled')
                .map(({ value: [el,absPath] }) => ({ jsonPath: absPath, value: el.state.current() })));
            rootElement.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
            if (!triggeredByParent && state._parentStateRoot) {
                childStateUpdated(state._parentStateRoot, state._parentStateAbsPath, state.current());
            }
        });
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
                updateState(rootElement, newState);
            },
            apply: function() {
                applyState();
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