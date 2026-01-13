-- Security hardening and schema fixes

-- 1. Restrict blogs table access (only read access for non-admins)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."blogs";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "public"."blogs";
-- Keep "Enable read access for anonymous users" as it is for discovery

-- 2. Harden SECURITY DEFINER functions with search_path
ALTER FUNCTION public.create_default_categories_for_user() SET search_path = public;
ALTER FUNCTION public.update_fetch_status_counts() SET search_path = public;
ALTER FUNCTION public.update_fetch_status_unread() SET search_path = public;
ALTER FUNCTION public.init_fetch_status() SET search_path = public;

-- 3. Strengthen user_articles RLS
-- Ensure users can't create interactions for articles they don't have access to
DROP POLICY IF EXISTS "Users can manage their own article interactions" ON "public"."user_articles";

CREATE POLICY "Users can manage their own article interactions" ON "public"."user_articles"
AS PERMISSIVE FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
        SELECT 1 FROM public.articles a
        JOIN public.feeds f ON a.feed_id = f.id
        WHERE a.id = article_id AND f.user_id = auth.uid()
    )
);

-- 4. Set up user initialization trigger
-- This ensures new users get their default categories automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories_for_user();

-- 5. Fix potential missing grant for the auth trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON FUNCTION public.create_default_categories_for_user() TO supabase_auth_admin;
