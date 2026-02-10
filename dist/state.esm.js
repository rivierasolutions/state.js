// src/common.js
function buildJSONPath(root, path, leaf, forceLeaf = false) {
  let split = path.split(".");
  if (split[0] === "$" || split[0] === "@") {
    split = split.slice(1);
  }
  let leafp = split[split.length - 1];
  let parent = split.slice(0, split.length - 1).reduce((obj, p) => {
    const match = /^(.*)\[([0-9]+)\]$/.exec(p);
    if (match) {
      if (!obj.hasOwnProperty(match[1])) {
        obj[match[1]] = [];
      }
      return obj[match[1]].at(parseInt(match[2]));
    } else {
      if (!obj.hasOwnProperty(p)) {
        obj[p] = {};
      }
      return obj[p];
    }
  }, root);
  if (!parent.hasOwnProperty(leafp) || forceLeaf) {
    parent[leafp] = leaf ?? {};
  }
  return parent[leafp];
}
function getJSONPath(root, path) {
  let split = path.split(".");
  if (split[0] === "$" || split[0] === "@") {
    split = split.slice(1);
  }
  if (!split.length) {
    return root;
  }
  const res = split.reduce((obj, p) => {
    if (!(obj instanceof Object)) {
      return void 0;
    }
    const match = /^(.*)\[([0-9]+)\]$/.exec(p);
    return match ? Array.isArray(obj[match[1]]) ? obj[match[1]].at(parseInt(match[2])) : void 0 : obj[p];
  }, root);
  return res;
}
function placeholderFactory(attrs) {
  const placeholder = document.createElement("template");
  placeholder.setAttribute("state-placeholder", "");
  Object.keys(attrs).forEach((k) => placeholder.setAttribute(k, attrs[k]));
  return placeholder;
}
function registerBinding(state, absPath, type, element) {
  if (!state._bindings.has(absPath)) {
    state._bindings.set(absPath, /* @__PURE__ */ new Map());
  }
  if (!state._bindings.get(absPath).has(element)) {
    state._bindings.get(absPath).set(element, []);
  }
  state._bindings.get(absPath).get(element).push(type);
}
function unregisterBinding(state, absPath, elementOrPath, stateType = void 0) {
  if (stateType) {
    if (state._bindings.has(absPath) && state._bindings.get(absPath).has(elementOrPath)) {
      const types = state._bindings.get(absPath).get(elementOrPath);
      types.splice(types.indexOf(stateType), 1);
      if (!types.length) {
        state._bindings.get(absPath).delete(elementOrPath);
      }
    }
  } else {
    state._bindings.has(absPath) && state._bindings.get(absPath).delete(elementOrPath);
  }
}
function bindToValueAttr(element, absPath, state) {
  if (element.tagName === "SELECT") {
    element.addEventListener("change", (event) => state.update([{ jsonPath: absPath, value: event.target.value }]));
  } else if (element.getAttribute("contenteditable") === "true") {
    element.addEventListener("input", (event) => state.update([{ jsonPath: absPath, value: event.target.textContent }], `state-attr-value="${absPath}"`));
  } else if (element.tagName === "INPUT" && (element.getAttribute("type") === "checkbox" || element.getAttribute("type") === "radio")) {
    element.addEventListener("change", (event) => state.update([{ jsonPath: absPath, value: event.target.checked }], `state-attr-value="${absPath}"`));
  } else if (element.tagName === "INPUT" && element.getAttribute("type") === "file") {
    element.addEventListener("change", (event) => state.update([{ jsonPath: absPath, value: event.target.files }], `state-attr-value="${absPath}"`));
  } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    element.addEventListener("input", (event) => state.update([{ jsonPath: absPath, value: event.target.value }], `state-attr-value="${absPath}"`));
  }
}
function bindToOpenAttr(element, absPath, state) {
  if (element.tagName === "DETAILS") {
    element.addEventListener("toggle", (event) => state.update([{ jsonPath: absPath, value: event.target.open }], `state-attr-open="${absPath}"`));
  }
}
function setValueOrOpenAttr(element, attrName, stateValue) {
  if (attrName === "value") {
    element.value = stateValue;
  } else if (attrName === "checked") {
    element.checked = !!stateValue;
  } else if (attrName === "open") {
    element.open = !!stateValue;
  }
}
function loadView(state, element, absPath) {
  if (!state._composeTags.has(element.tagName)) {
    return Promise.reject(`Failed to load view for ${element.tagName}.`);
  }
  if (state._depth >= document.state._maxDepth) {
    return Promise.reject(`Cannot load view for ${element.tagName}. Maximum state nesting depth exceeded.`);
  }
  return state._composeTags.get(element.tagName).then((html) => {
    if (html) {
      element.innerHTML = html;
      return document.state.create(element);
    } else {
      return void 0;
    }
  }).then((newState) => {
    if (newState) {
      newState._parentStateRoot = state._element;
      newState._parentStateAbsPath = absPath;
      newState._depth = state._depth + 1;
      element.dispatchEvent(new CustomEvent("StateComposed", {
        bubbles: true,
        detail: { state: newState }
      }));
    } else {
      return void 0;
    }
  }).then(() => [element, absPath, void 0]);
}

