/**
 * @file AuthContext.test.tsx
 * Tests for AuthContext.
 *
 * Mocks both @supabase/ssr and the path-aliased wrapper so mock.module works
 * reliably across Bun versions and platforms (macOS + Linux CI).
 *
 * The @supabase/ssr mock preserves createServerClient (used by other modules)
 * and only overrides createBrowserClient, which is what AuthContext consumes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import React, { ReactNode } from 'react';

// ── shared mock fns ──────────────────────────────────────────────────
const {
    mockGetSession,
    mockSignOut,
    mockSignInWithOAuth,
    mockOnAuthStateChange,
    fakeClient,
    supabaseMock,
} = vi.hoisted(() => {
    const mockGetSession = vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
    );
    const mockSignOut = vi.fn(() => Promise.resolve({ error: null }));
    const mockSignInWithOAuth = vi.fn(() => Promise.resolve({ error: null }));
    const mockOnAuthStateChange = vi.fn(
        (_cb: (event: string, session: { user: Record<string, unknown> } | null) => void) => {
            return { data: { subscription: { unsubscribe: vi.fn(() => {}) } } };
        },
    );
    const fakeClient = () => ({
        auth: {
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
            signOut: mockSignOut,
            signInWithOAuth: mockSignInWithOAuth,
        },
    });
    const supabaseMock = () => ({
        createClient: () => fakeClient(),
    });
    return { mockGetSession, mockSignOut, mockSignInWithOAuth, mockOnAuthStateChange, fakeClient, supabaseMock };
});

let authStateCallback: ((event: string, session: { user: Record<string, unknown> } | null) => void) | undefined;

// Mock the wrapper module at path-alias and relative forms.
vi.mock('@/lib/supabase-browser', supabaseMock);
vi.mock('../lib/supabase-browser', supabaseMock);

// Also mock @supabase/ssr — the package that supabase-browser.ts imports.
// This catches cases where the path-alias mock doesn't intercept on certain
// Bun versions / platforms. We stub createServerClient as a passthrough so
// other test files that mock it themselves aren't broken by a missing export.
vi.mock('@supabase/ssr', () => ({
    createBrowserClient: () => fakeClient(),
    createServerClient: () => fakeClient(),
}));

// Import *after* mock.module so the mock is picked up
const { AuthProvider, useAuth } = await import('./AuthContext');

// TODO: AuthContext tests timeout in CI (bun 1.3.12) due to mock.module differences
// They pass locally on bun 1.3.5. Re-enable when bun mock.module is stable.
describe.skip('AuthContext', () => {
    afterEach(cleanup);

    beforeEach(() => {
        authStateCallback = undefined;
        mockGetSession.mockClear();
        mockGetSession.mockImplementation(() =>
            Promise.resolve({ data: { session: null }, error: null }),
        );
        mockOnAuthStateChange.mockClear();
        mockOnAuthStateChange.mockImplementation(
            (cb: (event: string, session: { user: Record<string, unknown> } | null) => void) => {
                authStateCallback = cb;
                return { data: { subscription: { unsubscribe: vi.fn(() => {}) } } };
            },
        );
        mockSignOut.mockClear();
        mockSignOut.mockImplementation(() => Promise.resolve({ error: null }));
        mockSignInWithOAuth.mockClear();
        mockSignInWithOAuth.mockImplementation(() => Promise.resolve({ error: null }));
    });

    it('should initialize with null user if no session', async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
        expect(result.current.user).toBeNull();
    });

    it('should initialize with user if session exists', async () => {
        const mockUser = { id: 'user-123', email: 'test@example.com' };
        mockGetSession.mockImplementation(() =>
            Promise.resolve({
                data: { session: { user: mockUser } },
                error: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock doesn't need full Session type
            }) as any,
        );

        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.id).toBe('user-123');
    });

    it('should update user when auth state changes', async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

        const mockUser = { id: 'user-456', email: 'new@example.com' };

        // Trigger auth state change
        act(() => {
            authStateCallback!('SIGNED_IN', { user: mockUser });
        });

        await waitFor(() => expect(result.current.user?.id).toBe('user-456'), { timeout: 3000 });
    });

    it('should call signOut and clear user on success', async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

        await act(async () => {
            await result.current.signOut();
        });

        expect(mockSignOut).toHaveBeenCalled();
    });

    it('should call signInWithGoogle', async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

        await act(async () => {
            await result.current.signInWithGoogle();
        });

        expect(mockSignInWithOAuth).toHaveBeenCalled();
    });

    it('should throw error when useAuth is used outside AuthProvider', () => {
        // Suppress React error boundary console output during this test
        const spy = vi.fn(() => {});
        const origError = console.error;
        console.error = spy;

        try {
            expect(() => {
                renderHook(() => useAuth());
            }).toThrow('useAuth must be used within an AuthProvider');
        } finally {
            console.error = origError;
        }
    });
});
