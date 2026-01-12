"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-browser';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // DEV MODE: Fixed user for development
  // Requires BOTH NODE_ENV=development AND DEV_MODE_ENABLED=true
  const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID || '';
  const DEV_USER_EMAIL = process.env.NEXT_PUBLIC_DEV_USER_EMAIL || '';
  const isDev = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_MODE_ENABLED === 'true';

  useEffect(() => {
    // DEV MODE: Skip auth and use fixed user
    if (isDev) {
      const devUser: User = {
        id: DEV_USER_ID,
        email: DEV_USER_EMAIL,
        app_metadata: { provider: 'dev', providers: ['dev'] },
        user_metadata: { full_name: 'Dev User', email: DEV_USER_EMAIL },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUser(devUser);
      setLoading(false);
      return;
    }

    // Production: Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isDev, supabase]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signInWithGoogle,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}