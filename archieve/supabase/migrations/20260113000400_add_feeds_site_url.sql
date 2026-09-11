-- Add site_url column to feeds table
-- Stores the website homepage URL (RSS <link> element), distinct from the feed URL itself.

ALTER TABLE "public"."feeds" ADD COLUMN IF NOT EXISTS "site_url" "text";

-- Fix: grant categories INSERT permission to supabase_auth_admin
-- Required for the on_auth_user_created trigger that auto-creates default categories.
GRANT INSERT ON TABLE "public"."categories" TO supabase_auth_admin;

-- Fix: make create_default_categories_for_user() SECURITY DEFINER
-- so it runs as the function owner (postgres) and bypasses RLS.
-- The trigger fires as supabase_auth_admin which has no auth.uid() context.
ALTER FUNCTION public.create_default_categories_for_user() SECURITY DEFINER;
