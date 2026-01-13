-- Fix trigger functions to use correct user_id instead of auth.uid()

-- Update update_fetch_status_counts (triggered by articles table)
CREATE OR REPLACE FUNCTION public.update_fetch_status_counts()
RETURNS TRIGGER AS $$
DECLARE
    target_feed_id UUID;
    feed_owner_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_feed_id = OLD.feed_id;
    ELSE
        target_feed_id = NEW.feed_id;
    END IF;

    -- Get the owner of the feed
    SELECT user_id INTO feed_owner_id
    FROM public.feeds
    WHERE id = target_feed_id;

    -- Update status
    UPDATE public.fetch_status
    SET total_articles = (
        SELECT count(*)
        FROM public.articles
        WHERE feed_id = target_feed_id
    ),
    unread_count = (
        SELECT count(*)
        FROM public.articles a
        LEFT JOIN public.user_articles ua ON a.id = ua.article_id AND ua.user_id = feed_owner_id
        WHERE a.feed_id = target_feed_id
        AND (ua.is_read IS NULL OR ua.is_read = false)
    )
    WHERE feed_id = target_feed_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update update_fetch_status_unread (triggered by user_articles table)
CREATE OR REPLACE FUNCTION public.update_fetch_status_unread()
RETURNS TRIGGER AS $$
DECLARE
    target_feed_id UUID;
    target_article_id UUID;
    feed_owner_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_article_id = OLD.article_id;
    ELSE
        target_article_id = NEW.article_id;
    END IF;

    -- Get feed_id from article
    SELECT feed_id INTO target_feed_id
    FROM public.articles
    WHERE id = target_article_id;

    IF target_feed_id IS NOT NULL THEN
        -- Get the owner of the feed
        SELECT user_id INTO feed_owner_id
        FROM public.feeds
        WHERE id = target_feed_id;

        -- Update status
        UPDATE public.fetch_status
        SET unread_count = (
            SELECT count(*)
            FROM public.articles a
            LEFT JOIN public.user_articles ua ON a.id = ua.article_id AND ua.user_id = feed_owner_id
            WHERE a.feed_id = target_feed_id
            AND (ua.is_read IS NULL OR ua.is_read = false)
        )
        WHERE feed_id = target_feed_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-run backfill to correct any drafted data
DO $$
DECLARE
    r RECORD;
    feed_owner_id UUID;
BEGIN
    FOR r IN SELECT id, user_id FROM public.feeds LOOP
        -- Initialize fetch_status if not exists
        INSERT INTO public.fetch_status (feed_id)
        VALUES (r.id)
        ON CONFLICT (feed_id) DO NOTHING;

        -- Update counts using correct owner
        UPDATE public.fetch_status
        SET total_articles = (
            SELECT count(*)
            FROM public.articles
            WHERE feed_id = r.id
        ),
        unread_count = (
            SELECT count(*)
            FROM public.articles a
            LEFT JOIN public.user_articles ua ON a.id = ua.article_id AND ua.user_id = r.user_id
            WHERE a.feed_id = r.id
            AND (ua.is_read IS NULL OR ua.is_read = false)
        )
        WHERE feed_id = r.id;
    END LOOP;
END $$;
