import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            'obsidian': path.resolve(__dirname, './tests/mocks/obsidian.ts')
        }
    },
    test: {
        environment: 'jsdom',
        globals: true
    }
});
