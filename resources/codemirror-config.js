import { ZINE_BOILERPLATE, getBoilerplateCursorPos } from './constants.js';
import { loadContent, loadEditorSettings, saveEditorSetting } from './storage.js';
import { getAvailableFontFamilies } from './font-registry.js';

let lineNumbersCompartment;
let lineWrappingCompartment;
let showLineNumbers = false;
let enableLineWrapping = false;

// Font picker dropdown (custom, not CodeMirror autocompletion)

const fontFamilies = getAvailableFontFamilies();
let fontPickerState = null; // { from, to, selectedIndex, tooltip }
let updatePreviewCb = null;

function getFontValueRange(state) {
	const pos = state.selection.main.head;
	const line = state.doc.lineAt(pos);
	const text = line.text;
	const propMatch = text.match(/font-family:/i);
	if (!propMatch) return null;
	// anchorPos is right after "font-family:" (for dropdown positioning)
	const anchorPos = line.from + propMatch.index + propMatch[0].length;
	// valueStart skips any whitespace after the colon
	const afterColon = text.slice(propMatch.index + propMatch[0].length);
	const leadingSpace = afterColon.match(/^\s*/)[0].length;
	const valueStart = anchorPos + leadingSpace;
	const afterValue = text.slice(valueStart - line.from);
	const endMatch = afterValue.match(/^[^;"]*;?/);
	const valueEnd = valueStart + (endMatch ? endMatch[0].length : 0);
	return { from: valueStart, to: valueEnd, anchorPos };
}

function applyFont(view, fontName) {
	const range = getFontValueRange(view.state);
	if (!range) return;
	const needsSpace = range.from === range.anchorPos;
	const text = (needsSpace ? ' ' : '') + `'${fontName}';`;
	view.dispatch({
		changes: { from: range.from, to: range.to, insert: text },
		selection: { anchor: range.from + text.length },
	});
	// Immediate preview (bypass debounce)
	clearTimeout(window.updateTimer);
	if (updatePreviewCb) updatePreviewCb(view.state.doc.toString());
}

function openFontPicker(view) {
	fontPickerState = { selectedIndex: 0 };
	applyFont(view, fontFamilies[0]);
	renderFontPicker(view);
}

function closeFontPicker(view) {
	fontPickerState = null;
	const existing = document.querySelector('.font-picker-dropdown');
	if (existing) existing.remove();
}

function renderFontPicker(view) {
	if (!fontPickerState) return;

	let dropdown = document.querySelector('.font-picker-dropdown');
	if (!dropdown) {
		dropdown = document.createElement('div');
		dropdown.className = 'font-picker-dropdown';
		document.getElementById('editor').appendChild(dropdown);
	}

	// Position anchored to right after "font-family:"
	const range = getFontValueRange(view.state);
	const anchorCoords = range && view.coordsAtPos(range.anchorPos);
	if (anchorCoords) {
		const editorRect = view.dom.getBoundingClientRect();
		dropdown.style.left = `${anchorCoords.left - editorRect.left}px`;
		dropdown.style.top = `${anchorCoords.bottom - editorRect.top + 4}px`;
	}

	// Build list
	dropdown.innerHTML = '';
	const ul = document.createElement('ul');
	fontFamilies.forEach((font, i) => {
		const li = document.createElement('li');
		li.textContent = font;
		if (i === fontPickerState.selectedIndex) li.classList.add('selected');
		li.addEventListener('mousedown', (e) => {
			e.preventDefault();
			fontPickerState.selectedIndex = i;
			applyFont(view, font);
			closeFontPicker(view);
		});
		ul.appendChild(li);
	});
	dropdown.appendChild(ul);

	// Scroll selected into view
	const selectedLi = ul.children[fontPickerState.selectedIndex];
	if (selectedLi) selectedLi.scrollIntoView({ block: 'nearest' });
}

function moveFontPickerSelection(view, delta) {
	if (!fontPickerState) return false;
	const newIndex = fontPickerState.selectedIndex + delta;
	if (newIndex < 0 || newIndex >= fontFamilies.length) return true;
	fontPickerState.selectedIndex = newIndex;
	applyFont(view, fontFamilies[newIndex]);
	renderFontPicker(view);
	return true;
}

export function toggleLineNumbers(editorView) {
	const {lineNumbers} = window.CodeMirror;
	showLineNumbers = !showLineNumbers;
	saveEditorSetting('zine-editor-line-numbers', showLineNumbers);
	editorView.dispatch({
		effects: lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : [])
	});
}

function createLineWrappingExtension() {
	const {EditorView, Decoration} = window.CodeMirror;

	return [
		EditorView.lineWrapping,
		EditorView.decorations.of((view) => {
			const decorations = [];
			for (let {from, to} of view.visibleRanges) {
				for (let pos = from; pos <= to;) {
					const line = view.state.doc.lineAt(pos);
					const lineText = line.text;
					let indentChars = 0;
					for (let i = 0; i < lineText.length; i++) {
						if (lineText[i] === '\t') {
							indentChars += 2;
						} else if (lineText[i] === ' ') {
							indentChars += 1;
						} else {
							break;
						}
					}
					if (indentChars > 0) {
						const indentDecoration = Decoration.line({
							attributes: {
								style: `text-indent: -${indentChars}ch; padding-left: calc(${indentChars}ch + 6px);`
							}
						});
						decorations.push(indentDecoration.range(line.from));
					}
					pos = line.to + 1;
				}
			}
			return decorations.length > 0 ? Decoration.set(decorations) : Decoration.none;
		}),
	];
}

export function toggleLineWrapping(editorView) {
	enableLineWrapping = !enableLineWrapping;
	saveEditorSetting('zine-editor-line-wrapping', enableLineWrapping);
	const lineWrappingExtension = enableLineWrapping ? createLineWrappingExtension() : [];
	editorView.dispatch({
		effects: lineWrappingCompartment.reconfigure(lineWrappingExtension)
	});
}

// Initialize CodeMirror
export async function initializeCodeMirror(saveToStorageCallback, updatePreviewCallback) {
	if (!window.CodeMirror) {
		setTimeout(() => initializeCodeMirror(saveToStorageCallback, updatePreviewCallback), 100);
		return;
	}

	updatePreviewCb = updatePreviewCallback;

	const {EditorView, EditorState, Compartment, keymap, defaultKeymap, indentWithTab, html, githubDark, indentUnit, placeholder, undo, redo, history, closeBrackets, search, searchKeymap, lineNumbers} = window.CodeMirror;

	const customPhrases = EditorState.phrases.of({
		"Find": "Find..."
	});

	const { content: savedContent, isBoilerplate } = await loadContent();
	const settings = loadEditorSettings();
	showLineNumbers = settings.showLineNumbers;
	enableLineWrapping = settings.enableLineWrapping;

	lineNumbersCompartment = new Compartment();
	lineWrappingCompartment = new Compartment();

	const initialLineWrappingExtension = enableLineWrapping ? createLineWrappingExtension() : [];

	const stateConfig = {
		doc: savedContent,
		extensions: [
			customPhrases,
			history(),
			search(),
			closeBrackets(),
			keymap.of([
				// Font picker keys (only active when picker is open)
				{key: "ArrowDown", run: (view) => moveFontPickerSelection(view, 1)},
				{key: "ArrowUp", run: (view) => moveFontPickerSelection(view, -1)},
				{key: "Enter", run: (view) => {
					if (!fontPickerState) return false;
					closeFontPicker(view);
					return true;
				}},
				{key: "Escape", run: (view) => {
					if (!fontPickerState) return false;
					closeFontPicker(view);
					return true;
				}},
				{key: "Mod-z", run: undo},
				{key: "Mod-y", run: redo},
				{key: "Mod-Shift-z", run: redo},
				{key: "Mod-o", run: () => { window.loadFile(); return true; }},
				{key: "Mod-s", run: () => { window.saveFile(); return true; }},
				{key: "F1", run: (view) => { toggleLineNumbers(view); return true; }},
				{key: "F2", run: (view) => { toggleLineWrapping(view); return true; }},
				indentWithTab,
				...searchKeymap.filter(binding => binding.key !== "Mod-f"),
				...defaultKeymap
			]),
			html(),
			// Detect when user types "font-family:" and open the picker
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					const content = update.state.doc.toString();
					clearTimeout(window.updateTimer);
					window.updateTimer = setTimeout(() => updatePreviewCallback(content), 600);
					saveToStorageCallback(content);

					// Check if cursor is right after font-family:
					if (!fontPickerState) {
						const range = getFontValueRange(update.state);
						if (range) {
							const valueText = update.state.doc.sliceString(range.from, range.to).trim();
							if (valueText === '' || valueText === ';') {
								openFontPicker(update.view);
							}
						}
					}
				}
				// Close picker if cursor moves away from font-family line
				if (fontPickerState && update.selectionSet) {
					const range = getFontValueRange(update.state);
					if (!range) closeFontPicker(update.view);
				}
			}),
			EditorView.inputHandler.of((view, from, to, text) => {
				if (text !== '>') return false;
				const before = view.state.doc.sliceString(Math.max(0, from - 20), from);
				if (before.endsWith('<!')) {
					const startPos = from - 2;
					view.dispatch({
						changes: { from: startPos, to: from, insert: ZINE_BOILERPLATE },
						selection: { anchor: getBoilerplateCursorPos(startPos) }
					});
					return true;
				}
				const match = before.match(/<(style|script)(\s[^>]*)?$/i);
				if (!match) return false;
				const tagName = match[1].toLowerCase();
				const closingTag = `</${tagName}>`;
				view.dispatch({
					changes: { from, to, insert: '>' + closingTag },
					selection: { anchor: from + 1 }
				});
				return true;
			}),
			githubDark,
			indentUnit.of("\t"),
			placeholder("Type <!> to insert zine boilerplate..."),
			EditorView.contentAttributes.of({
				'autocomplete': 'off',
				'autocorrect': 'off',
				'autocapitalize': 'off',
				'spellcheck': 'false'
			}),
			lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
			lineWrappingCompartment.of(initialLineWrappingExtension)
		]
	};

	const editorView = new EditorView({
		state: EditorState.create(stateConfig),
		parent: document.getElementById('editor')
	});

	if (isBoilerplate) {
		editorView.dispatch({
			selection: { anchor: getBoilerplateCursorPos() }
		});
	}

	// Disable browser autocomplete on search panel inputs
	const editorElement = document.getElementById('editor');
	const searchInputObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const searchInputs = node.querySelectorAll?.('.cm-search input[name="search"], .cm-search input[name="replace"]');
					searchInputs?.forEach(input => input.setAttribute('autocomplete', 'off'));
				}
			}
		}
	});
	searchInputObserver.observe(editorElement, { childList: true, subtree: true });

	return editorView;
}
