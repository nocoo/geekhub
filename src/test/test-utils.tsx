import React, { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '@/contexts/AuthContext';

/**
 * Create a new QueryClient for each test to avoid cache pollution
 */
export const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
        mutations: {
            retry: false,
        }
    },
});

/**
 * Mock Auth User
 */
const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
};

/**
 * Wrapper component for hooks that need QueryClient and Auth
 */
export function TestWrapper({
    children,
    queryClient
}: {
    children: ReactNode,
    queryClient?: QueryClient
}) {
    const qc = queryClient || createTestQueryClient();

    return (
        <QueryClientProvider client={qc}>
            <AuthContext.Provider value={{
                user: mockUser as any,
                session: null,
                loading: false,
                signInWithGoogle: async () => { },
                signOut: async () => { },
            }}>
                {children}
            </AuthContext.Provider>
        </QueryClientProvider>
    );
}

/**
 * Custom renderHook that includes the necessary providers
 */
export function renderHookWithProviders<TProps, TResult>(
    callback: (props: TProps) => TResult,
    options?: { queryClient?: QueryClient }
) {
    return renderHook(callback, {
        wrapper: ({ children }) => (
            <TestWrapper queryClient={options?.queryClient}>
                {children}
            </TestWrapper>
        )
    });
}
