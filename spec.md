# Technical Specification: 2HTML (v1.0)

## 1. Executive Summary
**2HTML** is a specialized Obsidian plugin designed to bridge the gap between internal "Reading View" and portable HTML. Unlike standard Markdown converters, this plugin uses a **DOM-Snapshot** approach to ensure that dynamic elements (Dataview, Mermaid, Multi-column CSS, and Plugin-injected UI) are captured exactly as they appear in the Obsidian interface.

## 2. Technical Lineage & Model
The plugin is architecturally modeled after the "DOM-copy" approach found in [obsidian-copy-as-html by mvdkwast](https://github.com/mvdkwast/obsidian-copy-as-html). **2HTML** extends this core concept by:
1. Automating the file creation and naming process directly within the vault.
2. Extracting and bundling the entire CSS environment (Core app.css + Active Theme + All Snippets).
3. Injecting critical Obsidian-specific `<body>` classes to trigger complex CSS selectors.
4. Hard-coding local assets (images) into Base64 strings for total offline portability.

## 3. Objectives
* **Visual Fidelity:** Achieve 1:1 parity with the Obsidian Reading View.
* **Zero Dependencies:** The output `.html` file must function correctly without an internet connection or an Obsidian installation.
* **Context Awareness:** Support for both full-note export and partial-selection export.

## 4. Requirements

### 4.1 Functional Requirements
* **Trigger:** A Command Palette entry: `2HTML: Export current note to HTML`.
* **Plugin API:** The plugin exposes an API accessible via `app.plugins.plugins['obsidian-2html-plugin'].api`.
    * `exportToHTML(options?: ExportOptions): Promise<void | string>`
    * It allows programmatic execution of exports with optional overrides:
        * `path`: Direct output path. If provided, the confirmation modal is skipped. If omitted, the HTML string is returned and no file is created.
        * `properties`: `null` to exclude all properties, `string[]` to export only specific properties. If `undefined`, falls back to user settings.
        * `selectionStart` and `selectionEnd`: Character offsets in the markdown file to export a specific text range. If provided, overrides active text selection.
* **View State Handling:** The export requires a fully rendered Reading View DOM. If triggered while in "Live Preview", the plugin must temporarily switch the view to "Reading View", await complete DOM rendering, execute the capture, and seamlessly switch back to "Live Preview".
* **Scope Detection:**
    * *Text Selection:* Extract the selected markdown and render it directly using `MarkdownRenderer.render`. This natively guarantees well-formed HTML (e.g., correctly wrapping list items) without fragile DOM traversal.
    * *No Selection:* Clone the entire `.markdown-reading-view` container.
* **Frontmatter Export:**
    * The header "Properties" above frontmatter shall never be exported.
    * "+ Add property" footer shall never be exported.
    * The `export_path` and `export_properties` properties shall never be exported.
    * Configurable via "Export properties" setting and pre-export modal toggle (defaults to setting).
    * If toggle is OFF:
        * Export only the properties listed in the `export_properties` property (excluding `export_properties` itself).
        * If `export_properties` is missing or empty, export no frontmatter at all.
* **Pathing & File Operations:**
    * **Cross-Platform Compatibility:** The plugin should work transparently on Windows, Linux, and MacOS. This is particularly important for path handling.
    * **Path Determination:** The path for the HTML to generate shall be determined as follows:
        1. Always ask in a modal before exporting with a folder selection and toggle for properties export.
        2. In the modal, take the value from the frontmatter property `export_path` as the default if it exists.
        3. Otherwise, use the plugin setting **Export Path** as the default.
        4. Set the value `{note_folder}/{note_name}` as the initial value. Note: Use Obsidian's built-in APIs (like `normalizePath`) to handle `/` on Windows transparently and keep it portable.
        5. For the setting and the property, resolve `{note_folder}` and `{note_name}` as variables. State them as allowed variables in the description of the settings field.
    * *Collision Strategy:* Silently overwrite the file if it already exists.
* **Asset Handling:** * Automatically convert all local image sources into Base64 Data URIs.
    * Transclusions and Embeds (e.g., `<iframe>` elements for YouTube or PDFs) should be kept as-is to preserve layout structure.

### 4.2 Structural Requirements (The Wrapper)
To ensure CSS rules (like those for Multi-column or Dataview) apply correctly, the exported HTML must be wrapped in a specific hierarchy that mimics Obsidian's internal DOM structure. 

*Note: The `{{Obsidian_Body_Classes}}` injection is vital for preserving the user's active theme toggles (e.g., `theme-dark` vs `theme-light`).*

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{Note Name}}</title>
    <style>{{Bundled_CSS}}</style>
</head>
<body class="{{Obsidian_Body_Classes}}" style="{{Obsidian_Body_Inline_Styles}}">
    <div class="app-container">
        <div class="horizontal-main-container">
            <div class="workspace">
                <div class="workspace-split">
                    <div class="workspace-leaf">
                        <div class="workspace-leaf-content">
                            <div class="view-content">
                                <div class="markdown-reading-view">
                                    <div class="markdown-rendered">
                                        {{EXPORTED_CONTENT}}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
