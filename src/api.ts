/**
 * Options for exporting an Obsidian note to HTML programmatically.
 */
export interface ExportOptions {
	/**
	 * The absolute or vault-relative path where the HTML file should be saved.
	 * If omitted, the HTML string is returned and no file is created.
	 */
	path?: string;

	/**
	 * A list of frontmatter property keys to include in the export.
	 * Pass `null` to exclude all properties.
	 * If omitted, falls back to the user's plugin settings.
	 */
	properties?: string[] | null;

	/**
	 * Character offset for the start of the text selection to export.
	 * Overrides the active editor selection.
	 */
	selectionStart?: number;

	/**
	 * Character offset for the end of the text selection to export.
	 * Overrides the active editor selection.
	 */
	selectionEnd?: number;
}

export interface HTML2PluginAPI {
	/**
	 * Triggers the HTML export process.
	 * @param options Output overrides for path, properties, and text selection.
	 * @returns A Promise that resolves to the generated HTML string if `options.path` is omitted, or `void` if a file is successfully written.
	 */
	exportToHTML(options?: ExportOptions): Promise<void | string>;
}
