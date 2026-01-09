import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Parser from 'rss-parser';

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

// RSS 解析器
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'GeekHub RSS Reader/1.0',
  },
});

// 验证和解析 RSS URL
async function validateRssUrl(url: string) {
  try {
    const feed = await parser.parseURL(url);
    return {
      valid: true,
      title: feed.title || 'Untitled Feed',
      description: feed.description || '',
      siteUrl: feed.link || '',
      faviconUrl: feed.image?.url || null,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid RSS URL',
    };
  }
}

// GET /api/feeds - 获取用户的所有 RSS 源
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: feeds, error } = await supabase
      .from('feeds')
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feeds });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/feeds - 添加新的 RSS 源
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, category_id, title: customTitle, description: customDescription } = body;

    if (!url) {
      return NextResponse.json({ error: 'RSS URL is required' }, { status: 400 });
    }

    // 验证 RSS URL
    const validation = await validateRssUrl(url);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 检查 URL 是否已存在
    const { data: existingFeed } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id)
      .eq('url', url)
      .single();

    if (existingFeed) {
      return NextResponse.json({ error: 'RSS feed already exists' }, { status: 409 });
    }

    // 创建新的 RSS 源
    const { data: feed, error } = await supabase
      .from('feeds')
      .insert({
        user_id: user.id,
        category_id: category_id || null,
        title: customTitle || validation.title,
        url,
        description: customDescription || validation.description,
        site_url: validation.siteUrl,
        favicon_url: validation.faviconUrl,
        is_active: true,
      })
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feed }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}