import { describe, it, expect, vi } from 'vitest';
import { exportNoteToHTML } from '../src/htmlBuilder';
import * as domUtils from '../src/domUtils';

vi.mock('../src/domUtils', () => ({
    getTargetDOM: vi.fn(),
    getActiveCSS: vi.fn(() => 'body { color: red; }'),
    getBodyClasses: vi.fn(() => 'theme-dark'),
    getBodyStyles: vi.fn(() => '--custom-prop: 10px;')
}));

vi.mock('../src/assetProcessor', () => ({
    processImagesToBase64: vi.fn()
}));

describe('htmlBuilder', () => {
    it('should wrap successfully and contain the target node DOM and title', async () => {
        const mockTargetDOM = document.createElement('div');
        mockTargetDOM.innerHTML = '<p>Test content</p>';
        (domUtils.getTargetDOM as any).mockResolvedValue(mockTargetDOM);

        let writtenContent = '';
        const mockApp: any = {
            workspace: {
                getActiveFile: () => ({ parent: { path: 'folder' } })
            },
            vault: {
                getAbstractFileByPath: () => null,
                create: vi.fn().mockImplementation((path, content) => {
                    writtenContent = content;
                })
            }
        };

        await exportNoteToHTML(mockApp, 'My Export Note', 'folder/My Export Note - Export.html', false, {});

        expect(mockApp.vault.create).toHaveBeenCalledWith('folder/My Export Note - Export.html', expect.any(String));
        
        // Assertions on structural wrapper
        expect(writtenContent).toContain('<title>My Export Note</title>');
        expect(writtenContent).toContain('<style>body { color: red; }</style>');
        expect(writtenContent).toContain('class="theme-dark"');
        expect(writtenContent).toContain('style="--custom-prop: 10px;"');
        expect(writtenContent).toContain('<p>Test content</p>');
        expect(writtenContent).toContain('class="markdown-rendered"');
        expect(writtenContent).toContain('class="app-container"');
    });
});
