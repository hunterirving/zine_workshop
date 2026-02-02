import { insertAfterHead, insertBeforeHeadClose } from './html-utils.js';
import { generateViewerCode } from './viewer-generator.js';
import { saveToStorage } from './storage.js';
import { setCurrentSpread, updateSpreadIndicator } from './spread-navigation.js';

// File operations
function downloadHtmlFile(content, filename = 'my-zine.html') {
	const blob = new Blob([content], { type: 'text/html' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function saveFile(getEditorContent) {
	downloadHtmlFile(getEditorContent());
}

export function saveFileWithViewer(getEditorContent) {
	const code = getEditorContent();
	const { css, js } = generateViewerCode();

	// Check if code has proper head tags
	const hasHead = /<head[^>]*>/i.test(code) && /<\/head>/i.test(code);

	let processedCode;
	if (hasHead) {
		// Inject viewer CSS at START of head (so user styles take precedence for page content)
		// Inject viewer JS at END of head (needs to run after DOM is ready)
		processedCode = insertAfterHead(code, `\n<style id="zine-viewer-css">${css}</style>`);
		processedCode = insertBeforeHeadClose(processedCode, `<script id="zine-viewer-js">${js}<\/script>\n`);
	} else {
		// No proper head found, wrap content
		processedCode = `<!DOCTYPE html>\n<html>\n<head>\n<style id="zine-viewer-css">${css}</style>\n<script id="zine-viewer-js">${js}<\/script>\n</head>\n<body>\n${code}\n</body>\n</html>`;
	}

	downloadHtmlFile(processedCode);
}

export function loadFile(editorView, updatePreviewCallback) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.html,.htm';
	input.onchange = function(event) {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = function(e) {
			editorView.dispatch({
				changes: { from: 0, to: editorView.state.doc.length, insert: e.target.result }
			});
			saveToStorage(e.target.result);
			setCurrentSpread(0);
			updateSpreadIndicator();
			updatePreviewCallback();
		};
		reader.readAsText(file);
	};
	input.click();
}
