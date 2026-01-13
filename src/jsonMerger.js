
function buildArrayChanges(path, src, dst, res, toMerge, stateForeachScopes, onNotEqual) {
    const stateScope = stateForeachScopes.get(path.replace(/\[[0-9+]\]/g, '[]'));
    const arrayChanges = { path, src, dst, pending: true };
    dst.forEach((e,i) => { e.$index = i; });
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
        toMerge.push({
            path: `${path}.${key}`,
            src: src?.hasOwnProperty(key) ? src[key] : undefined,
            dst: dst[key],
            onNotEqual: [ ...(onNotEqual ?? []), () => { objectChanges.pending = false; } ],
            res: res[key]
        });
    });
}

function mergeChanges(src, dst, state) {
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

export { mergeChanges };