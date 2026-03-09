import { App, Modal, Setting } from 'obsidian';

export class ExportModal extends Modal {
	resultPath: string;
	exportProperties: boolean;
	onSubmit: (resultPath: string, exportProperties: boolean) => void;

	constructor(app: App, defaultPath: string, defaultExportProperties: boolean, onSubmit: (resultPath: string, exportProperties: boolean) => void) {
		super(app);
		this.resultPath = defaultPath;
		this.exportProperties = defaultExportProperties;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Export note to HTML" });

		new Setting(contentEl)
			.setName("Save to path")
			.setDesc("The path where the HTML file will be saved. Must include a file name.")
			.addText((text) =>
				text.setValue(this.resultPath)
				.onChange((value) => {
					this.resultPath = value;
				}));

		new Setting(contentEl)
			.setName("Export properties")
			.setDesc("Export frontmatter properties in HTML output.")
			.addToggle((toggle) => 
				toggle.setValue(this.exportProperties)
				.onChange((value) => {
					this.exportProperties = value;
				})
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Export")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.resultPath, this.exportProperties);
					}))
			.addButton((btn) => 
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
					}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
