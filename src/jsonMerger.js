
const isArrayIndexRegex = /^(.*)\[([0-9]+)\]$/;

function setFrozenJSONPath(state, path, value, thawed, changeIndex) {
    let split = path.split('.');
    if (split[0] === '$' || split[0] === '@') {
        split = split.slice(1);
    }

    const tuple = split.slice(0, split.length-1).reduce(({ pathPart, obj }, seg) => {
        if (!(obj instanceof Object)) { return { pathPart, obj: undefined }; }

        const match = isArrayIndexRegex.exec(seg);
        if (match) {
            const arrayPath = match[1];
            const arraySrc = obj[arrayPath];
            obj[arrayPath] = [...(obj[arrayPath])];
            thawed.set(`${pathPart}.${arrayPath}`, obj[arrayPath]);
            changeIndex.set(`${pathPart}.${arrayPath}`, { path: `${pathPart}.${arrayPath}`, src: arraySrc, dst: obj[arrayPath] });

            const index = parseInt(match[2]);
            const src = obj[arrayPath][index];
            obj[arrayPath][index] = { ...(obj[arrayPath][index]) };
            thawed.set(`${pathPart}.${arrayPath}[${index}]`, obj[arrayPath][index]);
            changeIndex.set(`${pathPart}.${arrayPath}[${index}]`, { path: `${pathPart}.${arrayPath}[${index}]`, src, dst: obj[arrayPath][index] });

            return { path: `${pathPart}.${arrayPath}[${index}]`, obj: obj[arrayPath][index] };
        } else {
            const src = obj[seg];
            obj[seg] = {...obj[seg]};
            thawed.set(`${pathPart}.${seg}`, obj[seg]);
            changeIndex.set(`${pathPart}.${seg}`, { path: `${pathPart}.${seg}`, src, dst: obj[seg] });
            return { path: `${pathPart}.${seg}`, obj: obj[seg] };
        }
    }, { pathPart: "$", obj: state._current });

    const parent = tuple.obj;
    const parentPath = tuple.path;
    if (parent) {
        const match = isArrayIndexRegex.exec(split.at(-1));
        if (match && Array.isArray(parent[match[1]])) {
            const index = parseInt(match[2]);
            if (index < parent[match[1]].length) {

                const srcArray = parent[match[1]];
                parent[match[1]] = [...(parent[match[1]])];
                thawed.set(`${parentPath}.${match[1]}`, parent[match[1]]);
                changeIndex.set(`${parentPath}.${match[1]}`, { path: `${parentPath}.${match[1]}`, src: srcArray, dst: parent[match[1]] });

                const src = parent[match[1]][index];
                parent[match[1]][index] = value;
                changeIndex.set(path, { path, src, dst: parent[match[1]][index] });
            }
        } else if (!match) {
            const src = parent[split.at(-1)];
            parent[split.at(-1)] = value;
            changeIndex.set(path, { path, src, dst: parent[split.at(-1)] });
        }
        if (value instanceof Object) {
            thawed.set(path, value);
        }
    }
}

function buildArrayChanges(path, src, dst, res, toMerge, stateForeachScopes, onNotEqual) {
    const stateScope = stateForeachScopes.get(path.replace(/\[[0-9+]\]/g, '[]'));
    const arrayChanges = { path, src, dst, pending: true };
    for(let i=0; i<dst.length; ++i) {
        if (dst[i] instanceof Object && Object.isFrozen(dst[i])) {
            dst[i] = Array.isArray(dst[i]) ? [...(dst[i])] : { ...dst[i] };
        }
        dst[i].$index = i;
    }
    toMerge.push({ commit: res, src, dst });
    if (!Array.isArray(src)) {
        arrayChanges.pending = false;
        onNotEqual?.forEach(f => f());
        dst.forEach((e,i) => {
            toMerge.push({ path: `${path}[${i}]`, src: i == 0 ? src : structuredClone(stateScope), dst: e, res: res[i] });
        });
    } else if (dst.length != src.length) {
        arrayChanges.pending = false;
        onNotEqual?.forEach(f => f());
        dst.forEach((e,i) => {
            toMerge.push({ path: `${path}[${i}]`, src: src.at(i) ?? structuredClone(stateScope), dst: e, res: res[i] });
        });
    } else {
        dst.forEach((e, i) => {
            toMerge.push({ path: `${path}[${i}]`, src: src[i], dst: e, res: res[i], onNotEqual: [ ...(onNotEqual ?? []), () => { arrayChanges.pending = false; } ] });
        });
    }
    return arrayChanges;
}

function buildObjectChanges(path, src, dst, res, toMerge, changeIndex, onNotEqual) {
    toMerge.push({ commit: res, src, dst });
    const objectChanges = { path, src, dst, pending: true };
    changeIndex.push(objectChanges);
    Object.keys(dst).forEach((key) => {
        if (res[key] instanceof Object && Object.isFrozen(res[key])) {
            res[key] = Array.isArray(res[key]) ? [...(res[key])] : { ...res[key] };
        }
        toMerge.push({
            path: `${path}.${key}`,
            src: src?.hasOwnProperty(key) ? src[key] : undefined,
            dst: dst[key],
            onNotEqual: [ ...(onNotEqual ?? []), () => { objectChanges.pending = false; } ],
            res: res[key]
        });
    });
}

function mergeChangesAsPartialObject(src, dst, state) {
    const stateForeachScopes = state._stateForeachScopes;
    const changeIndex = [];
    if (dst && dst instanceof Object) {
        const res = { ...src, ...dst };
        const toMerge = [ { path: "$", src, dst, res } ];
        while (toMerge.length) {
            const tuple = toMerge.pop();
            if (tuple.commit) {
                if (tuple.commit !== tuple.dst) {
                    Object.assign(tuple.commit, { ...(Array.isArray(tuple.dst) ? [] : tuple.src), ...tuple.dst });
                    Object.freeze(tuple.commit);
                }
            } else if (Array.isArray(tuple.dst)) {
                changeIndex.push(buildArrayChanges(tuple.path, tuple.src, tuple.dst, tuple.res, toMerge, stateForeachScopes, tuple.onNotEqual));
            } else if (tuple.dst instanceof Object && !(tuple.dst instanceof Function)) {
                buildObjectChanges(tuple.path, tuple.src, tuple.dst, tuple.res, toMerge, changeIndex, tuple.onNotEqual);
            } else {
                if (tuple.dst !== tuple.src) {
                    changeIndex.push(tuple);
                    tuple.onNotEqual?.forEach(f => f());
                }
            }
        }
        state._current = res;
    }
    return changeIndex.filter(ch => !ch.pending);
}

function mergeChangesAsArray(state, changes) {
    state._current = { ...state._current };
    const thawed = new Map();
    thawed.set("$", state._current);
    const changeIndex = new Map();

    changes.forEach(({ path, value }) => path && typeof(path) === 'string' && path.startsWith('$') && setFrozenJSONPath(state, path, value, thawed, changeIndex));

    Array.from(thawed.values()).forEach(o => Object.freeze(o));
    return changeIndex.values();
}

function mergeChanges(state, changes) {
    if (Array.isArray(changes) && changes.length) {
        return mergeChangesAsArray(state, changes);
    } else {
        return mergeChangesAsPartialObject(state._current, changes, state);
    }
}

export { mergeChanges };