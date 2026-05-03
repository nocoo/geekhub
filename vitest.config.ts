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
                'src/contexts/**',
                'src/app/**',
                'src/test/**',
                'src/lib/mockData.ts',
                'src/lib/supabase-browser.ts',
                'src/lib/supabase-server.ts',
                // Supabase + next/cookies server-side wrappers — covered by L3 API E2E tests
                'src/lib/read-status-service.ts',
                'src/lib/article-repository.ts',
                // Long-running fetcher pipelines — covered by L3 API E2E tests
                'src/lib/feed-fetcher.ts',
                'src/lib/translation-queue.ts',
                'src/lib/rsshub-display.ts',
                'src/lib/fetch-with-settings.ts',
                'src/lib/utils.ts',
                'src/hooks/use-toast.ts',
                'src/hooks/useDatabase.ts',
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
