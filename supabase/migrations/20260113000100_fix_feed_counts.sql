-- Create function to update fetch_status counts
CREATE OR REPLACE FUNCTION public.update_fetch_status_counts()
RETURNS TRIGGER AS $$
DECLARE
    target_feed_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_feed_id = OLD.feed_id;
    ELSE
        target_feed_id = NEW.feed_id;
    END IF;

    -- Update total_articles query
    UPDATE public.fetch_status
    SET total_articles = (
        SELECT count(*)
        FROM public.articles
        WHERE feed_id = target_feed_id
    ),
    unread_count = (
        SELECT count(*)
        FROM public.articles a
        LEFT JOIN public.user_articles ua ON a.id = ua.article_id AND ua.user_id = auth.uid()
        WHERE a.feed_id = target_feed_id
        AND (ua.is_read IS NULL OR ua.is_read = false)
    )
    WHERE feed_id = target_feed_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle user_articles changes
CREATE OR REPLACE FUNCTION public.update_fetch_status_unread()
RETURNS TRIGGER AS $$
DECLARE
    target_feed_id UUID;
    target_article_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_article_id = OLD.article_id;
    ELSE
        target_article_id = NEW.article_id;
    END IF;

    SELECT feed_id INTO target_feed_id
    FROM public.articles
    WHERE id = target_article_id;

    IF target_feed_id IS NOT NULL THEN
        UPDATE public.fetch_status
        SET unread_count = (
            SELECT count(*)
            FROM public.articles a
            LEFT JOIN public.user_articles ua ON a.id = ua.article_id AND ua.user_id = auth.uid()
            WHERE a.feed_id = target_feed_id
            AND (ua.is_read IS NULL OR ua.is_read = false)
        )
        WHERE feed_id = target_feed_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to initialize fetch_status on new feed
CREATE OR REPLACE FUNCTION public.init_fetch_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.fetch_status (feed_id)
    VALUES (NEW.id)
    ON CONFLICT (feed_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on articles table
DROP TRIGGER IF EXISTS trigger_update_counts_articles ON public.articles;
CREATE TRIGGER trigger_update_counts_articles
AFTER INSERT OR DELETE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.update_fetch_status_counts();

-- Trigger on user_articles table
DROP TRIGGER IF EXISTS trigger_update_unread_user_articles ON public.user_articles;
CREATE TRIGGER trigger_update_unread_user_articles
AFTER INSERT OR UPDATE OR DELETE ON public.user_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_fetch_status_unread();

-- Trigger on feeds table
DROP TRIGGER IF EXISTS trigger_init_fetch_status ON public.feeds;
CREATE TRIGGER trigger_init_fetch_status
AFTER INSERT ON public.feeds
FOR EACH ROW
EXECUTE FUNCTION public.init_fetch_status();

-- Backfill data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.feeds LOOP
        -- Initialize fetch_status if not exists
        INSERT INTO public.fetch_status (feed_id)
        VALUES (r.id)
        ON CONFLICT (feed_id) DO NOTHING;

        -- Update counts
        UPDATE public.fetch_status
        SET total_articles = (
            SELECT count(*)
            FROM public.articles
            WHERE feed_id = r.id
        ),
        unread_count = (
            SELECT count(*)
            FROM public.articles a
            LEFT JOIN public.user_articles ua ON a.id = ua.article_id AND ua.user_id = (SELECT user_id FROM public.feeds WHERE id = r.id)
            WHERE a.feed_id = r.id
            AND (ua.is_read IS NULL OR ua.is_read = false)
        )
        WHERE feed_id = r.id;
    END LOOP;
END $$;
