import { Plugin, Notice, normalizePath, TFile, FileSystemAdapter } from 'obsidian';
import { exportNoteToHTML } from './htmlBuilder';
import { HTML2PluginSettings, DEFAULT_SETTINGS, HTML2SettingTab } from './settings';
import { ExportModal } from './exportModal';
import { HTML2PluginAPI, ExportOptions } from './api';
import * as path from 'path';

export default class HTML2Plugin extends Plugin {
	settings: HTML2PluginSettings;
	api: HTML2PluginAPI;

	async onload() {
		await this.loadSettings();

		this.api = {
			exportToHTML: async (options?: ExportOptions) => {
				await this.exportViaAPI(options);
			}
		};

		this.addSettingTab(new HTML2SettingTab(this.app, this));

		this.addCommand({
			id: 'export-current-note-to-html',
			name: 'Export current note to HTML',
			callback: () => this.handleExportAction()
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	resolvePath(template: string, file: TFile): string {
		const relativeFolder = file.parent && file.parent.path !== '/' ? file.parent.path : '';
		const basename = file.basename;
		
		let resolved = template;
		
		if (resolved.toLowerCase().startsWith('{note_folder}')) {
			let basePath = '';
			if (this.app.vault.adapter instanceof FileSystemAdapter) {
				basePath = this.app.vault.adapter.getBasePath();
			}
			const absoluteFolder = basePath ? path.join(basePath, relativeFolder) : relativeFolder;
			// Replace only the first {note_folder} with the absolute path
			resolved = absoluteFolder + resolved.substring('{note_folder}'.length);
		}
		
		resolved = resolved
			.replace(/{note_folder}/gi, relativeFolder)
			.replace(/{note_name}/gi, basename);
		
		return resolved;
	}

	async handleExportAction() {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice("No active file found to export.");
				return;
			}

			const cache = this.app.metadataCache.getFileCache(activeFile);
			const frontmatter = cache?.frontmatter;

			// 1. Resolve default path (Frontmatter > Settings)
			let defaultPath = '';
			if (frontmatter && frontmatter['export_path']) {
				defaultPath = this.resolvePath(frontmatter['export_path'], activeFile);
			} else {
				defaultPath = this.resolvePath(this.settings.exportPath, activeFile);
			}

			if (!defaultPath.toLowerCase().endsWith('.html')) {
				defaultPath += '.html';
			}

			// 2. Open Modal (Always)
			new ExportModal(this.app, defaultPath, this.settings.exportProperties, async (resultPath, exportProperties) => {
				let finalPath = resultPath; // Keep as-is to allow absolute paths
				if (!finalPath.toLowerCase().endsWith('.html')) {
					finalPath += '.html';
				}
				await this.executeExport(activeFile.basename, finalPath, exportProperties, frontmatter);
			}).open();

		} catch (error) {
			console.error("Export Error:", error);
			new Notice(`Export failed: ${error.message}`);
		}
	}

	async exportViaAPI(options?: ExportOptions) {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice("No active file found to export.");
				return;
			}

			const cache = this.app.metadataCache.getFileCache(activeFile);
			const frontmatter = cache?.frontmatter;

			let customSelection: string | undefined;
			if (options && typeof options.selectionStart === 'number' && typeof options.selectionEnd === 'number') {
				const fileContent = await this.app.vault.read(activeFile);
				customSelection = fileContent.substring(options.selectionStart, options.selectionEnd);
			}

			let exportProperties: boolean | string[] | null = this.settings.exportProperties;
			if (options && options.properties !== undefined) {
				exportProperties = options.properties;
			}

			let targetPath: string | undefined = undefined;
			if (options && options.path !== undefined) {
				targetPath = options.path;
			} else if (!options || !('path' in options)) {
				// Only default if 'path' wasn't intentionally omitted (e.g. they called it without options)
				// Wait, if they omit it in ExportOptions, we should just not write to a file
				// The spec says: "If omitted, the HTML string is returned and no file is created."
				targetPath = undefined;
			}

			if (targetPath !== undefined && !targetPath.toLowerCase().endsWith('.html')) {
				targetPath += '.html';
			}

			return await this.executeExport(activeFile.basename, targetPath, exportProperties, frontmatter, customSelection);
		} catch (error) {
			console.error("Export via API Error:", error);
			new Notice(`Export failed: ${error.message}`);
		}
	}

	async executeExport(title: string, path: string | undefined, exportProperties: boolean | string[] | null, frontmatter: any, customSelection?: string): Promise<string | void> {
		try {
			const html = await exportNoteToHTML(this.app, title, path, exportProperties, frontmatter, customSelection);
			if (path !== undefined) {
				new Notice(`Successfully exported to HTML: ${path}`);
				return;
			} else {
				return html;
			}
		} catch (error) {
			console.error("Export failed:", error);
			new Notice(`Export failed: ${error.message}`);
		}
	}
}
