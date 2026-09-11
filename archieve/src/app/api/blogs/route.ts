import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用 service role 或 anon key 直接访问（不依赖 cookies）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/blogs - 获取博客发现列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 获取查询参数
    const sort = searchParams.get('sort') || 'updated';
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('blogs')
      .select('*');

    // 标签过滤
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // 名称搜索
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // 排序
    if (sort === 'name') {
      query = query.order('name', { ascending: true });
    } else if (sort === 'updated') {
      query = query.order('last_updated', { ascending: false, nullsFirst: false });
    } else if (sort === 'score') {
      // 按评分排序，需要特殊处理 JSONB 字段
      // 先获取所有数据，然后在内存中排序
      const { data: allBlogs, error: fetchError } = await supabase
        .from('blogs')
        .select('*');

      if (fetchError) {
        console.error('Blogs query error:', fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      // 在内存中按评分排序
      const sortedBlogs = allBlogs?.sort((a, b) => {
        const scoreA = a.score?.overall ? parseInt(a.score.overall) : 0;
        const scoreB = b.score?.overall ? parseInt(b.score.overall) : 0;
        return scoreB - scoreA; // 降序
      }) || [];

      // 分页
      const paginatedBlogs = sortedBlogs.slice(offset, offset + limit);

      // 获取所有唯一标签
      const { data: allBlogsForTags } = await supabase.from('blogs').select('tags');
      const uniqueTags = new Set<string>();
      allBlogsForTags?.forEach((blog: { tags: string[] | null }) => {
        blog.tags?.forEach(t => uniqueTags.add(t));
      });

      return NextResponse.json({
        blogs: paginatedBlogs,
        tags: Array.from(uniqueTags).sort(),
        pagination: {
          page,
          limit,
          hasMore: offset + limit < (sortedBlogs.length || 0),
        },
      });
    }

    // 分页
    query = query.range(offset, offset + limit - 1);

    const { data: blogs, error } = await query;

    if (error) {
      console.error('Blogs query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 获取所有唯一标签
    const { data: allBlogs } = await supabase.from('blogs').select('tags');
    const uniqueTags = new Set<string>();
    allBlogs?.forEach((blog: { tags: string[] | null }) => {
      blog.tags?.forEach(t => uniqueTags.add(t));
    });

    return NextResponse.json({
      blogs: blogs || [],
      tags: Array.from(uniqueTags).sort(),
      pagination: {
        page,
        limit,
        hasMore: (blogs?.length || 0) === limit,
      },
    });
  } catch (error) {
    console.error('Blogs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
