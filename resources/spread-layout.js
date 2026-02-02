import { SPREADS } from './constants.js';
import { createEmptyPlaceholder } from './html-utils.js';

// Common logic for displaying a spread (used by both editor preview and standalone viewer)
export function setupSpreadLayout(container, spread, doc) {
	// Add empty placeholder before right page if no left page
	if (!spread.left && spread.right) {
		container.appendChild(createEmptyPlaceholder(doc));
	}

	// Move visible pages into container
	const visiblePages = [spread.left, spread.right].filter(Boolean);
	visiblePages.forEach(id => {
		const page = doc.getElementById(id);
		if (page) container.appendChild(page);
	});

	// Add empty placeholder after left page if no right page
	if (spread.left && !spread.right) {
		container.appendChild(createEmptyPlaceholder(doc));
	}
}

// Scale spread container to fit viewport
export function scaleSpreadToFit(container, doc, bottomPadding = 0) {
	const vw = doc.documentElement.clientWidth;
	const vh = doc.documentElement.clientHeight - bottomPadding;
	const spreadWidthPx = container.offsetWidth;
	const spreadHeightPx = container.offsetHeight;
	if (spreadWidthPx === 0 || spreadHeightPx === 0) return;
	const scaleX = (vw - 40) / spreadWidthPx;
	const scaleY = (vh - 40) / spreadHeightPx;
	const scale = Math.min(scaleX, scaleY);
	container.style.transform = `scale(${scale})`;
}
