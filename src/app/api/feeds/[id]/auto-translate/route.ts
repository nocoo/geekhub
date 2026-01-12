import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// PUT /api/feeds/[id]/auto-translate - Toggle auto_translate for a feed
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    const body = await request.json();
    const { auto_translate } = body;

    if (typeof auto_translate !== 'boolean') {
      return NextResponse.json({ error: 'auto_translate must be a boolean' }, { status: 400 });
    }

    const { data: feed, error } = await supabase
      .from('feeds')
      .update({ auto_translate })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, auto_translate')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feed });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
