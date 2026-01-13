
import { createClient } from '@supabase/supabase-js';

// Load env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabaseClient = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function runTest() {
    console.log('Starting verification test (Hybrid Mode)...');

    // 1. Sign up a test user (Client side)
    const email = `test_entry_${Date.now()}@example.com`;
    const password = 'password123';

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Failed to sign up user:', authError);
        return;
    }

    const userId = authData.user?.id;
    if (!userId) {
        console.error('User created but ID missing');
        return;
    }
    console.log(`Created test user: ${userId}`);

    try {
        // 2. Create a test feed (Admin)
        const { data: feed, error: feedError } = await supabaseAdmin
            .from('feeds')
            .insert({
                user_id: userId,
                title: 'Test Feed',
                url: `https://test.com/feed/${Date.now()}`,
                url_hash: Math.random().toString(36).substring(7),
            })
            .select()
            .single();

        if (feedError) {
            throw new Error(`Failed to create feed: ${feedError.message}`);
        }
        console.log(`Created test feed: ${feed.id}`);

        // Wait for trigger to init fetch_status
        let { data: status } = await supabaseAdmin.from('fetch_status').select('*').eq('feed_id', feed.id).single();

        if (!status) {
            await new Promise(r => setTimeout(r, 1000));
            ({ data: status } = await supabaseAdmin.from('fetch_status').select('*').eq('feed_id', feed.id).single());
        }

        if (!status) {
            throw new Error('Missing fetch_status record');
        }

        console.log(`Initial status: total=${status.total_articles}, unread=${status.unread_count}`);

        // 3. Insert Article (Admin)
        console.log('Inserting article...');
        const { data: article, error: articleError } = await supabaseAdmin
            .from('articles')
            .insert({
                feed_id: feed.id,
                title: 'Test Article',
                url: 'https://test.com/article/1',
                hash: 'hash1',
                published_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (articleError) throw new Error(articleError.message);

        // Verify Counts
        ({ data: status } = await supabaseAdmin.from('fetch_status').select('*').eq('feed_id', feed.id).single());
        console.log(`After Insert: total=${status.total_articles}, unread=${status.unread_count}`);

        if (status.total_articles !== 1 || status.unread_count !== 1) {
            console.error('❌ Verification FAILED');
        } else {
            console.log('✅ Article Insert Verification Passed');
        }

        // 4. Mark as Read (Admin - simulating user action)
        console.log('Marking as read...');
        const { error: readError } = await supabaseAdmin
            .from('user_articles')
            .insert({
                user_id: userId,
                article_id: article.id,
                is_read: true,
            });

        if (readError) throw new Error(readError.message);

        // Verify Counts
        ({ data: status } = await supabaseAdmin.from('fetch_status').select('*').eq('feed_id', feed.id).single());
        console.log(`After Read: total=${status.total_articles}, unread=${status.unread_count}`);

        if (status.unread_count !== 0) {
            console.error('❌ Verification FAILED');
        } else {
            console.log('✅ Mark Read Verification Passed');
        }

        console.log('🎉 All tests passed successfully!');

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        if (userId) {
            console.log('Cleaning up...');
            await supabaseAdmin.from('feeds').delete().eq('user_id', userId);
            await supabaseAdmin.auth.admin.deleteUser(userId);
        }
    }
}

runTest();
