import { buildJSONPath } from "./common";

const stateDTs = 
`declare namespace StateJs {

    type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
    };

    export interface StateInstance<T> {
        current(): Readonly<T>;
        update(patch: DeepPartial<T>): void;
        scopeOf(el: HTMLElement): any;
        subState<S>(el: HTMLElement): StateInstance<S>;
    }
}`;

function serializeContractIface(ifaceName, ifaceRoot, allIfaces, ifaceNameSeq) {
    let contractStr = `export interface ${ifaceName} { `;
    const serializeStack = Object.keys(ifaceRoot).map(k => ({ name: k, value: ifaceRoot[k] }));
    while (serializeStack.length) {
        const next = serializeStack.pop();
        if (next.commit) {
            contractStr += next.commit;
            continue;
        }
        const props = Object.keys(next.value).filter(p => p !== '$attr' && p !== '$arrayContract');
        if (props.length) {
            contractStr += `${next.name}: { `;
            serializeStack.push({ commit: '}; ' });
            props.forEach(p => serializeStack.push({ name: p, value: ifaceRoot[p] }));
        } else if (next.value.$attr?.find(a => a === 'state-listen')) {
            contractStr += `${next.name}: { [eventName: string]: (event: Event) => void; }; `;
        } else if (next.value.$arrayContract) {
            const acName = `StateForeachContract${++(ifaceNameSeq.next)}`;
            allIfaces.push({ name: acName, root: next.value.$arrayContract });
            contractStr += `${next.name}: Array<${acName}>; `;
        } else if (next.value.$attr.length) {
            contractStr += `${next.name}: any; `;
        }
    }
    contractStr += '} ';
    return contractStr;
}

function buildContract(state) {
    const contractRoot = {};
    const foreachItemQueue = [];
    state._bindings.keys().forEach(b => {
        const def = buildJSONPath(contractRoot, b);
        def.$attr = [ ...(def.$attr ?? []), ...state._bindings.get(b).values().filter(a => a !== 'state-foreach') ];
        state._bindings.get(b).keys()
            .filter(a => state._bindings.get(b).get(a) === 'state-foreach')
            .forEach(el => {
                const id = el.getAttribute('id');
                if (!def.$arrayContract) {
                    def.$arrayContract = {};
                }
                foreachItemQueue.push({ id: el.getAttribute('id'), foreachStateRoot: el, contract: def.$arrayContract })
            });
    });
    while (foreachItemQueue.length) {
        const next = foreachItemQueue.shift();

        const iBindings = state._stateForeachItemBindings.get(next.id);
        iBindings.keys().forEach(ib => {
            const idef = buildJSONPath(next.contract, ib);
            idef.$attr = [ ...(idef.$attr ?? []), ...iBindings.get(ib).values().filter(a => a !== 'state-foreach') ];
            iBindings.get(ib).keys()
                .filter(ia => iBindings.get(ib).get(ia) === 'state-foreach')
                .map(ipath => ipath.reduce((el, child) => el.children[child], next.foreachStateRoot.children[0]).getAttribute('id'))
                .forEach(iid => {
                    if (!idef.$arrayContract) {
                        idef.$arrayContract = {};
                    }
                    foreachItemQueue.push({ id: iid, contract: idef.$arrayContract })
                });
        });
    }
    let stateStr = '';
    const interfacesQueue = [ { name: 'ViewState', root: contractRoot } ];
    const ifaceNameSeq = { next: 0 };
    while (interfacesQueue.length) {
        const next = interfacesQueue.shift();
        stateStr += serializeContractIface(next.name, next.root, interfacesQueue, ifaceNameSeq);
    }
    return stateStr;
}

function wrapContract(state, namespace) {
    if (!state._contract) {
        return stateDTs + ` declare namespace StateJs.${namespace} { export interface ViewState { } }`
            + ' export interface Document { state: StateJs.StateInstance<ViewState>; }'
            + ' export interface DocumentEventMap { "StateLoaded": Event; "StateUpdated": Event; }'
    }
    return stateDTs + ` declare namespace StateJs.${namespace} { ${state._contract} }`
        + ' export interface Document { state: StateJs.StateInstance<StateJs.Generated.ViewState>; }'
        + ' export interface DocumentEventMap { "StateLoaded": Event; "StateUpdated": Event; }'
}

export { buildContract, wrapContract };