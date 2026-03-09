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
* **View State Handling:** The export requires a fully rendered Reading View DOM. If triggered while in "Live Preview", the plugin must temporarily switch the view to "Reading View", await complete DOM rendering, execute the capture, and seamlessly switch back to "Live Preview".
* **Scope Detection:**
    * *Text Selection:* Clone only the selected DOM nodes. **Crucial:** The plugin must traverse up the DOM to wrap partial selections in their immediate parent block-level elements (e.g., ensuring selected `<li>` elements are properly enclosed in a `<ul>` or `<ol>`) to prevent malformed HTML.
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
- **Decision:** Use an rsync-based script (`sync-public.sh`) to publish releases to the public GitHub repository while maintaining an isolated private repository server.
  - **Rationale:** Protects the `.agent` history and other private files from entering the public namespace. The script auto-commits changes, checks the `manifest.json` version, and pushes a semver Git tag (`vX.Y.Z`) on new versions to trigger a GitHub Action release (`release.yml`). `2html-dev-vault` will be included in the public sync.
  - **Status:** Accepted