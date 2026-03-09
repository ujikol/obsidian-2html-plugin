import { describe, it, expect, vi } from 'vitest';
import { processImagesToBase64 } from '../src/assetProcessor';
import { TFile } from 'obsidian';

describe('assetProcessor', () => {
    it('should ignore remote http images', async () => {
        const container = document.createElement('div');
        container.innerHTML = `<img src="https://example.com/image.png" />`;
        
        const mockApp: any = {
            metadataCache: {
                getFirstLinkpathDest: vi.fn().mockReturnValue(null)
            }
        };

        await processImagesToBase64(mockApp, container);
        const img = container.querySelector('img');
        expect(img?.getAttribute('src')).toBe('https://example.com/image.png');
    });

    it('should convert local file to base64', async () => {
        const container = document.createElement('div');
        container.innerHTML = `<img src="app://local/path/to/test.png" />`;

        const mockFile = {} as TFile;
        mockFile.extension = 'png';
        
        const mockApp: any = {
            metadataCache: {
                // mock resolving simply by returning mockFile for any first linkpath
                getFirstLinkpathDest: vi.fn().mockImplementation((path) => mockFile)
            },
            vault: {
                readBinary: vi.fn().mockResolvedValue(new ArrayBuffer(8)) // dummy buffer
            }
        };

        // Suppress btoa logic failure in node with simple mock or just let jsdom handle it since btoa is in jsdom
        await processImagesToBase64(mockApp, container);
        const img = container.querySelector('img');
        expect(img?.getAttribute('src')).toContain('data:image/png;base64,');
    });
});
