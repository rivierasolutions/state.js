import { createJSONEditor } from './node_modules/vanilla-jsoneditor/standalone.js'

async function bindToTab(tab, editor) {
    const [{result}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
            document.addEventListener('StateUpdated', (event) => {
                window.postMessage({  source: 'statejs-bridge', payload: document.state.current() }, '*');
            });
            return window.document.state?.current();
        }
    });

    editor.set({ json: result });
}

const editor = createJSONEditor({
    target: document.getElementById('jsoneditor'),
    props: {
        content: { text: undefined, json: {} },
        mainMenuBar: true,
        navigationBar: true,
        statusBar: true,
        onChange: (updatedContent) => {
            const data = updatedContent.json || JSON.parse(updatedContent.text);
            chrome.tabs.query({ active: true, currentWindow: true })
                .then(([tab]) => chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    world: 'MAIN',
                    func: (newState) => { window.document.state?.update(newState); },
                    args: [data]
                }));
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'STATE_UPDATED') {
        editor.set({ json: message?.data });
    }
    if (message.type === 'TAB_REFRESHED') {
        editor.update({ json: {} });
        if (sender.tab) {
            bindToTab(sender.tab, editor);
        }
    }
});

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
bindToTab(tab, editor);