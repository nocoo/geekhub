/**
 * @file AuthContext.test.tsx
 * Tests for AuthContext.
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React, { ReactNode } from 'react';

// Mock Supabase
const mockGetSession = mock(() => Promise.resolve({ data: { session: null }, error: null }));
const mockOnAuthStateChange = mock((callback: any) => {
    return { data: { subscription: { unsubscribe: mock(() => { }) } } };
});

mock.module('@/lib/supabase-browser', () => ({
    createClient: () => ({
        auth: {
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
            signOut: mock(() => Promise.resolve({ error: null })),
            signInWithOAuth: mock(() => Promise.resolve({ error: null })),
        }
    }),
}));

describe('AuthContext', () => {
    afterEach(cleanup);
    beforeEach(() => {
        mockGetSession.mockClear();
        mockGetSession.mockImplementation(() => Promise.resolve({ data: { session: null }, error: null }));
        mockOnAuthStateChange.mockClear();
    });

    it('should initialize with null user if no session', async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.user).toBeNull();
    });

    it('should initialize with user if session exists', async () => {
        const mockUser = { id: 'user-123', email: 'test@example.com' };
        mockGetSession.mockImplementation(() => Promise.resolve({
            data: { session: { user: mockUser } },
            error: null
        }) as any);

        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });
        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.id).toBe('user-123');
    });

    it('should update user when auth state changes', async () => {
        let stateChangeCallback: any;
        mockOnAuthStateChange.mockImplementation((callback: any) => {
            stateChangeCallback = callback;
            return { data: { subscription: { unsubscribe: mock(() => { }) } } };
        });

        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));

        const mockUser = { id: 'user-456', email: 'new@example.com' };

        // Trigger auth state change
        act(() => {
            stateChangeCallback('SIGNED_IN', { user: mockUser });
        });

        await waitFor(() => expect(result.current.user?.id).toBe('user-456'));
    });

    it('should call signOut and clear user on success', async () => {
        const mockSignOut = mock(() => Promise.resolve({ error: null }));
        mock.module('@/lib/supabase-browser', () => ({
            createClient: () => ({
                auth: {
                    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
                    onAuthStateChange: (cb: any) => ({ data: { subscription: { unsubscribe: mock(() => { }) } } }),
                    signOut: mockSignOut,
                    signInWithOAuth: mock(() => Promise.resolve({ error: null })),
                }
            }),
        }));

        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.signOut();
        });

        expect(mockSignOut).toHaveBeenCalled();
    });

    it('should call signInWithGoogle', async () => {
        const mockSignInWithOAuth = mock(() => Promise.resolve({ error: null }));
        mock.module('@/lib/supabase-browser', () => ({
            createClient: () => ({
                auth: {
                    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
                    onAuthStateChange: (cb: any) => ({ data: { subscription: { unsubscribe: mock(() => { }) } } }),
                    signOut: mock(() => Promise.resolve({ error: null })),
                    signInWithOAuth: mockSignInWithOAuth,
                }
            }),
        }));

        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        );

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.signInWithGoogle();
        });

        expect(mockSignInWithOAuth).toHaveBeenCalled();
    });

    it('should throw error when useAuth is used outside AuthProvider', () => {
        expect(() => {
            renderHook(() => useAuth());
        }).toThrow('useAuth must be used within an AuthProvider');
    });
});
