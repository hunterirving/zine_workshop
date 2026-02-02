import { SPREADS } from './constants.js';

// State
let currentSpread = 0;
let isFullscreen = false;

// Get current spread index
export function getCurrentSpread() {
	return currentSpread;
}

// Set current spread index
export function setCurrentSpread(index) {
	currentSpread = index;
}

// Get fullscreen state
export function getIsFullscreen() {
	return isFullscreen;
}

// Set fullscreen state
export function setIsFullscreen(value) {
	isFullscreen = value;
}

// Update spread indicator and button states
export function updateSpreadIndicator() {
	const indicator = document.getElementById('spreadIndicator');
	const prevBtn = document.getElementById('prevSpread');
	const nextBtn = document.getElementById('nextSpread');

	indicator.textContent = SPREADS[currentSpread].label;
	prevBtn.disabled = currentSpread === 0;
	nextBtn.disabled = currentSpread === SPREADS.length - 1;
}

// Navigate between spreads
export function navigateSpread(delta, updatePreviewCallback) {
	const newSpread = currentSpread + delta;
	if (newSpread >= 0 && newSpread < SPREADS.length) {
		currentSpread = newSpread;
		updateSpreadIndicator();
		updatePreviewCallback();
		// Refocus preview so keyboard navigation continues to work
		document.getElementById('preview').focus();
	}
}

// Fullscreen toggle
export function toggleFullscreen(updatePreviewCallback) {
	isFullscreen = !isFullscreen;
	const editorPane = document.querySelector('.editor-pane');
	const previewPane = document.querySelector('.preview-pane');
	const preview = document.getElementById('preview');

	if (isFullscreen) {
		previewPane.classList.add('fullscreen');
		editorPane.classList.add('hidden');
		preview.style.height = window.innerHeight + 'px';
	} else {
		previewPane.classList.remove('fullscreen');
		editorPane.classList.remove('hidden');
		preview.style.height = '';
	}

	try {
		const toggleButton = preview.contentDocument.getElementById('fullscreenToggle');
		if (toggleButton) {
			toggleButton.title = isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen';
		}
	} catch (e) {}

	// Trigger resize after layout updates so scaleToFit() recalculates
	requestAnimationFrame(() => {
		try {
			preview.contentWindow.dispatchEvent(new Event('resize'));
		} catch (e) {}
	});
}

// Initialize spread navigation UI
export function initializeSpreadNav(navigateCallback) {
	document.getElementById('prevSpread').addEventListener('click', () => navigateCallback(-1));
	document.getElementById('nextSpread').addEventListener('click', () => navigateCallback(1));
	updateSpreadIndicator();
}
