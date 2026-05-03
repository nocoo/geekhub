import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        globals: false,
        include: ['tests/e2e/**/*.test.ts'],
        exclude: ['node_modules/**', '.next/**'],
        testTimeout: 30000,
        hookTimeout: 30000,
        fileParallelism: false,
    },
});
