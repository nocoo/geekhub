import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
}

// POST /api/feeds/[id]/mark-all-read - Mark all articles in a feed as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get feed info to get url_hash
    const { data: feed } = await supabase
      .from('feeds')
      .select('url_hash')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // Get all articles from index
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const indexFile = join(process.cwd(), 'data', 'feeds', feed.url_hash, 'index.json');

    let hashes: string[] = [];
    try {
      const content = await readFile(indexFile, 'utf-8');
      const index = JSON.parse(content);
      hashes = index.articles?.map((a: any) => a.hash) || [];
    } catch {
      // No articles found
    }

    // Filter out already read articles
    const { data: readArticles } = await supabase
      .from('read_articles')
      .select('article_hash')
      .eq('feed_id', id);

    const readHashes = new Set(readArticles?.map(ra => ra.article_hash) || []);
    const newHashes = hashes.filter(h => !readHashes.has(h));

    if (newHashes.length === 0) {
      return NextResponse.json({ success: true, marked: 0, alreadyRead: hashes.length });
    }

    // Bulk insert read records
    const records = newHashes.map(hash => ({
      user_id: user.id,
      feed_id: id,
      article_hash: hash,
      read_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('read_articles')
      .insert(records);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      marked: newHashes.length,
      alreadyRead: hashes.length,
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
