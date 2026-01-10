const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const prettier = require("prettier");

function activate(context) {
    const stateJsCodeText = fs.readFileSync(path.join(context.extensionPath, 'resources', 'state.js'), 'utf8');

    const watcher = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'html') {
            tryGenerateContract(document, stateJsCodeText);
        }
    });

    context.subscriptions.push(watcher);
}

function deactivate() {}

function tryGenerateContract(document, stateJsCode) {

    const virtualConsole = new jsdom.VirtualConsole();
    virtualConsole.on("error", (err) => {
        console.log("JSDOM Error:", err);
    });
    virtualConsole.on("log", (msg) => {
        console.log("JSDOM Log:", msg);
    });

    const dom = new jsdom.JSDOM(document.getText(), {
        runScripts: "dangerously",
        virtualConsole: virtualConsole
    });
    const html = dom.window.document;

	if (!Array.from(html.querySelectorAll('script')).some(s => s.src.endsWith('state.js') || s.src.endsWith('state.min.js'))
		&& !html.querySelector('*')?.getAttributeNames().some(name => name.startsWith('state-'))) {
		return;
	}

    dom.window.eval(stateJsCode);

    const stateLoaded = new Promise((resolve) => {
        html.addEventListener('StateLoaded', () => {
            resolve();
        }, { once: true });
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("StateJS timed out waiting for 'StateLoaded'")), 2000));

    const readyEvent = new dom.window.Event('DOMContentLoaded');
    html.dispatchEvent(readyEvent);

    Promise.race([stateLoaded, timeout]).then(() => {
        return prettier.format(html.state.contract(), {
            parser: "typescript",
            tabWidth: 4,
            semi: true,
            singleQuote: false
        });
    })
    .then(dTsContract => {
        fs.writeFileSync(`${document.fileName}.d.ts`, dTsContract);
        console.log(`StateJs contract written to ${document.fileName}.d.ts`);
    })
    .catch(err => { console.log(err); });
}

module.exports = { activate, deactivate };