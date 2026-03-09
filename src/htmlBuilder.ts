import { App, Notice, normalizePath } from 'obsidian';
import { getTargetDOM, getActiveCSS, getBodyClasses, getBodyStyles } from './domUtils';
import { processImagesToBase64 } from './assetProcessor';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export async function exportNoteToHTML(app: App, targetName: string, exportPath: string, exportProperties: boolean, frontmatter: any) {
    const targetDOM = await getTargetDOM(app);
    if (!targetDOM) {
        throw new Error("Could not find a rendered DOM context to export. Ensure you are in Reading View or have the note open.");
    }
    
    // Sanity Check: If the generated DOM has virtually no content except Obsidian's empty spacer, it failed.
    if (targetDOM.textContent?.trim() === "" && targetDOM.querySelectorAll('img, iframe, .math').length === 0) {
        throw new Error("The captured DOM appears empty. The view may not have finished rendering yet.");
    }

    // Frontmatter processing
    const metadataContainer = targetDOM.querySelector('.metadata-container');
    if (metadataContainer) {
        // 1. The header "Properties" above frontmatter shall never be exported.
        targetDOM.querySelectorAll('.metadata-properties-heading').forEach(el => el.remove());
        // 2. "+ Add property" footer shall never be exported
        targetDOM.querySelectorAll('.metadata-add-button').forEach(el => el.remove());

        // Always exclude export_path and export_properties properties
        targetDOM.querySelectorAll('.metadata-property').forEach(el => {
            const key = el.getAttribute('data-property-key')?.toLowerCase();
            if (key === 'export_path' || key === 'export_properties') {
                el.remove();
            }
        });

        if (!exportProperties) {
            const exportPropsProp = frontmatter?.['export_properties'];
            let propertiesToKeep: string[] = [];

            if (exportPropsProp) {
                if (Array.isArray(exportPropsProp)) {
                    propertiesToKeep = exportPropsProp.map(p => String(p).toLowerCase());
                } else if (typeof exportPropsProp === 'string') {
                    propertiesToKeep = exportPropsProp.split(',').map(p => p.trim().toLowerCase());
                }
            }

            if (propertiesToKeep.length === 0) {
                // 6. If there is no "export_properties" property or it is empty then export no frontmatter.
                metadataContainer.remove();
            } else {
                // 5. If off then export only the properties listed in the "export_properties" excluding that property itself.
                targetDOM.querySelectorAll('.metadata-property').forEach(el => {
                    const key = el.getAttribute('data-property-key')?.toLowerCase();
                    if (!key || !propertiesToKeep.includes(key)) {
                        el.remove();
                    }
                });
            }
        }
        
        // If no properties left to show, remove the container
        if (targetDOM.querySelectorAll('.metadata-property').length === 0) {
            metadataContainer.remove();
        }
    }

    // Process images
    await processImagesToBase64(app, targetDOM);

    const css = getActiveCSS();
    const bodyClasses = getBodyClasses();
    const bodyStyles = getBodyStyles();
    
    // Spec.md wrapper format
    const completeHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${targetName}</title>
    <style>
    /* injected base visibility fixes */
    html, body {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: auto !important;
    }
    .app-container, .horizontal-main-container, .workspace, .workspace-split, .workspace-leaf, .workspace-leaf-content, .view-content {
        height: 100%;
        width: 100%;
    }
    .markdown-reading-view {
        height: 100%;
        width: 100%;
        overflow-y: auto !important;
        padding: 2em; /* Ensure some breathing room */
    }
    </style>
    <style>${css}</style>
</head>
<body class="${bodyClasses}" style="${bodyStyles}">
    <div class="app-container">
        <div class="horizontal-main-container">
            <div class="workspace">
                <div class="workspace-split">
                    <div class="workspace-leaf">
                        <div class="workspace-leaf-content">
                            <div class="view-content">
                                <div class="markdown-reading-view">
                                    <div class="markdown-rendered">
                                        ${targetDOM.innerHTML}
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
</html>`;

    // Save out
    let finalPath = exportPath;

    // Expand ~ to user home directory
    if (finalPath.startsWith('~/') || finalPath.startsWith('~\\')) {
        finalPath = path.join(os.homedir(), finalPath.slice(2));
    }

    if (path.isAbsolute(finalPath)) {
        // Absolute system path => use Node fs
        const dir = path.dirname(finalPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.writeFile(finalPath, completeHTML, 'utf8');
    } else {
        // Vault-relative path => use Obsidian API
        let vaultPath = normalizePath(finalPath);
        if (vaultPath.startsWith('/')) {
            vaultPath = vaultPath.substring(1);
        }

        const existingFile = app.vault.getAbstractFileByPath(vaultPath);
        if (existingFile) {
            await app.vault.delete(existingFile);
        }
        
        // Ensure parent folders exist
        const folders = vaultPath.split('/');
        let currentPath = '';
        
        for (let i = 0; i < folders.length - 1; i++) {
            currentPath += (currentPath === '' ? '' : '/') + folders[i];
            if (!app.vault.getAbstractFileByPath(currentPath)) {
                await app.vault.createFolder(currentPath);
            }
        }

        await app.vault.create(vaultPath, completeHTML);
    }
}
