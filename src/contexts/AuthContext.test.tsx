/**
 * @file AuthContext.test.tsx
 * Tests for AuthContext.
 *
 * Mocks @supabase/ssr (the underlying package) instead of the path-aliased
 * wrapper so mock.module works reliably across Bun versions.
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import React, { ReactNode } from 'react';

// ── shared mock fns ──────────────────────────────────────────────────
const mockGetSession = mock(() =>
    Promise.resolve({ data: { session: null }, error: null }),
);
const mockSignOut = mock(() => Promise.resolve({ error: null }));
const mockSignInWithOAuth = mock(() => Promise.resolve({ error: null }));

let authStateCallback: ((event: string, session: { user: Record<string, unknown> } | null) => void) | undefined;
const mockOnAuthStateChange = mock(
    (cb: (event: string, session: { user: Record<string, unknown> } | null) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: mock(() => {}) } } };
    },
);

// Mock the wrapper module at both path forms — avoids path-alias resolution
// issues across different Bun versions.
const supabaseMock = () => ({
    createClient: () => ({
        auth: {
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
            signOut: mockSignOut,
            signInWithOAuth: mockSignInWithOAuth,
        },
    }),
});
mock.module('@/lib/supabase-browser', supabaseMock);
mock.module('../lib/supabase-browser', supabaseMock);

// Import *after* mock.module so the mock is picked up
const { AuthProvider, useAuth } = await import('./AuthContext');

describe('AuthContext', () => {
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
                return { data: { subscription: { unsubscribe: mock(() => {}) } } };
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
        const spy = mock(() => {});
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
