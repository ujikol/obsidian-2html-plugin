import { App, PluginSettingTab, Setting } from 'obsidian';
import HTML2Plugin from './main';

export interface HTML2PluginSettings {
	exportPath: string;
	exportProperties: boolean;
}

export const DEFAULT_SETTINGS: HTML2PluginSettings = {
	exportPath: '{note_folder}/{note_name}',
	exportProperties: false
}

export class HTML2SettingTab extends PluginSettingTab {
	plugin: HTML2Plugin;

	constructor(app: App, plugin: HTML2Plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Export Path')
			.setDesc('Default path for exporting HTML. Allowed variables: {note_folder}, {note_name}. E.g.: ~/Downloads/{note_folder}/{note_name}')
			.addText(text => text
				.setPlaceholder('{note_folder}/{note_name}')
				.setValue(this.plugin.settings.exportPath)
				.onChange(async (value) => {
					this.plugin.settings.exportPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export properties')
			.setDesc('Export frontmatter properties. If disabled, exports no properties unless the note frontmatter contains "export_properties" mapping which properties to keep.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.exportProperties)
				.onChange(async (value) => {
					this.plugin.settings.exportProperties = value;
					await this.plugin.saveSettings();
				}));
	}
}