// src/contractBuilder.js
var stateDTs = `declare namespace StateJs {

    type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
    };

    export interface StateInstance<T> {
        current(): Readonly<T>;
        update(patch: DeepPartial<T>|Array<{ jsonPath: string, value: any }>): void;
        scopeOf(el: HTMLElement): any;
        create<S>(el: HTMLElement): StateInstance<S>;
        contract(namespace?: string, className?: string, wrap?: boolean): string;
    }
}`;
function serializeContractIface(ifaceName, ifaceRoot, allIfaces, ifaceNameSeq, className) {
  let contractStr = `export interface ${ifaceName} { `;
  const serializeStack = Object.keys(ifaceRoot).map((k) => ({ name: k, value: ifaceRoot[k] }));
  while (serializeStack.length) {
    const next = serializeStack.pop();
    if (next.commit) {
      contractStr += next.commit;
      continue;
    }
    const props = Object.keys(next.value).filter((p) => p !== "$attr" && p !== "$arrayContract");
    if (props.length) {
      contractStr += `${next.name}: { `;
      serializeStack.push({ commit: "}; " });
      props.forEach((p) => serializeStack.push({ name: p, value: next.value[p] }));
    } else if (next.value.$attr?.find((a) => a === "state-listen")) {
      contractStr += `${next.name}: { [eventName: string]: (event: Event) => void; }; `;
    } else if (next.value.$arrayContract) {
      const acName = `StateForeachContract${++ifaceNameSeq.next}`;
      allIfaces.push({ name: acName, root: next.value.$arrayContract });
      contractStr += `${next.name}: Array<${className}.${acName}>; `;
    } else if (next.value.$attr?.length) {
      contractStr += `${next.name}: any; `;
    }
  }
  contractStr += "} ";
  return contractStr;
}
function buildContract(state, className) {
  const contractRoot = {};
  const foreachItemQueue = [];
  const bindings = state._initialBindings;
  bindings.keys().forEach((b) => {
    const def = buildJSONPath(contractRoot, b);
    def.$attr = [...def.$attr ?? [], ...bindings.get(b).values().flatMap((a) => a).filter((a) => a !== "state-foreach")];
    bindings.get(b).keys().filter((a) => bindings.get(b).get(a).indexOf("state-foreach") !== -1).forEach((el) => {
      const id = el.getAttribute("id");
      if (!def.$arrayContract) {
        def.$arrayContract = {};
      }
      foreachItemQueue.push({ id: el.getAttribute("id"), foreachStateRoot: el, contract: def.$arrayContract });
    });
  });
  while (foreachItemQueue.length) {
    const next = foreachItemQueue.shift();
    const iBindings = state._stateForeachItemBindings.get(next.id);
    iBindings.keys().forEach((ib) => {
      const idef = buildJSONPath(next.contract, ib);
      idef.$attr = [...idef.$attr ?? [], ...iBindings.get(ib).values().flatMap((a) => a).filter((a) => a !== "state-foreach")];
      iBindings.get(ib).keys().filter((ia) => iBindings.get(ib).get(ia).indexOf("state-foreach") !== -1).map((ipath) => ipath.reduce((el, child) => el.children[child], next.foreachStateRoot.children[0]).getAttribute("id")).forEach((iid) => {
        if (!idef.$arrayContract) {
          idef.$arrayContract = {};
        }
        foreachItemQueue.push({ id: iid, contract: idef.$arrayContract });
      });
    });
  }
  let stateStr = "";
  const interfacesQueue = [];
  const ifaceNameSeq = { next: 0 };
  stateStr = serializeContractIface(className, contractRoot, interfacesQueue, ifaceNameSeq, className);
  if (interfacesQueue.length) {
    stateStr += ` namespace ${className} { `;
    while (interfacesQueue.length) {
      const next = interfacesQueue.shift();
      stateStr += serializeContractIface(next.name, next.root, interfacesQueue, ifaceNameSeq, className);
    }
    stateStr += "} ";
  }
  return stateStr ?? `export interface ${className} { }`;
}
function wrapContract(contract, namespace, viewStateIfaceName) {
  return stateDTs + ` declare namespace StateJs.${namespace} { ${contract} } interface Document { state: StateJs.StateInstance<StateJs.${namespace}.${viewStateIfaceName}>; } interface DocumentEventMap { "StateLoaded": Event; "StateUpdated": Event; }`;
}

