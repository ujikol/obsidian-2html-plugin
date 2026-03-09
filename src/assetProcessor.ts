import { App, TFile } from 'obsidian';

/**
 * Converts local image elements in the targeted DOM into Base64 URI representations.
 * Modifies the dom tree in-place.
 */
export async function processImagesToBase64(app: App, container: HTMLElement): Promise<void> {
    const images = container.querySelectorAll('img');

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let src = img.getAttribute('src');
        if (!src) continue;

        // Skip absolute http/https URLs that are online
        if (src.startsWith('http://') || src.startsWith('https://')) {
            continue;
        }

        // Obsidian typically transforms local file links into app:// protocol or similar
        // Let's try to resolve the internal path
        let file = app.metadataCache.getFirstLinkpathDest(src, "");
        
        // If it's a direct path in Obsidian DOM, it might look like app://... 
        // We can parse the internal path or use fs if we need to
        if (!file && src.startsWith('app://')) {
            // Very rudimentary extraction of the path
            const unescaped = decodeURIComponent(src);
            const pathParts = unescaped.split('?')[0].split('/');
            const filename = pathParts[pathParts.length - 1];
            // Look for this filename in vault
            file = app.metadataCache.getFirstLinkpathDest(filename, "");
        }

        if (file && 'extension' in file) {
            try {
                const arrayBuffer = await app.vault.readBinary(file);
                const base64 = bufToBase64(arrayBuffer);
                const mimeType = getMimeType(file.extension);
                img.setAttribute('src', `data:${mimeType};base64,${base64}`);
            } catch (e) {
                console.warn(`Failed to process image: ${file.path}`, e);
            }
        }
    }
}

function bufToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function getMimeType(extension: string): string {
    const ext = extension.toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'svg': return 'image/svg+xml';
        case 'webp': return 'image/webp';
        default: return 'application/octet-stream';
    }
}
