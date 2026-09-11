import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

// DEV MODE: Fixed user ID for development
// Only enabled when BOTH conditions are met:
// 1. NODE_ENV === 'development'
// 2. DEV_MODE_ENABLED === 'true' (must be explicitly set in .env.local)
const DEV_USER_ID = process.env.DEV_USER_ID || '';
const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL || '';
const DEV_MODE_ENABLED = process.env.DEV_MODE_ENABLED === 'true';

export interface DevUser {
  id: string;
  email: string;
  is_dev: true;
}

/**
 * Create a Supabase client that works in both dev and production
 * - Dev mode: Uses service key, bypasses RLS, injects dev user
 * - Production: Uses normal auth with cookies
 */
export async function createSmartSupabaseClient() {
  const isDev = process.env.NODE_ENV === 'development' && DEV_MODE_ENABLED;
  const cookieStore = await cookies();

  if (isDev) {
    // Dev mode: Use service key to bypass RLS
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Return client with dev user attached
    return {
      client,
      user: {
        id: DEV_USER_ID,
        email: DEV_USER_EMAIL,
        is_dev: true,
      } as DevUser & User,
    };
  }

  // Production: Use normal auth
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore if called from Server Component
          }
        },
      },
    }
  );

  const { data: { user } } = await client.auth.getUser();

  return { client, user: user || null };
}

/**
 * Helper to get user or throw 401
 * In dev mode, always returns dev user
 */
export async function requireUser() {
  const { user } = await createSmartSupabaseClient();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Helper to get user ID
 * In dev mode, returns dev user ID
 */
export async function getUserId(): Promise<string> {
  const user = await requireUser();
  return user.id;
}