```

## 5. Implementation Approach

### 5.1 The "Snapshot" Logic
1. **View Preparation:** Check `workspace.activeLeaf`. If in Live Preview, trigger the switch to Reading Mode and hook into the render completion event.
2. **Capture & Cleanse:** Access the `previewMode.containerEl` and create a deep clone. Strip out UI-only elements:
    * Remove `heading-collapse-indicator`.
    * Remove `copy-code-button`.
    * Remove `.edit-block-button` or plugin-specific "edit" icons.
3. **Context Extraction:** * Capture the full `className` string of the Obsidian `<body>` tag.
    * Capture any **inline styles** applied directly to the `<body>` tag (e.g., `<body style="--custom-width: 800px;">`) to ensure custom dynamic variables injected by themes/plugins are preserved.

### 5.2 CSS Extraction (Full-Bundle Strategy)
The plugin will iterate through `document.styleSheets` and:
* Include the core `app.css`.
* Include the active `theme.css`.
* Include all active CSS snippets from `.obsidian/snippets/`.
* **Evaluation:** The "Full Bundle" strategy is chosen over "Tree-Shaking" to ensure that complex CSS selectors (e.g., those using `:has()` or `:not()`) and dynamic plugin styles are not accidentally stripped.

### 5.3 Resource Encoding
* **Images & GIFs:** Scans all `<img>` tags. Instead of using `canvas.toDataURL()` (which freezes animated `.gif` files on their first frame), the plugin will use a `fetch()` call converted to a `Blob`, and then to a Base64 string via `FileReader`. This ensures exact file encodings and animations are preserved.
* **Mermaid/Charts:** Captures the final `<svg>` or `<canvas>` element generated by the respective plugins, ensuring diagrams remain crisp and scalable in the browser.

## 6. Logic Flow

| Step | Component | Action |
| :--- | :--- | :--- |
| **1** | **UI Controller** | Validates view mode. If Live Preview, temporarily toggles to Reading View and awaits complete DOM render. |
| **2** | **DOM Cloner** | Creates a deep clone of the target element. Resolves and wraps fragmented HTML trees if capturing a text selection. |
| **3** | **Style Scraper** | Reads `styleSheets`, extracts `body` classes/inline styles, and compiles a single string of CSS. |
| **4** | **Asset Processor** | Iterates through `src` attributes, executes `fetch()`, and replaces local paths with Base64 Data URIs. |
| **5** | **Compiler** | Injects the CSS, Classes, Inline Styles, and cloned DOM into the HTML5 Boilerplate. |
| **6** | **Writer / Cleanup** | Uses `app.vault.adapter.write` to silently overwrite/commit the file. Reverts the view back to Live Preview if it was temporarily toggled in Step 1. |

## 7. Known Constraints
* **Fonts:** System fonts are assumed. Custom `.woff2` files stored inside the vault will not be embedded in v1.0.
* **Interactivity:** Clickable elements that require the Obsidian internal event bus (like internal wikilinks) will be rendered as standard HTML anchors but may not resolve correctly offline.

## 8. Decision Log

- **Decision:** Use `MarkdownRenderer.render` for selection export instead of raw DOM cloning.
  - **Rationale:** Ensures clean, well-formed HTML without complex DOM traversal or view switching that clears the selection.
  - **Status:** Accepted

- **Decision:** Add keyboard submission (Enter) to the export modal.
  - **Rationale:** Improves user experience by allowing quick confirmation via keyboard instead of requiring a mouse click.
  - **Status:** Accepted

- **Decision:** Resolve Editor vs Reading View selection modes distinctly.
  - **Rationale:** The editor selection yields markdown sources (which are re-rendered cleanly via API), while Reading View selection (via `window.getSelection()`) yields rendered DOM directly. Mixing them caused plain text to be re-rendered as markdown, breaking Reading View selections.
  - **Status:** Accepted

- **Decision:** Attach selection render temp container to `document.body` and wait.
  - **Rationale:** Async block parsers (like Mermaid) require their target DOM element to actually be attached to the active document and visible (even if offscreen) to calculate bounding boxes and correctly render SVG dimensions before the clone can be extracted.
  - **Status:** Accepted

- **Decision:** Expose a programmatic Plugin API (`api.exportToHTML`) with `options.path` triggering "return HTML" if omitted.
  - **Rationale:** Encourages interoperability allowing other plugins to trigger customized HTML exports with specific paths, properties filtering, and subset selection bounds entirely unattended. By omitting the path, external scripts can grab the rendered HTML without Disk I/O.
  - **Status:** Accepted

- **Decision:** Override `user-select` styles on `body` and layout containers in exported HTML to allow text selection.
  - **Rationale:** Obsidian implicitly applies `user-select: none` to the app container to behave like a native app. This styling cascades to the exported HTML and prevents users from copying text from the generated file. Forcing `user-select: text` on the structural containers resolves this.
  - **Status:** Accepted
