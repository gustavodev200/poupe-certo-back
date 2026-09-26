-- Profile: 1:1 com auth.users (Supabase Auth). RLS habilitada + policy own-row.
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey"
    FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
    ON "public"."profiles"
    FOR SELECT
    USING (auth.uid() = id);

-- Sincroniza profiles automaticamente no primeiro login (trigger em auth.users,
-- schema gerenciado pelo Supabase Auth — não pelo Prisma).
CREATE FUNCTION "public"."handle_new_user"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
        COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."handle_new_user"();

GRANT SELECT ON "public"."profiles" TO authenticated;

-- Role de login do Prisma em runtime (DATABASE_URL). Mesmo padrao do `authenticator`
-- do PostgREST: NOINHERIT + sem grants proprios — so le dado apos
-- `SET LOCAL ROLE authenticated` + request.jwt.claims por transacao, entao RLS vale
-- de verdade. Senha definida fora da migration (nunca no git):
--   ALTER ROLE app_runtime WITH PASSWORD '<forte>';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
        CREATE ROLE app_runtime LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

GRANT authenticated TO app_runtime;
