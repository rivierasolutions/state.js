import { getJSONPath } from './common';
import { buildContract, wrapContract } from "./contractBuilder";
import { mergeChanges } from './jsonMerger';
import { buildState } from "./stateBuilder";
import { applyStateChange } from "./stateChangeHandler";

function applyState(state, changes, componentLoads) {
    const componentUpdates = new Map(componentLoads);
    if (!changes && !Array.isArray(changes)) {
        Array.from(state._bindings.entries())
            .flatMap(([path, elementMap]) => 
                Array.from(elementMap.entries())
                    .flatMap(([element, types]) => types.map(stateType => [path,element,stateType])))
            .forEach(([path,element,stateType]) => applyStateChange(state, path, element, stateType, undefined, undefined, componentUpdates));
    } else {
        changes.forEach(({ path, src, dst }) => {
            if (state._bindings.has(path)) {
                Array.from(state._bindings.get(path).entries())
                    .flatMap(([element,types]) => types.map(stateType => [path,element,stateType]))
                    .forEach(([path,element,stateType]) => applyStateChange(state, path, element, stateType, src, dst, componentUpdates));
            }
        });
    }
    return Promise.allSettled(componentUpdates.values())
        .then(all => all.filter(res => res.status === 'fulfilled' && res.value.at(1) !== 'loaded').map(res => res.value));
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
                const state = this;
                const changes = mergeChanges(state, newState);
                return applyState(state, changes)
                    .then(componentUpdates => {
                        mergeChanges(state, componentUpdates.map(([el,absPath]) => ({ jsonPath: absPath, value: el.state.current() })));
                        rootElement.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
                    });
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
        rootElement.state._idSequence = { next: 0 };
        rootElement.state._bindings = new Map();
        rootElement.state._initialBindings = new Map();
        rootElement.state._composeTags = new Map();
        rootElement.state._stateForeachItemBindings = new Map();
        rootElement.state._stateForeachComposeTags = new Map();
        rootElement.state._stateForeachScopes = new Map();
        rootElement.state._depth = 0;
        if (rootElement === document) {
            rootElement.state._maxDepth = 1;
        }

        rootElement.querySelectorAll("state-compose").forEach(compose => {
            const tag = compose.getAttribute('tag');
            const src = compose.getAttribute('src');
            if (tag && src) {
                rootElement.state._composeTags.set(tag.toUpperCase(), src);
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