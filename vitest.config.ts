import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            exclude: [
                '**/*.test.{ts,tsx}',
                '**/*.spec.{ts,tsx}',
                '**/*.d.ts',
                'src/components/**',
                'src/app/**',
                'src/test/**',
                'src/lib/mockData.ts',
                'src/lib/supabase-browser.ts',
                'src/lib/supabase-server.ts',
                'src/contexts/AuthContext.tsx',
            ],
            thresholds: {
                statements: 95,
                functions: 95,
                lines: 95,
                branches: 90,
            },
        },
    },
});
