import * as vscode from 'vscode';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

export function activate(context: vscode.ExtensionContext) {
	
	console.log("ACTIVATED!!!!");
	const watcher = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'html') {
            tryGenerateContract(document, context);
        }
    });

	context.subscriptions.push(watcher);
}

export function deactivate() {}

function tryGenerateContract(document: vscode.TextDocument, ctx: vscode.ExtensionContext): void {
	const dom = new JSDOM(document.getText());

	const scripts = Array.from(dom.window.document.querySelectorAll('script'));
	if (!scripts.some(s => s.src.endsWith('state.js') || s.src.endsWith('state.min.js'))
		&& !dom.window.document.querySelector('*')?.getAttributeNames().some(name => name.startsWith('state-'))) {
		return;
	}
	const stateJsCode = fs.readFileSync(path.join(ctx.extensionPath, 'resources', 'state.js'), 'utf8');
	const scriptEl = window.document.createElement("script");
	scriptEl.textContent = stateJsCode;
	dom.window.document.body.appendChild(scriptEl);

	const dTsContract = (<any>window.document).state.contract();

	fs.writeFileSync(`${document.fileName}.d.ts`, dTsContract);
}
