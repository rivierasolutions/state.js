const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const prettier = require("prettier");

function activate(context) {
    const stateJsCodeText = fs.readFileSync(path.join(context.extensionPath, 'resources', 'state.min.js'), 'utf8');

    const watcher = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'html') {
            tryGenerateContract(document, stateJsCodeText)
                .then(dTsContract => {
                    if (dTsContract) {
                        fs.writeFileSync(`${document.fileName}.d.ts`, dTsContract);
                        console.log(`StateJs contract written to ${document.fileName}.d.ts`);
                    }
                });
        }
    });

    context.subscriptions.push(watcher);
}

function deactivate() {}

async function mockFetch(url, projectRoot) {
    const fileName = url.replace('http://localhost/', ''); 
    const filePath = path.join(projectRoot, fileName);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return {
            ok: true,
            status: 200,
            text: async () => content,
            json: async () => JSON.parse(content)
        };
    } catch (e) {
        return {
            ok: false,
            status: 404,
            statusText: "Not Found"
        };
    }
}

function toPascalCase(src) {
  return (src.substring(0,1).toUpperCase()+src.substring(1))
      .replace(/[\s-_]+./g, (match) => match.substring(match.length-1).toUpperCase());
}

function tryGenerateContract(document, stateJsCode, wrap = true) {

    const virtualConsole = new jsdom.VirtualConsole();
    virtualConsole.sendTo( console);

    const dom = new jsdom.JSDOM(document.getText(), {
        runScripts: "dangerously",
        url: "http://localhost/",
        virtualConsole
    });
    dom.window.fetch = (url) => mockFetch(url, vscode.workspace.workspaceFolders[0].uri.fsPath);
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

    const className = toPascalCase(path.parse(document.fileName).name);

    return Promise.race([stateLoaded, timeout])
        .then(() => {
            return prettier.format(html.state.contract('Generated', className, wrap), {
                parser: "typescript",
                tabWidth: 4,
                semi: true,
                singleQuote: false
            });
        })
        .catch(err => { console.log(err); });
}

module.exports = { activate, deactivate };