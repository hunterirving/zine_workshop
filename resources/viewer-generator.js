import { PAGE_IDS, SPREADS, NAV_HEIGHT, NAV_BUTTON_CSS, NAV_BUTTON_STYLES } from './constants.js';
import { ZINE_PAGE_CSS, ZINE_PRINT_CSS } from './zine-styles.js';

// Generate standalone viewer CSS and JS (matches preview pane rendering)
export function generateViewerCode() {
	const css = `
		* { margin: 0; padding: 0; box-sizing: border-box; }

		@media screen {
			html, body {
				height: 100% !important;
				overflow: hidden !important;
			}
			body {
				background: linear-gradient(to top, #2a2a2a, #3a3a3a) !important;
				display: flex !important;
				justify-content: center !important;
				align-items: center !important;
				padding-bottom: ${NAV_HEIGHT}px !important;
			}
			body > *:not(.zine-spread-container):not(.zine-nav) {
				display: none !important;
			}
			${ZINE_PAGE_CSS}
			.zine-spread-container {
				display: flex !important;
				position: relative;
			}
			.zine-nav {
				position: fixed;
				bottom: 0;
				left: 0;
				right: 0;
				height: ${NAV_HEIGHT}px;
				${NAV_BUTTON_CSS}
				background: transparent;
			}
			.zine-nav button {
				${NAV_BUTTON_STYLES}
			}
			.zine-nav button:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
			.zine-nav button:disabled { opacity: 0.3; cursor: default; }
			.zine-nav span { color: white; font-size: 14px; min-width: 100px; text-align: center; font-family: monospace; }
		}

		@media print {
			${ZINE_PRINT_CSS}
		}

		/* Hide content when viewport is very short */
		@media screen and (max-height: 200px) {
			.zine-spread-container, .zine-nav {
				display: none !important;
			}
		}
	`;

	// Serialize SPREADS array for the viewer
	const spreadsJson = JSON.stringify(SPREADS);
	const pageIdsJson = JSON.stringify(PAGE_IDS);

	const js = `
		const SPREADS = ${spreadsJson};
		const PAGE_IDS = ${pageIdsJson};
		const NAV_HEIGHT = ${NAV_HEIGHT};
		let currentSpread = 0;
		let container;

		function scaleToFit() {
			if (!container) return;
			const vw = document.documentElement.clientWidth;
			const vh = document.documentElement.clientHeight - NAV_HEIGHT;
			const spreadWidthPx = container.offsetWidth;
			const spreadHeightPx = container.offsetHeight;
			if (spreadWidthPx === 0 || spreadHeightPx === 0) return;
			const scaleX = (vw - 40) / spreadWidthPx;
			const scaleY = (vh - 40) / spreadHeightPx;
			const scale = Math.min(scaleX, scaleY);
			container.style.transform = 'scale(' + scale + ')';
		}

		function showSpread(index) {
			const spread = SPREADS[index];
			const visible = [spread.left, spread.right].filter(Boolean);

			// Move existing pages back to body before clearing container
			PAGE_IDS.forEach(id => {
				const page = document.getElementById(id);
				if (page) {
					page.style.display = 'none';
					document.body.appendChild(page);
				}
			});

			container.innerHTML = '';

			if (!spread.left && spread.right) {
				const empty = document.createElement('div');
				empty.className = 'zine-empty';
				container.appendChild(empty);
			}

			visible.forEach(id => {
				const el = document.getElementById(id);
				if (el) {
					el.style.display = 'block';
					container.appendChild(el);
				}
			});

			if (spread.left && !spread.right) {
				const empty = document.createElement('div');
				empty.className = 'zine-empty';
				container.appendChild(empty);
			}

			document.getElementById('zine-indicator').textContent = spread.label;
			document.getElementById('zine-prev').disabled = index === 0;
			document.getElementById('zine-next').disabled = index === SPREADS.length - 1;
			scaleToFit();
		}

		function navigate(delta) {
			const newIndex = currentSpread + delta;
			if (newIndex >= 0 && newIndex < SPREADS.length) {
				currentSpread = newIndex;
				showSpread(currentSpread);
			}
		}

		document.addEventListener('DOMContentLoaded', () => {
			container = document.createElement('div');
			container.className = 'zine-spread-container';
			document.body.appendChild(container);

			const nav = document.createElement('div');
			nav.className = 'zine-nav';
			nav.innerHTML = '<button id="zine-prev" title="Previous spread">\\u2190</button><span id="zine-indicator"></span><button id="zine-next" title="Next spread">\\u2192</button>';
			document.body.appendChild(nav);

			document.getElementById('zine-prev').addEventListener('click', () => navigate(-1));
			document.getElementById('zine-next').addEventListener('click', () => navigate(1));

			document.addEventListener('keydown', e => {
				if (e.key === 'ArrowLeft') navigate(-1);
				else if (e.key === 'ArrowRight') navigate(1);
				else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
					e.preventDefault();
					window.print();
				}
				else if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'e')) {
					e.preventDefault();
					// Re-download this viewer file (clean version without dynamic elements)
					// Move pages back to body and remove dynamic elements temporarily
					PAGE_IDS.forEach(id => {
						const page = document.getElementById(id);
						if (page) {
							page.style.display = '';
							document.body.appendChild(page);
						}
					});
					const tempContainer = document.querySelector('.zine-spread-container');
					const tempNav = document.querySelector('.zine-nav');
					if (tempContainer) tempContainer.remove();
					if (tempNav) tempNav.remove();

					const html = '<!DOCTYPE html>' + document.documentElement.outerHTML;

					// Restore dynamic elements
					const newContainer = document.createElement('div');
					newContainer.className = 'zine-spread-container';
					document.body.appendChild(newContainer);
					container = newContainer;

					const newNav = document.createElement('div');
					newNav.className = 'zine-nav';
					newNav.innerHTML = '<button id="zine-prev" title="Previous spread">\\u2190</button><span id="zine-indicator"></span><button id="zine-next" title="Next spread">\\u2192</button>';
					document.body.appendChild(newNav);
					document.getElementById('zine-prev').addEventListener('click', () => navigate(-1));
					document.getElementById('zine-next').addEventListener('click', () => navigate(1));

					showSpread(currentSpread);

					const blob = new Blob([html], { type: 'text/html' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'my-zine.html';
					a.click();
					URL.revokeObjectURL(url);
				}
			});

			window.addEventListener('resize', scaleToFit);

			showSpread(0);
		});
	`;

	return { css, js };
}
