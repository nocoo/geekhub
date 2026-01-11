import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ArticleRepository } from '@/lib/article-repository';
import { ReadStatusService } from '@/lib/read-status-service';

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

// GET /api/feeds/later/articles - Get read later articles
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get read later articles with feed info
    const { data: readLater, error: readLaterError } = await supabase
      .from('read_later_articles')
      .select(`
        *,
        feed:feeds(id, title, url, url_hash, favicon_url)
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    if (readLaterError) {
      console.error('[ReadLaterArticles] DB Error:', readLaterError);
      throw readLaterError;
    }

    if (!readLater || readLater.length === 0) {
      return NextResponse.json({
        feed: {
          id: 'later',
          title: '稍后阅读',
          url: '',
        },
        articles: [],
        total: 0,
        lastUpdated: null,
      });
    }

    // Create services
    const articleRepo = new ArticleRepository();
    const readStatusService = new ReadStatusService(user.id);

    // Process each read later article
    const articles = await Promise.all(
      readLater.map(async (item: any) => {
        const feed = item.feed;
        if (!feed) return null;

        // Get read hashes for this feed
        const readHashes = await readStatusService.getReadHashes(feed.id);

        // Try to load article from file system
        let firstImage: string | null = null;
        let content: string | undefined = undefined;
        let publishedAt: Date | null = null;
        let ai_summary: any = undefined;

        if (feed.url_hash) {
          try {
            const fullArticle = await articleRepo.getArticle(feed.url_hash, item.article_hash);
            if (fullArticle) {
              if (fullArticle.content) {
                firstImage = extractFirstImage(fullArticle.content);
                content = fullArticle.content;
              }
              if (fullArticle.published_at) {
                publishedAt = new Date(fullArticle.published_at);
              }
              if (fullArticle.ai_summary) {
                ai_summary = fullArticle.ai_summary;
              }
            }
          } catch {
            // Ignore errors, use read_later data
          }
        }

        return {
          id: item.article_hash,
          feedId: feed.id,
          title: item.article_title,
          url: item.article_url,
          description: '',
          author: '',
          publishedAt,
          feedName: feed.title,
          feedIcon: feed.favicon_url || '',
          isRead: readHashes.has(item.article_hash),
          hash: item.article_hash,
          image: firstImage,
          content,
          ai_summary,
        };
      })
    );

    // Filter out nulls
    const validArticles = articles.filter(a => a !== null);

    return NextResponse.json({
      feed: {
        id: 'later',
        title: '稍后阅读',
        url: '',
      },
      articles: validArticles,
      total: validArticles.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ReadLaterArticles] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract first image from HTML content
 */
function extractFirstImage(html: string): string | null {
  if (!html) return null;

  const patterns = [
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
    /<img[^>]+src=([^"\s>]+)[^>]*>/i,
    /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let url = match[1];
      url = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      if (url && !url.startsWith('data:') && (url.startsWith('http') || url.startsWith('//'))) {
        return url.startsWith('//') ? 'https:' + url : url;
      }
    }
  }

  return null;
}
