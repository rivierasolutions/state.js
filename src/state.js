import { buildContract, wrapContract } from "./contractBuilder";
import { mergeChanges } from './jsonMerger';
import { buildState } from "./stateBuilder";
import { applyState } from "./stateChangeHandler";

async function updateStateTree(rootElement, newState, origin) {

    const statesToUpdate = [{ root: rootElement, update: newState, componentUpdates: undefined, origin }];
    while(statesToUpdate.length) {
        const next = statesToUpdate.pop();
        if (next.componentUpdates) {
            mergeChanges(next.root.state, next.componentUpdates.map(([el,absPath,update]) => ({ jsonPath: absPath, value: el.state.current() })));
            next.root.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true, detail: { origin: next.origin } }));
        } else {
            const componentUpdates = (await applyState(next.root.state, mergeChanges(next.root.state, next.update)))
                .filter(([el,absPath,update]) => update !== undefined && el.state);
            statesToUpdate.push({ root: next.root, update: undefined, componentUpdates, origin: next.origin });
            if (componentUpdates.length) {
                statesToUpdate.push(...componentUpdates.map(([root,absPath,update]) => ({ root, update, componentUpdates: undefined, origin: `state-pass-down="${absPath}"` })));
            }
        }
    }
    const parentsToUpdate = rootElement.state._parentStateRoot ? [rootElement] : [];
    while (parentsToUpdate.length) {
        const child = parentsToUpdate.shift();
        const parent = child.state._parentStateRoot;
        if (!parent.contains(child)) {
            continue;
        }
        mergeChanges(parent.state, [{ jsonPath: child.state._parentStateAbsPath, value: child.state.current() }]);
        parent.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true, detail: { origin: `state-pass-up="${child.state._parentStateAbsPath}"` } }));
        if (parent.state?._parentStateRoot) {
            parentsToUpdate.push(parent);
        }
    }
}

(function polyfill() {
    
    async function load(rootElement) {
        rootElement.state = {
            current: function() {
                return this._current;
            },
            listener: function(nameOrDict, fn) {
                if (typeof nameOrDict !== 'string' && fn === undefined) {
                    Object.keys(nameOrDict).forEach(k => rootElement.state._listeners.set(k,  (ev) => nameOrDict[k](ev, ev.target.context)))
                } else {
                    rootElement.state._listeners.set(nameOrDict, (ev) => fn(ev, ev.target.context));
                }
            },
            update: function(newState, origin = 'controller') {
                return updateStateTree(rootElement, newState, origin);
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
        rootElement.state._element = rootElement;
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
        rootElement.state._listeners = new Map();
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
            await Promise.allSettled(componentLoads);
            const componentUpdates = await applyState(rootElement.state, undefined, componentLoads);

            mergeChanges(rootElement.state, componentUpdates.map(([el,absPath]) => ({ jsonPath: absPath, value: el.state.current() })));
            rootElement.state._initialBindings = new Map(rootElement.state._bindings);
            rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));

            return rootElement.state;
        } else {
            rootElement.dispatchEvent(new CustomEvent(`StateLoaded`))
            return rootElement.state;
        }
    }

    document.addEventListener('DOMContentLoaded', () => load(document));
})();