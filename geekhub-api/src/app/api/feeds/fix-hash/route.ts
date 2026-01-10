import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'crypto';

async function createSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only
        },
      },
    }
  );
}

function generateUrlHash(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

// POST /api/feeds/fix-hash - Fix missing url_hash for existing feeds
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all feeds without url_hash
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, url')
      .eq('user_id', user.id)
      .is('url_hash', null);

    if (feedsError) {
      return NextResponse.json({ error: feedsError.message }, { status: 500 });
    }

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({ fixed: 0, message: 'No feeds need fixing' });
    }

    // Update each feed with url_hash
    let fixed = 0;
    for (const feed of feeds) {
      const urlHash = generateUrlHash(feed.url);
      const { error: updateError } = await supabase
        .from('feeds')
        .update({ url_hash: urlHash })
        .eq('id', feed.id);

      if (!updateError) {
        fixed++;
      }
    }

    return NextResponse.json({
      fixed,
      message: `Fixed ${fixed} feeds`,
    });
  } catch (error) {
    console.error('Error fixing feed hashes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
