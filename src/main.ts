import { Plugin, Notice, normalizePath, TFile, FileSystemAdapter } from 'obsidian';
import { exportNoteToHTML } from './htmlBuilder';
import { HTML2PluginSettings, DEFAULT_SETTINGS, HTML2SettingTab } from './settings';
import { ExportModal } from './exportModal';
import * as path from 'path';

export default class HTML2Plugin extends Plugin {
	settings: HTML2PluginSettings;

	async onload() {
		await this.loadSettings();

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

	async executeExport(title: string, path: string, exportProperties: boolean, frontmatter: any) {
		try {
			await exportNoteToHTML(this.app, title, path, exportProperties, frontmatter);
			new Notice(`Successfully exported to HTML: ${path}`);
		} catch (error) {
			console.error("Export failed:", error);
			new Notice(`Export failed: ${error.message}`);
		}
	}
}
