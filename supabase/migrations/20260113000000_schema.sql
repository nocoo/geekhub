-- Unified schema migration
-- Generated from schema.sql



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."create_default_categories_for_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO categories (user_id, name, color, icon, sort_order) VALUES
    (NEW.id, 'Technology', '#3b82f6', '💻', 1),
    (NEW.id, 'News', '#ef4444', '📰', 2),
    (NEW.id, 'Development', '#10b981', '🚀', 3),
    (NEW.id, 'General', '#6b7280', '📁', 4);
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."create_default_categories_for_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."generate_url_hash"("feed_url" "text") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN LEFT(MD5(feed_url), 12);
END;
$$;

ALTER FUNCTION "public"."generate_url_hash"("feed_url" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_feed_url_hash"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.url_hash IS NULL OR NEW.url_hash = '' THEN
    NEW.url_hash = generate_url_hash(NEW.url);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_feed_url_hash"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "feed_id" "uuid" NOT NULL,
    "hash" "text" NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "link" "text",
    "author" "text",
    "published_at" timestamp with time zone NOT NULL,
    "content" "text",
    "content_text" "text",
    "summary" "text",
    "categories" "text"[],
    "tags" "text"[],
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."articles" OWNER TO "postgres";

COMMENT ON TABLE "public"."articles" IS 'Article content fetched from RSS feeds';

CREATE TABLE IF NOT EXISTS "public"."blogs" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "feed" "text",
    "tags" "text"[],
    "last_updated" timestamp with time zone,
    "score" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."blogs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "color" character varying(7) DEFAULT '#10b981'::character varying,
    "icon" character varying(50) DEFAULT '📁'::character varying,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."feeds" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" character varying(255) NOT NULL,
    "url" "text" NOT NULL,
    "description" "text",
    "favicon_url" "text",
    "url_hash" character varying(12) NOT NULL,
    "fetch_interval_minutes" integer DEFAULT 60,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auto_translate" boolean DEFAULT false
);

ALTER TABLE "public"."feeds" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."fetch_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "feed_id" "uuid",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" "text" NOT NULL,
    "status" integer,
    "action" "text" NOT NULL,
    "url" "text" NOT NULL,
    "duration_ms" integer,
    "message" "text"
);

ALTER TABLE "public"."fetch_logs" OWNER TO "postgres";

COMMENT ON TABLE "public"."fetch_logs" IS 'Structured fetch logs replacing file-based logging';

CREATE TABLE IF NOT EXISTS "public"."fetch_status" (
    "feed_id" "uuid" NOT NULL,
    "last_fetch_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "last_fetch_status" "text",
    "last_fetch_error" "text",
    "last_fetch_duration_ms" integer,
    "total_articles" integer DEFAULT 0,
    "unread_count" integer DEFAULT 0,
    "next_fetch_at" timestamp with time zone
);

ALTER TABLE "public"."fetch_status" OWNER TO "postgres";

COMMENT ON TABLE "public"."fetch_status" IS 'Fetch status and statistics cache for feeds';

CREATE TABLE IF NOT EXISTS "public"."user_articles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "article_id" "uuid" NOT NULL,
    "is_read" boolean DEFAULT false,
    "is_bookmarked" boolean DEFAULT false,
    "is_read_later" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "bookmarked_at" timestamp with time zone,
    "read_later_at" timestamp with time zone,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."user_articles" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_articles" IS 'Unified table for user interactions with articles (read, bookmarked, read later)';

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_feed_id_hash_key" UNIQUE ("feed_id", "hash");

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."blogs"
    ADD CONSTRAINT "blogs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."fetch_status"
    ADD CONSTRAINT "feed_cache_pkey" PRIMARY KEY ("feed_id");

ALTER TABLE ONLY "public"."feeds"
    ADD CONSTRAINT "feeds_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."fetch_logs"
    ADD CONSTRAINT "fetch_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."feeds"
    ADD CONSTRAINT "unique_url_hash" UNIQUE ("url_hash");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "unique_user_category_name" UNIQUE ("user_id", "name");

ALTER TABLE ONLY "public"."feeds"
    ADD CONSTRAINT "unique_user_feed_url" UNIQUE ("user_id", "url");

ALTER TABLE ONLY "public"."user_articles"
    ADD CONSTRAINT "user_articles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_articles"
    ADD CONSTRAINT "user_articles_user_id_article_id_key" UNIQUE ("user_id", "article_id");

CREATE INDEX "idx_articles_feed_id" ON "public"."articles" USING "btree" ("feed_id");

CREATE INDEX "idx_articles_feed_published" ON "public"."articles" USING "btree" ("feed_id", "published_at" DESC);

CREATE INDEX "idx_articles_fetched_at" ON "public"."articles" USING "btree" ("fetched_at" DESC);

CREATE INDEX "idx_articles_hash" ON "public"."articles" USING "btree" ("hash");

CREATE INDEX "idx_articles_published_at" ON "public"."articles" USING "btree" ("published_at" DESC);

CREATE INDEX "idx_blogs_has_score" ON "public"."blogs" USING "btree" (((("score" ->> 'overall'::"text"))::integer) DESC NULLS LAST) WHERE (("score" IS NOT NULL) AND (("score" ->> 'overall'::"text") IS NOT NULL) AND ((("score" ->> 'overall'::"text"))::integer > 0));

CREATE INDEX "idx_blogs_last_updated_desc" ON "public"."blogs" USING "btree" ("last_updated" DESC NULLS LAST);

CREATE INDEX "idx_blogs_name_gin" ON "public"."blogs" USING "gin" ("name" "public"."gin_trgm_ops");

