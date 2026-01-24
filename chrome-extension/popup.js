import { createJSONEditor } from './node_modules/vanilla-jsoneditor/standalone.js'

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

const [{result}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => {
        return window.document.state?.current();
    }
});

let content = {
    text: undefined,
    json: result
}

const editor = createJSONEditor({
    target: document.getElementById('jsoneditor'),
    props: {
        content,
        mainMenuBar: true,
        navigationBar: true,
        statusBar: true,
        onChange: (updatedContent) => {
            console.log("UPDATE FIRED!!");
            const data = updatedContent.json || JSON.parse(updatedContent.text);
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: (newState) => { window.document.state?.update(newState); },
                args: [data]
            });
        }
    }
});