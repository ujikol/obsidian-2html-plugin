// DOM reading and handling logic

import { App, MarkdownView } from 'obsidian';

export async function getTargetDOM(app: App): Promise<HTMLElement | null> {
	// Find reading view or selection
	const activeView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeView) return null;

	const state = activeView.getState();
	const wasSource = state.mode === 'source';

	// Inject CSS to force full render & disable culling
	const styleEl = document.createElement('style');
	styleEl.id = 'obsidian-2html-force-render-style';
	styleEl.textContent = `
		.workspace-leaf-content,
		.view-content,
		.markdown-reading-view,
		.markdown-rendered {
			height: auto !important;
			overflow: visible !important;
			contain: none !important;
		}
	`;
	document.head.appendChild(styleEl);

	if (wasSource) {
		// Switch to reading mode temporarily to force DOM render
		state.mode = 'preview';
		await activeView.setState(state, { history: false });
	}

	// Wait for the render loop to finish attaching complex elements.
	// A timeout is the safest fallback without digging into undocumented Obsidian internals.
	// 1500ms allows sufficient time for long documents to render completely
	await new Promise(resolve => setTimeout(resolve, 1500));

	const container = activeView.contentEl.querySelector('.markdown-reading-view .markdown-rendered') as HTMLElement;
	let result = null;
	if (container) {
		result = container.cloneNode(true) as HTMLElement;
		
		// cloneNode(true) does not copy the dynamic value property of input/textarea elements.
		// We must explicitly copy these values to their HTML attributes in the cloned DOM.
		const originalInputs = container.querySelectorAll('input, select, textarea');
		const clonedInputs = result.querySelectorAll('input, select, textarea');
		originalInputs.forEach((el: any, index: number) => {
			const clonedEl = clonedInputs[index] as any;
			if (clonedEl) {
				if (el.value) {
					clonedEl.setAttribute('value', el.value);
					// For textareas, innerHTML/textContent represents the value
					if (el.tagName.toLowerCase() === 'textarea') {
						clonedEl.textContent = el.value;
					}
				}
				if (el.type === 'checkbox' && el.checked) {
					clonedEl.setAttribute('checked', 'checked');
				}
			}
		});
	}

	if (wasSource) {
		// Revert back so the user isn't disrupted
		state.mode = 'source';
		await activeView.setState(state, { history: false });
	}

	// Cleanup the injected style
	styleEl.remove();

	return result;
}

export function getActiveCSS(): string {
	let css = "";
	// Gather all stylesheet contents
	for (let i = 0; i < document.styleSheets.length; i++) {
		const sheet = document.styleSheets[i];
		try {
			if (sheet.cssRules) {
				for (let j = 0; j < sheet.cssRules.length; j++) {
					css += sheet.cssRules[j].cssText + "\n";
				}
			}
		} catch (e) {
			// Cross-origin stylesheet access might be blocked, usually Obsidian's are local
			console.warn("Could not read stylesheet", e);
		}
	}
	return css;
}

export function getBodyClasses(): string {
	return document.body.className;
}

export function getBodyStyles(): string {
	return document.body.getAttribute('style') || "";
}