CREATE INDEX "idx_blogs_score_jsonb" ON "public"."blogs" USING "gin" ("score");

CREATE INDEX "idx_blogs_score_overall_desc" ON "public"."blogs" USING "btree" ((("score" ->> 'overall'::"text")) DESC NULLS LAST);

CREATE INDEX "idx_blogs_score_time" ON "public"."blogs" USING "btree" (((("score" ->> 'overall'::"text"))::integer) DESC) INCLUDE ("last_updated", "name");

CREATE INDEX "idx_blogs_tags" ON "public"."blogs" USING "gin" ("tags");

CREATE INDEX "idx_blogs_tags_score" ON "public"."blogs" USING "gin" ("tags", "score");

CREATE INDEX "idx_categories_user_id" ON "public"."categories" USING "btree" ("user_id");

CREATE INDEX "idx_feeds_url_hash" ON "public"."feeds" USING "btree" ("url_hash");

CREATE INDEX "idx_feeds_user_id" ON "public"."feeds" USING "btree" ("user_id");

CREATE INDEX "idx_fetch_logs_action" ON "public"."fetch_logs" USING "btree" ("action");

CREATE INDEX "idx_fetch_logs_feed_id" ON "public"."fetch_logs" USING "btree" ("feed_id");

CREATE INDEX "idx_fetch_logs_fetched_at" ON "public"."fetch_logs" USING "btree" ("fetched_at" DESC);

CREATE INDEX "idx_fetch_logs_level" ON "public"."fetch_logs" USING "btree" ("level");

CREATE INDEX "idx_fetch_status_next_fetch" ON "public"."fetch_status" USING "btree" ("next_fetch_at") WHERE ("next_fetch_at" IS NOT NULL);

CREATE INDEX "idx_user_articles_article_id" ON "public"."user_articles" USING "btree" ("article_id");

CREATE INDEX "idx_user_articles_bookmarked" ON "public"."user_articles" USING "btree" ("user_id", "is_bookmarked") WHERE ("is_bookmarked" = true);

CREATE INDEX "idx_user_articles_read" ON "public"."user_articles" USING "btree" ("user_id", "is_read") WHERE ("is_read" = true);

CREATE INDEX "idx_user_articles_read_later" ON "public"."user_articles" USING "btree" ("user_id", "is_read_later") WHERE ("is_read_later" = true);

CREATE INDEX "idx_user_articles_user_id" ON "public"."user_articles" USING "btree" ("user_id");

CREATE OR REPLACE TRIGGER "set_feed_url_hash_trigger" BEFORE INSERT OR UPDATE ON "public"."feeds" FOR EACH ROW EXECUTE FUNCTION "public"."set_feed_url_hash"();

CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_feeds_updated_at" BEFORE UPDATE ON "public"."feeds" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_user_articles_updated_at" BEFORE UPDATE ON "public"."user_articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."fetch_status"
    ADD CONSTRAINT "feed_cache_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."feeds"
    ADD CONSTRAINT "feeds_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."feeds"
    ADD CONSTRAINT "feeds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."fetch_logs"
    ADD CONSTRAINT "fetch_logs_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_articles"
    ADD CONSTRAINT "user_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_articles"
    ADD CONSTRAINT "user_articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Enable insert for authenticated users" ON "public"."blogs" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for anonymous users" ON "public"."blogs" FOR SELECT TO "anon" USING (true);

CREATE POLICY "Enable update for authenticated users" ON "public"."blogs" FOR UPDATE TO "authenticated" USING (true);

CREATE POLICY "Users can manage their own article interactions" ON "public"."user_articles" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view articles from their feeds" ON "public"."articles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."feeds"
  WHERE (("feeds"."id" = "articles"."feed_id") AND ("feeds"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view fetch logs for their feeds" ON "public"."fetch_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."feeds"
  WHERE (("feeds"."id" = "fetch_logs"."feed_id") AND ("feeds"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view fetch status for their feeds" ON "public"."fetch_status" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."feeds"
  WHERE (("feeds"."id" = "fetch_status"."feed_id") AND ("feeds"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users manage own categories" ON "public"."categories" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users manage own feeds" ON "public"."feeds" USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blogs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."feeds" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."fetch_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."fetch_status" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_articles" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_default_categories_for_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_categories_for_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_categories_for_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."generate_url_hash"("feed_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_url_hash"("feed_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_url_hash"("feed_url" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."set_feed_url_hash"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_feed_url_hash"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_feed_url_hash"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";

GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";

GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";

GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";

GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";

GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";

GRANT ALL ON TABLE "public"."blogs" TO "anon";
GRANT ALL ON TABLE "public"."blogs" TO "authenticated";
GRANT ALL ON TABLE "public"."blogs" TO "service_role";

GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";

GRANT ALL ON TABLE "public"."feeds" TO "anon";
GRANT ALL ON TABLE "public"."feeds" TO "authenticated";
GRANT ALL ON TABLE "public"."feeds" TO "service_role";

GRANT ALL ON TABLE "public"."fetch_logs" TO "anon";
GRANT ALL ON TABLE "public"."fetch_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."fetch_logs" TO "service_role";

GRANT ALL ON TABLE "public"."fetch_status" TO "anon";
GRANT ALL ON TABLE "public"."fetch_status" TO "authenticated";
GRANT ALL ON TABLE "public"."fetch_status" TO "service_role";

GRANT ALL ON TABLE "public"."user_articles" TO "anon";
GRANT ALL ON TABLE "public"."user_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_articles" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

