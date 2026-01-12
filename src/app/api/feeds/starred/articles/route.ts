import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// GET /api/feeds/starred/articles - Get bookmarked articles
export async function GET(_request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Get user_articles with is_bookmarked = true, joined with articles and feeds
    const { data: bookmarked, error: bookmarkedError } = await supabase
      .from('user_articles')
      .select(`
        *,
        article:articles(
          id, title, url, link, author, published_at, content, content_text, summary, fetched_at,
          feed:feeds(id, title, url, favicon_url)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_bookmarked', true)
      .order('bookmarked_at', { ascending: false });

    if (bookmarkedError) {
      console.error('[StarredArticles] DB Error:', bookmarkedError);
      throw bookmarkedError;
    }

    if (!bookmarked || bookmarked.length === 0) {
      return NextResponse.json({
        feed: { id: 'starred', title: '已收藏', url: '' },
        articles: [],
        total: 0,
        lastUpdated: null,
      });
    }

    // Process articles
    const articles = bookmarked
      .filter((item: any) => item.article)
      .map((item: any) => {
        const article = item.article;
        const feed = article.feed;
        return {
          id: article.id,
          articleId: article.id,
          hash: article.hash,
          feedId: feed?.id || '',
          title: article.title,
          url: article.url,
          link: article.link || article.url,
          description: article.summary || '',
          author: article.author || '',
          publishedAt: article.published_at ? new Date(article.published_at).toISOString() : null,
          feedName: feed?.title || '',
          feedIcon: feed?.favicon_url || '',
          isRead: item.is_read,
          image: extractFirstImage(article.content || ''),
          content: article.content,
          ai_summary: undefined, // Not stored in new schema
        };
      });

    return NextResponse.json({
      feed: { id: 'starred', title: '已收藏', url: '' },
      articles,
      total: articles.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[StarredArticles] Error:', error);
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
