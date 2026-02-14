
function processMutation(state, mutation) {
    const element = mutation.target;
    console.log(`processing mutation for: ${element.tagName}, type: ${mutation.type}`);
}

export function processMutations(state, mutations) {
    const elementsToUnignore = new Set();
    mutations.forEach(m => {
        const element = m.target.nodeType === Node.ELEMENT_NODE  ? m.target : m.target.parentElement;
        if (!element) {
            return;
        }
        if (m.type === 'attributes' && m.attributeName === 'state-mutation-ignore' && !m.target.hasAttribute('state-mutation-ignore')) {
            return;
        }
        if (state.of(element) !== state._element) {
            return;
        }
        if (element.hasAttribute('state-mutation-ignore')) {
            elementsToUnignore.add(element);
            return;
        }
        processMutation(state, m);
    });
    elementsToUnignore.forEach(el => el.removeAttribute('state-mutation-ignore'));
}