// src/jsonMerger.js
var isArrayIndexRegex = /^(.*)\[([0-9]+)\]$/;
function setFrozenJSONPath(state, path, value, thawed, changeIndex) {
  let split = path.split(".");
  if (split[0] === "$" || split[0] === "@") {
    split = split.slice(1);
  }
  const tuple = split.slice(0, split.length - 1).reduce(({ pathPart, obj }, seg) => {
    if (!(obj instanceof Object)) {
      return { pathPart, obj: void 0 };
    }
    const match = isArrayIndexRegex.exec(seg);
    if (match) {
      const arrayPath = match[1];
      const arraySrc = obj[arrayPath];
      obj[arrayPath] = [...obj[arrayPath]];
      thawed.set(`${pathPart}.${arrayPath}`, obj[arrayPath]);
      changeIndex.set(`${pathPart}.${arrayPath}`, { path: `${pathPart}.${arrayPath}`, src: arraySrc, dst: obj[arrayPath] });
      const index = parseInt(match[2]);
      const src = obj[arrayPath][index];
      obj[arrayPath][index] = { ...obj[arrayPath][index] };
      thawed.set(`${pathPart}.${arrayPath}[${index}]`, obj[arrayPath][index]);
      changeIndex.set(`${pathPart}.${arrayPath}[${index}]`, { path: `${pathPart}.${arrayPath}[${index}]`, src, dst: obj[arrayPath][index] });
      return { path: `${pathPart}.${arrayPath}[${index}]`, obj: obj[arrayPath][index] };
    } else {
      const src = obj[seg];
      obj[seg] = { ...obj[seg] };
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
        parent[match[1]] = [...parent[match[1]]];
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
function isObjectOrArray(o) {
  return o instanceof Object && !(o instanceof Function);
}
function buildArrayChanges(path, src, dst, res, toMerge, stateForeachScopes, onNotEqual) {
  const stateScope = stateForeachScopes.get(path.replace(/\[[0-9+]\]/g, "[]"));
  const arrayChanges = { path, src, dst, pending: true };
  for (let i = 0; i < dst.length; ++i) {
    if (isObjectOrArray(dst[i])) {
      res[i] = Array.isArray(dst[i]) ? [...dst[i]] : { ...dst[i] };
    }
    res[i].$index = i;
    toMerge.push({ path: `${path}[${i}].$index`, src: void 0, dst: i, res: res[i].$index });
  }
  toMerge.push({ commit: res, src, dst });
  if (!Array.isArray(src)) {
    arrayChanges.pending = false;
    onNotEqual?.forEach((f) => f());
    dst.forEach((e, i) => {
      toMerge.push({ path: `${path}[${i}]`, src: i == 0 ? src : structuredClone(stateScope), dst: e, res: res[i] });
    });
  } else if (dst.length != src.length) {
    arrayChanges.pending = false;
    onNotEqual?.forEach((f) => f());
    dst.forEach((e, i) => {
      toMerge.push({ path: `${path}[${i}]`, src: src.at(i) ?? structuredClone(stateScope), dst: e, res: res[i] });
    });
  } else {
    dst.forEach((e, i) => {
      toMerge.push({ path: `${path}[${i}]`, src: src[i], dst: e, res: res[i], onNotEqual: [...onNotEqual ?? [], () => {
        arrayChanges.pending = false;
      }] });
    });
  }
  toMerge.push({ path: `${path}.length`, src: src?.length, dst: dst.length });
  return arrayChanges;
}
function buildObjectChanges(path, src, dst, res, toMerge, changeIndex, onNotEqual) {
  toMerge.push({ commit: res, src, dst });
  const objectChanges = { path, src, dst, pending: true };
  changeIndex.push(objectChanges);
  Object.keys(dst).forEach((key) => {
    if (isObjectOrArray(dst[key])) {
      res[key] = Array.isArray(dst[key]) ? [...dst[key]] : { ...src ? src[key] : {}, ...dst[key] };
    }
    toMerge.push({
      path: `${path}.${key}`,
      src: src?.hasOwnProperty(key) ? src[key] : void 0,
      dst: dst[key],
      onNotEqual: [...onNotEqual ?? [], () => {
        objectChanges.pending = false;
      }],
      res: res[key]
    });
  });
}
function mergeChangesAsPartialObject(src, dst, state) {
  const stateForeachScopes = state._stateForeachScopes;
  const changeIndex = [];
  if (dst && dst instanceof Object) {
    const res = { ...src, ...dst };
    const toMerge = [{ path: "$", src, dst, res }];
    while (toMerge.length) {
      const tuple = toMerge.pop();
      if (tuple.commit) {
        tuple.commit !== tuple.dst && Object.freeze(tuple.commit);
      } else if (Array.isArray(tuple.dst)) {
        changeIndex.push(buildArrayChanges(tuple.path, tuple.src, tuple.dst, tuple.res, toMerge, stateForeachScopes, tuple.onNotEqual));
      } else if (isObjectOrArray(tuple.dst)) {
        buildObjectChanges(tuple.path, tuple.src, tuple.dst, tuple.res, toMerge, changeIndex, tuple.onNotEqual);
      } else {
        if (tuple.dst !== tuple.src) {
          changeIndex.push(tuple);
          tuple.onNotEqual?.forEach((f) => f());
        }
      }
    }
    state._current = res;
  }
  return changeIndex.filter((ch) => !ch.pending);
}
function mergeChangesAsArray(state, changes) {
  state._current = { ...state._current };
  const thawed = /* @__PURE__ */ new Map();
  thawed.set("$", state._current);
  const changeIndex = /* @__PURE__ */ new Map();
  changes.forEach(({ jsonPath, value }) => jsonPath && typeof jsonPath === "string" && jsonPath.startsWith("$") && setFrozenJSONPath(state, jsonPath, value, thawed, changeIndex));
  Array.from(thawed.values()).forEach((o) => Object.freeze(o));
  return changeIndex.values();
}
function mergeChanges(state, changes) {
  if (Array.isArray(changes) && changes.length) {
    return mergeChangesAsArray(state, changes);
  } else {
    return mergeChangesAsPartialObject(state._current, changes, state);
  }
}

// src/stateBuilder.js
function domVisitor(rootElement, rootScope, composeTags, visit) {
  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => node.hasAttribute("state-ignore") ? NodeFilter.FILTER_REJECT : node.hasAttribute("state-scope") || node.hasAttribute("state-if") || node.hasAttribute("state-if-not") || node.hasAttribute("state-foreach") || node.hasAttribute("state-content") || node.hasAttribute("state-listen") || composeTags.has(node.tagName) || Array.from(node.attributes).find((a) => a.name.startsWith("state-attr-") || a.name.startsWith("state-class-")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    }
  );
  const stack = [{ scope: rootScope, scopeRootElement: rootElement, absJsonPath: "$", isStateForeachItemScope: false }];
  while (walker.nextNode()) {
    const element = walker.currentNode;
    while (true) {
      const scopeTuple = stack[stack.length - 1];
      if (scopeTuple.scopeRootElement !== element && scopeTuple.scopeRootElement.contains(element)) {
        const newScopeAndElem = visit({ ...scopeTuple, walker, element });
        if (newScopeAndElem && newScopeAndElem.scope && newScopeAndElem.scopeRootElement && newScopeAndElem.absJsonPath) {
          stack.push(newScopeAndElem);
        }
        break;
      } else {
        stack.pop();
      }
    }
  }
}
function registerStateForeachBinding(state, relPath, stateType, element, statForeachRootScope) {
  const id = statForeachRootScope.parentElement.getAttribute("id");
  if (!state._stateForeachItemBindings.has(id)) {
    state._stateForeachItemBindings.set(id, /* @__PURE__ */ new Map());
  }
  const itemBindings = state._stateForeachItemBindings.get(id);
  if (!itemBindings.has(relPath)) {
    itemBindings.set(relPath, /* @__PURE__ */ new Map());
  }
  const path = [];
  while (element && element !== statForeachRootScope) {
    if (!element.parentElement) {
      break;
    }
    const index = ((el) => {
      let index2 = 0;
      while (el = el.previousElementSibling) {
        ++index2;
      }
      return index2;
    })(element);
    path.unshift(index);
    element = element.parentElement;
  }
  if (!itemBindings.get(relPath).has(path)) {
    itemBindings.get(relPath).set(path, []);
  }
  itemBindings.get(relPath).get(path).push(stateType);
}
function registerStateForeachComposeTag(state, composeTag, element, statForeachRootScope) {
  const id = statForeachRootScope.parentElement.getAttribute("id");
  if (!state._stateForeachComposeTags.has(id)) {
    state._stateForeachComposeTags.set(id, /* @__PURE__ */ new Map());
  }
  const itemBindings = state._stateForeachComposeTags.get(id);
  if (!itemBindings.has(composeTag)) {
    itemBindings.set(composeTag, /* @__PURE__ */ new Set());
  }
  const path = [];
  while (element && element !== statForeachRootScope) {
    if (!element.parentElement) {
      break;
    }
    const index = ((el) => {
      let index2 = 0;
      while (el = el.previousElementSibling) {
        ++index2;
      }
      return index2;
    })(element);
    path.unshift(index);
    element = element.parentElement;
  }
  itemBindings.get(composeTag).add(path);
}
function registerStateForeachScope(state, absPath) {
  if (!state._stateForeachScopes.has(absPath)) {
    state._stateForeachScopes.set(absPath, {});
  }
  return state._stateForeachScopes.get(absPath);
}
function visitAndBuild(visitContext, state, componentUpdates) {
  const node = visitContext.element;
  let scope = visitContext.scope;
  let scopeRootElement = visitContext.scopeRootElement;
  let absPath = visitContext.absJsonPath;
  let isStateForeachItemScope = visitContext.isStateForeachItemScope;
  let result = void 0;
  if (node.hasAttribute("state-scope")) {
    const jsonPath = node.getAttribute("state-scope");
    isStateForeachItemScope = node.parentElement?.tagName === "TEMPLATE" && node.parentElement?.hasAttribute("state-placeholder") && node.parentElement?.hasAttribute("state-foreach");
    result = {
      scope: isStateForeachItemScope ? registerStateForeachScope(state, node.parentElement?.getAttribute("state-foreach").replace("@", absPath)) : buildJSONPath(scope, jsonPath, {}),
      scopeRootElement: node,
      absJsonPath: jsonPath.replace("@", absPath),
      isStateForeachItemScope
    };
    node.setAttribute("state-scope", jsonPath.replace("@", absPath));
    scope = result.scope;
    scopeRootElement = result.scopeRootElement;
    absPath = result.absPath;
  }
  if (node.hasAttribute("state-foreach")) {
    const jsonPath = node.getAttribute("state-foreach");
    buildJSONPath(scope, jsonPath, [], true);
    let placeholder = node;
    if (!node.hasAttribute("state-placeholder")) {
      placeholder = placeholderFactory({ "state-foreach": jsonPath, "id": `state-auto-id-${++state._idSequence.next}` });
      node.removeAttribute("state-foreach");
      node.setAttribute("state-scope", `${jsonPath.replace("@", absPath)}[]`);
      node.replaceWith(placeholder);
      placeholder.appendChild(node);
      visitContext.walker.currentNode = placeholder;
    }
    if (isStateForeachItemScope) {
      registerStateForeachBinding(state, jsonPath, "state-foreach", placeholder, scopeRootElement);
    } else {
      registerBinding(state, jsonPath.replace("@", absPath), "state-foreach", placeholder);
    }
    return result;
  }
  if (node.hasAttribute("state-if")) {
    const jsonPath = node.getAttribute("state-if");
    buildJSONPath(scope, jsonPath, false);
    if (!isStateForeachItemScope) {
      registerBinding(state, jsonPath.replace("@", absPath), "state-if", node);
    } else {
      registerStateForeachBinding(state, jsonPath, "state-if", node, scopeRootElement);
    }
  }
  if (node.hasAttribute("state-if-not")) {
    const jsonPath = node.getAttribute("state-if-not");
    buildJSONPath(scope, jsonPath, false);
    if (!isStateForeachItemScope) {
      registerBinding(state, jsonPath.replace("@", absPath), "state-if-not", node);
    } else {
      registerStateForeachBinding(state, jsonPath, "state-if-not", node, scopeRootElement);
    }
  }
  if (node.hasAttribute("state-content")) {
    const jsonPath = node.getAttribute("state-content");
    buildJSONPath(scope, jsonPath, node.textContent ?? "");
    if (!isStateForeachItemScope) {
      registerBinding(state, jsonPath.replace("@", absPath), "state-content", node);
    } else {
      registerStateForeachBinding(state, jsonPath, "state-content", node, scopeRootElement);
    }
  }
  Array.from(node.attributes).filter((attr) => attr.name.startsWith("state-attr-")).forEach((attr) => {
    const jsonPath = attr.value;
    const attrName = attr.name.replace("state-attr-", "");
    let initialValue = node.getAttribute(attrName) ?? "";
    if (attrName.endsWith("-if")) {
      initialValue = node.hasAttribute(attrName.slice(0, -3));
    } else if (attrName.endsWith("-if-not")) {
      initialValue = !node.hasAttribute(attrName.slice(0, -7));
    }
    buildJSONPath(scope, jsonPath, initialValue);
    if (!isStateForeachItemScope) {
      registerBinding(state, jsonPath.replace("@", absPath), attr.name, node);
    } else {
      registerStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement);
    }
    if (attrName === "value") {
      bindToValueAttr(node, jsonPath.replace("@", absPath), state);
    }
    if (attrName === "open") {
      bindToOpenAttr(node, jsonPath.replace("@", absPath), state);
    }
  });
  Array.from(node.attributes).filter((attr) => attr.name.startsWith("state-class-")).forEach((attr) => {
    const jsonPath = attr.value;
    let className = attr.name.replace("state-class-", "");
    if (className.endsWith("-if-not")) {
      className = className.slice(0, -7);
    } else if (className.endsWith("-if")) {
      className = className.slice(0, -3);
    }
    buildJSONPath(scope, jsonPath, node.classList.contains(className));
    if (!isStateForeachItemScope) {
      registerBinding(state, jsonPath.replace("@", absPath), attr.name, node);
    } else {
      registerStateForeachBinding(state, jsonPath, attr.name, node, scopeRootElement);
    }
  });
  if (node.hasAttribute("state-listen")) {
    const jsonPath = node.getAttribute("state-listen");
    if (!isStateForeachItemScope) {
      if (!node.hasAttribute("id")) {
        node.setAttribute("id", `state-auto-id-${++state._idSequence.next}`);
      }
      registerBinding(state, jsonPath.replace("@", absPath), "state-listen", node);
    } else {
      registerStateForeachBinding(state, jsonPath, "state-listen", node, scopeRootElement);
    }
  }
  if (state._composeTags.has(node.tagName)) {
    let passJsonPath = void 0;
    if (node.hasAttribute("state-pass")) {
      passJsonPath = node.getAttribute("state-pass");
    }
    if (!isStateForeachItemScope) {
      componentUpdates.set(node, loadView(state, node, passJsonPath?.replace("@", absPath)));
      if (passJsonPath) {
        registerBinding(state, passJsonPath.replace("@", absPath), "state-pass", node);
      }
    } else {
      registerStateForeachComposeTag(state, node.tagName, node, scopeRootElement);
      if (passJsonPath) {
        registerStateForeachBinding(state, passJsonPath, "state-pass", node, scopeRootElement);
      }
    }
  }
  return result;
}
function buildState(rootElement, componentUpdates) {
  domVisitor(rootElement, rootElement.state._current, rootElement.state._composeTags, (ctx) => visitAndBuild(ctx, rootElement.state, componentUpdates));
}

// src/stateChangeHandler.js
function bindToStateListenAttr(state, element, previousStateValue, stateValue) {
  Object.keys(previousStateValue ?? {}).forEach((k) => {
    element.removeEventListener(k, state._listeners.get(previousStateValue[k]));
  });
  if (stateValue && stateValue.context && stateValue.context !== element.context) {
    element.context = stateValue.context;
  }
  Object.keys(stateValue ?? {}).filter((k) => k !== "context").forEach((k) => {
    element.addEventListener(k, state._listeners.get(stateValue[k]));
  });
}
function bindFoeachListItemState(state, stateForeachItemRoot, absPath, DOMPath, stateType) {
  const element = DOMPath.reduce((el, child) => el.children[child], stateForeachItemRoot);
  if (stateType.startsWith("state-attr-")) {
    const attrName = stateType.replace("state-attr-", "");
    if (attrName === "value") {
      bindToValueAttr(element, absPath, state);
    } else if (attrName === "open") {
      bindToOpenAttr(element, absPath, state);
    }
  } else if (stateType === "state-listen" && !element.hasAttribute("id")) {
    element.setAttribute("id", `state-auto-id-${++state._idSequence.next}`);
  }
}
function loadForeachListItemView(state, stateForeachItemRoot, absPath, DOMPath, componentUpdates) {
  const element = DOMPath.reduce((el, child) => el.children[child], stateForeachItemRoot);
  let passJsonPath = element.getAttribute("state-pass")?.replace("@", absPath);
  let loadPromise = loadView(state, element, passJsonPath);
  const statePass = passJsonPath && getJSONPath(state._current, passJsonPath);
  if (statePass) {
    loadPromise = loadPromise.then(() => [element, passJsonPath, statePass]);
  }
  componentUpdates.set(element, loadPromise);
}
function removeStateForeachItem(state, absPath, statForeachElement, existingItemsQuery, index) {
  const stateTemplate = state._stateForeachItemBindings.get(statForeachElement.getAttribute("id"));
  function remove(el, index2) {
    Array.from(stateTemplate.keys()).map((path) => path.replace("@", `${absPath}[${index2}]`)).forEach((path) => unregisterBinding(state, path, el));
    el.remove();
  }
  if (index === void 0) {
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
  domItem.setAttribute("state-scope", `${absPath}[${index}]`);
  const composeTags = state._stateForeachComposeTags.get(stateForeachId);
  if (composeTags) {
    Array.from(composeTags.entries()).flatMap(([composeTag, templatePathMap]) => Array.from(Array.from(templatePathMap.keys())).map((DOMPath) => [composeTag, DOMPath])).forEach(([composeTag, DOMPath]) => loadForeachListItemView(state, domItem, `${absPath}[${index}]`, DOMPath, componentUpdates));
  }
  const stateTemplate = state._stateForeachItemBindings.get(stateForeachId);
  if (stateTemplate) {
    Array.from(stateTemplate.entries()).flatMap(
      ([itemPath, templatePathMap]) => Array.from(templatePathMap.entries()).flatMap(([DOMPath, types]) => types.map((stateType) => [itemPath, DOMPath, stateType]))
    ).forEach(([itemPath, DOMPath, stateType]) => {
      registerBinding(state, itemPath.replace("@", `${absPath}[${index}]`), stateType, { DOMPath, stateForeachItemRoot: domItem });
      bindFoeachListItemState(state, domItem, itemPath.replace("@", `${absPath}[${index}]`), DOMPath, stateType);
    });
  }
  return domItem;
}
function applyStateChange(state, absPath, elementOrPath, stateType, src, dst, componentUpdates) {
  const stateValue = getJSONPath(state._current, absPath);
  const element = elementOrPath instanceof HTMLElement ? elementOrPath : elementOrPath.DOMPath.reduce((el, child) => el.children[child], elementOrPath.stateForeachItemRoot);
  if (stateType === "state-content") {
    element.textContent = stateValue;
  } else if (stateType.startsWith("state-attr-")) {
    let attrName = stateType.replace("state-attr-", "");
    let bool = false;
    let boolNegated = false;
    if (attrName.endsWith("-if")) {
      bool = true;
      attrName = attrName.slice(0, -3);
    } else if (attrName.endsWith("-if-not")) {
      boolNegated = true;
      attrName = attrName.slice(0, -7);
    }
    if (bool) {
      if (stateValue) {
        element.setAttribute(attrName, "");
      } else {
        element.removeAttribute(attrName);
      }
    } else if (boolNegated) {
      if (stateValue) {
        element.removeAttribute(attrName);
      } else {
        element.setAttribute(attrName, "");
      }
    } else {
      element.setAttribute(attrName, stateValue);
    }
    setValueOrOpenAttr(element, attrName, boolNegated ? !stateValue : stateValue);
  } else if (stateType.startsWith("state-class-")) {
    const className = stateType.replace("state-class-", "");
    if (className.endsWith("-if-not")) {
      if (stateValue) {
        element.classList.remove(className.slice(0, -7));
      } else {
        element.classList.add(className.slice(0, -7));
      }
    } else {
      if (stateValue) {
        element.classList.add(className.endsWith("-if") ? className.slice(0, -3) : className);
      } else {
        element.classList.remove(className.endsWith("-if") ? className.slice(0, -3) : className);
      }
    }
  } else if (stateType === "state-if") {
    if (!stateValue && !element.hasAttribute("state-placeholder")) {
      const placeholder = placeholderFactory({ "state-if": element.getAttribute("state-if") });
      element.replaceWith(placeholder);
      placeholder.appendChild(element);
      registerBinding(state, absPath, "state-if", placeholder);
      unregisterBinding(state, absPath, element, "state-if");
    } else if (stateValue && element.tagName === "TEMPLATE" && element.hasAttribute("state-placeholder")) {
      const content = element.firstElementChild;
      element.replaceWith(content);
      registerBinding(state, absPath, "state-if", content);
      unregisterBinding(state, absPath, element, "state-if");
    }
  } else if (stateType === "state-if-not") {
    if (stateValue && !element.hasAttribute("state-placeholder")) {
      const placeholder = placeholderFactory({ "state-if-not": element.getAttribute("state-if-not") });
      element.replaceWith(placeholder);
      placeholder.appendChild(element);
      registerBinding(state, absPath, "state-if-not", placeholder);
      unregisterBinding(state, absPath, element, "state-if-not");
    } else if (!stateValue && element.tagName === "TEMPLATE" && element.hasAttribute("state-placeholder")) {
      const content = element.firstElementChild;
      element.replaceWith(content);
      registerBinding(state, absPath, "state-if-not", content);
      unregisterBinding(state, absPath, element, "state-if-not");
    }
  } else if (stateType === "state-foreach") {
    const forEachId = element.getAttribute("id");
    const existingItemsQuery = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
    if (src === void 0 && dst === void 0) {
      removeStateForeachItem(state, absPath, element, existingItemsQuery);
      if (stateValue) {
        (Array.isArray(stateValue) ? stateValue : [stateValue]).map((item, index) => foreachStateItemFactory(state, absPath, element, index, componentUpdates)).reverse().forEach((el) => element.after(el));
      }
    } else {
      const srcLength = src?.length ?? 0;
      if (srcLength > stateValue.length) {
        Array.from(existingItemsQuery).slice(-1 * (srcLength - stateValue.length)).forEach((el, index) => {
          removeStateForeachItem(state, absPath, element, existingItemsQuery, srcLength - 1 - index);
        });
      } else if (srcLength < stateValue.length) {
        for (let i = 0; i < stateValue.length - srcLength; ++i) {
          const el = foreachStateItemFactory(state, absPath, element, srcLength + i, componentUpdates);
          const query = element.parentNode.querySelectorAll(`[state-foreach-id="${forEachId}"]`);
          (query.length ? Array.from(query).at(-1) : element).after(el);
        }
      }
    }
  } else if (stateType === "state-listen") {
    bindToStateListenAttr(state, element, src, dst ?? stateValue);
  } else if (stateType === "state-pass" && stateValue) {
    componentUpdates.set(element, (componentUpdates.get(element) ?? Promise.resolve()).then(() => [element, absPath, stateValue]));
  }
}
function applyState(state, changes, componentLoads) {
  const componentUpdates = new Map(componentLoads);
  if (!changes && !Array.isArray(changes)) {
    Array.from(state._bindings.entries()).flatMap(([path, elementMap]) => Array.from(elementMap.entries()).flatMap(([element, types]) => types.map((stateType) => [path, element, stateType]))).forEach(([path, element, stateType]) => applyStateChange(state, path, element, stateType, void 0, void 0, componentUpdates));
  } else {
    changes.forEach(({ path, src, dst }) => {
      if (state._bindings.has(path)) {
        Array.from(state._bindings.get(path).entries()).flatMap(([element, types]) => types.map((stateType) => [path, element, stateType])).forEach(([path2, element, stateType]) => applyStateChange(state, path2, element, stateType, src, dst, componentUpdates));
      }
    });
  }
  return Promise.allSettled(componentUpdates.values()).then((all) => all.filter((res) => res.status === "fulfilled" && res.value.at(1)).map((res) => res.value));
}

// src/state.js
async function updateStateTree(rootElement, newState, origin) {
  const statesToUpdate = [{ root: rootElement, update: newState, componentUpdates: void 0, origin }];
  while (statesToUpdate.length) {
    const next = statesToUpdate.pop();
    if (next.componentUpdates) {
      mergeChanges(next.root.state, next.componentUpdates.map(([el, absPath, update]) => ({ jsonPath: absPath, value: el.state.current() })));
      next.root.dispatchEvent(new CustomEvent(`StateUpdated`, { bubbles: true, composed: true, detail: { origin: next.origin } }));
    } else {
      const componentUpdates = (await applyState(next.root.state, mergeChanges(next.root.state, next.update))).filter(([el, absPath, update]) => update !== void 0 && el.state);
      statesToUpdate.push({ root: next.root, update: void 0, componentUpdates, origin: next.origin });
      if (componentUpdates.length) {
        statesToUpdate.push(...componentUpdates.map(([root, absPath, update]) => ({ root, update, componentUpdates: void 0, origin: `state-pass-down="${absPath}"` })));
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
        if (typeof nameOrDict !== "string" && fn === void 0) {
          Object.keys(nameOrDict).forEach((k) => rootElement.state._listeners.set(k, (ev) => nameOrDict[k](ev, ev.target.context)));
        } else {
          rootElement.state._listeners.set(nameOrDict, (ev) => fn(ev, ev.target.context));
        }
      },
      update: function(newState, origin = "controller") {
        return updateStateTree(rootElement, newState, origin);
      },
      apply: function() {
        applyState(this);
      },
      create(element) {
        return load(element);
      },
      contract(namespace = "Generated", className = "ViewState", wrap = true) {
        return wrap ? wrapContract(buildContract(this, className), namespace, className) : buildContract(this, className);
      }
    };
    rootElement.state._current = {};
    rootElement.state._element = rootElement;
    rootElement.state._parentStateRoot = void 0;
    rootElement.state._parentStateAbsPath = void 0;
    rootElement.state._idSequence = { next: 0 };
    rootElement.state._bindings = /* @__PURE__ */ new Map();
    rootElement.state._initialBindings = /* @__PURE__ */ new Map();
    rootElement.state._composeTags = rootElement === document ? /* @__PURE__ */ new Map() : document.state._composeTags;
    rootElement.state._stateForeachItemBindings = /* @__PURE__ */ new Map();
    rootElement.state._stateForeachComposeTags = /* @__PURE__ */ new Map();
    rootElement.state._stateForeachScopes = /* @__PURE__ */ new Map();
    rootElement.state._depth = 0;
    rootElement.state._listeners = /* @__PURE__ */ new Map();
    if (rootElement === document) {
      rootElement.state._maxDepth = 20;
    }
    rootElement.querySelectorAll("state-compose").forEach((compose) => {
      const tag = compose.getAttribute("tag");
      const src = compose.getAttribute("src");
      if (tag && src) {
        const local = document.getElementById(src);
        const promise = local && local.tagName === "TEMPLATE" ? Promise.resolve(local.innerHTML) : fetch(src).then((res) => res.ok ? res.text() : Promise.reject());
        rootElement.state._composeTags.set(tag.toUpperCase(), promise);
      }
    });
    if (!(rootElement == document && rootElement.documentElement.hasAttribute("state-ignore"))) {
      const componentLoads = /* @__PURE__ */ new Map();
      buildState(rootElement, componentLoads);
      await Promise.allSettled(componentLoads);
      const componentUpdates = await applyState(rootElement.state, void 0, componentLoads);
      mergeChanges(rootElement.state, componentUpdates.map(([el, absPath]) => ({ jsonPath: absPath, value: el.state.current() })));
      rootElement.state._initialBindings = new Map(rootElement.state._bindings);
      rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));
      return rootElement.state;
    } else {
      rootElement.dispatchEvent(new CustomEvent(`StateLoaded`));
      return rootElement.state;
    }
  }
  document.addEventListener("DOMContentLoaded", () => load(document));
})();
