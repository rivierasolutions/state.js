import { getJSONPath } from './common';
import { buildContract, wrapContract } from "./contractBuilder";
import { mergeChanges } from './jsonMerger';
import { buildState } from "./stateBuilder";
import { applyStateChange } from "./stateChangeHandler";

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

                const changes = mergeChanges(this, newState);
                this.apply(changes);

                rootElement.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true }));
            },
            apply: function(changes) {
                if (!changes && !Array.isArray(changes)) {
                    this._bindings.keys().forEach(path => {
                        const elementMap = this._bindings.get(path);
                        elementMap.keys().forEach(element => applyStateChange(this, elementMap, path, element, undefined, undefined));
                    });
                    return;
                }
                changes.forEach(({ path, src, dst }) => {
                    if (this._bindings.has(path)) {
                        const elementMap = this._bindings.get(path);
                        elementMap.keys().forEach(element => applyStateChange(this, elementMap, path, element, src, dst));
                    }
                });
            },
            create(element) {
                return load(element);
            },
            contract(namespace = 'Generated', className = 'ViewState') {
                return buildContract(this, namespace, className);
            }
        };

        rootElement.state._current = {};
        rootElement.state._idSequence = { next: 0 };
        rootElement.state._bindings = new Map();
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
            buildState(rootElement);
            rootElement.state.apply();

            rootElement.state._initialBindings = new Map(rootElement.state._bindings);
        }
        rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));
        return rootElement.state;
    }

    document.addEventListener('DOMContentLoaded', () => load(document));
})();