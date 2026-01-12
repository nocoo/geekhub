import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// GET /api/categories - 获取用户的所有分类
export async function GET() {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/categories - 创建新分类
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    const body = await request.json();
    const { name, color, icon, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        color: color || '#10b981',
        icon: icon || '📁',
        sort_order: sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique constraint violation
        return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
