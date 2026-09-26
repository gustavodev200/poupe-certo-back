-- Catálogo comunitário de preços: mercados, produtos, reportes de preço,
-- confirmações, e colunas de gamificação/moderação em profiles.
-- Toda tabela nova habilita RLS na própria migration que a cria (Princípio IV).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "public"."ProductCategory" AS ENUM ('MERCEARIA', 'BEBIDAS', 'LIMPEZA', 'HIGIENE', 'FRIOS', 'PADARIA');
CREATE TYPE "public"."ProductStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "public"."ReportStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'REJECTED');

-- profiles: pontuação (gamificação) e papel de operador (moderação, sem tela própria)
ALTER TABLE "public"."profiles"
    ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "is_operator" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "profiles_points_idx" ON "public"."profiles" ("points" DESC);

-- markets ---------------------------------------------------------------

CREATE TABLE "public"."markets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "uf" CHAR(2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "markets_name_lower_key" ON "public"."markets" (lower("name"));

ALTER TABLE "public"."markets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "markets_select_all" ON "public"."markets" FOR SELECT USING (true);
CREATE POLICY "markets_insert_authenticated" ON "public"."markets" FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT ON "public"."markets" TO anon, authenticated;
GRANT INSERT ON "public"."markets" TO authenticated;

-- products ----------------------------------------------------------------

CREATE TABLE "public"."products" (
    "ean" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "qty" TEXT NOT NULL,
    "category" "public"."ProductCategory" NOT NULL,
    "image_url" TEXT,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("ean"),
    CONSTRAINT "products_ean_format" CHECK ("ean" ~ '^\d{8,14}$'),
    CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT,
    CONSTRAINT "products_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "products_status_category_idx" ON "public"."products" ("status", "category");
CREATE INDEX "products_name_lower_idx" ON "public"."products" (lower("name"));
CREATE INDEX "products_brand_lower_idx" ON "public"."products" (lower("brand"));

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

-- Leitura pública só do aprovado (nunca vaza pendente/rejeitado pra quem não é dono/operador)
CREATE POLICY "products_select_approved" ON "public"."products" FOR SELECT USING (status = 'APPROVED');
-- Autor vê os próprios produtos em qualquer status
CREATE POLICY "products_select_own" ON "public"."products" FOR SELECT TO authenticated USING (created_by = auth.uid());
-- Operador vê a fila inteira, qualquer status
CREATE POLICY "products_select_operator" ON "public"."products" FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.id = auth.uid() AND p.is_operator));
-- Qualquer autenticado cadastra, só em nome de si mesmo, sempre PENDING (default da coluna).
-- WITH CHECK repete a garantia de status mesmo que o grant de coluna abaixo mude no futuro.
CREATE POLICY "products_insert_own" ON "public"."products" FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid() AND status = 'PENDING');
-- Só operador decide (aprova/rejeita) — não há policy de UPDATE pra não-operador
CREATE POLICY "products_update_operator" ON "public"."products" FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.id = auth.uid() AND p.is_operator))
    WITH CHECK (true);

GRANT SELECT ON "public"."products" TO anon, authenticated;
-- Grant de coluna: nunca permite gravar ean/name/brand/qty/category/image_url/created_by
-- por essa role — nem no INSERT (o autor não escolhe status) nem no UPDATE (moderação só
-- mexe em status/reviewed_by/reviewed_at, mesmo que um operador seja comprometido).
GRANT INSERT ("ean", "name", "brand", "qty", "category", "image_url", "created_by") ON "public"."products" TO authenticated;
GRANT UPDATE ("status", "reviewed_by", "reviewed_at") ON "public"."products" TO authenticated;

-- price_reports -------------------------------------------------------------

CREATE TABLE "public"."price_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_ean" TEXT NOT NULL,
    "market_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "reported_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "price_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "price_reports_price_positive" CHECK ("price" > 0),
    CONSTRAINT "price_reports_product_ean_fkey" FOREIGN KEY ("product_ean") REFERENCES "public"."products"("ean") ON DELETE CASCADE,
    CONSTRAINT "price_reports_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE RESTRICT,
    CONSTRAINT "price_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT,
    CONSTRAINT "price_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "price_reports_product_market_status_created_idx" ON "public"."price_reports" ("product_ean", "market_id", "status", "created_at" DESC);
CREATE INDEX "price_reports_reported_by_idx" ON "public"."price_reports" ("reported_by");

ALTER TABLE "public"."price_reports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_reports_select_active" ON "public"."price_reports" FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "price_reports_select_own" ON "public"."price_reports" FOR SELECT TO authenticated USING (reported_by = auth.uid());
CREATE POLICY "price_reports_select_operator" ON "public"."price_reports" FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.id = auth.uid() AND p.is_operator));
-- Reporte nasce ACTIVE ou PENDING_REVIEW (decisão do service, per research.md#2) —
-- nunca REJECTED direto no insert, esse estado só existe via moderação (UPDATE).
CREATE POLICY "price_reports_insert_own" ON "public"."price_reports" FOR INSERT TO authenticated
    WITH CHECK (reported_by = auth.uid() AND status IN ('ACTIVE', 'PENDING_REVIEW'));
CREATE POLICY "price_reports_update_operator" ON "public"."price_reports" FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.id = auth.uid() AND p.is_operator))
    WITH CHECK (true);

GRANT SELECT ON "public"."price_reports" TO anon, authenticated;
-- Grant de coluna: preço/produto/mercado/autor nunca são reescrevíveis depois de criados
-- (trilha de auditoria imutável) — só status/reviewed_by/reviewed_at mudam, e só via UPDATE.
GRANT INSERT ("product_ean", "market_id", "price", "status", "reported_by") ON "public"."price_reports" TO authenticated;
GRANT UPDATE ("status", "reviewed_by", "reviewed_at") ON "public"."price_reports" TO authenticated;

-- price_confirmations ---------------------------------------------------

CREATE TABLE "public"."price_confirmations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "price_report_id" UUID NOT NULL,
    "confirmed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "price_confirmations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "price_confirmations_unique_per_person" UNIQUE ("price_report_id", "confirmed_by"),
    CONSTRAINT "price_confirmations_price_report_id_fkey" FOREIGN KEY ("price_report_id") REFERENCES "public"."price_reports"("id") ON DELETE CASCADE,
    CONSTRAINT "price_confirmations_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."price_confirmations" ENABLE ROW LEVEL SECURITY;

-- Contagem pública de confirmações só enxerga linhas de reportes ativos
CREATE POLICY "price_confirmations_select_for_active_reports" ON "public"."price_confirmations" FOR SELECT
    USING (EXISTS (SELECT 1 FROM "public"."price_reports" pr WHERE pr.id = price_report_id AND pr.status = 'ACTIVE'));
CREATE POLICY "price_confirmations_select_own" ON "public"."price_confirmations" FOR SELECT TO authenticated USING (confirmed_by = auth.uid());
CREATE POLICY "price_confirmations_insert_own" ON "public"."price_confirmations" FOR INSERT TO authenticated WITH CHECK (confirmed_by = auth.uid());

GRANT SELECT ON "public"."price_confirmations" TO anon, authenticated;
GRANT INSERT ON "public"."price_confirmations" TO authenticated;

-- profiles: leitura pública restrita a colunas de ranking (nunca e-mail) --

CREATE POLICY "profiles_select_public_leaderboard" ON "public"."profiles" FOR SELECT TO anon USING (true);
GRANT SELECT ("id", "display_name", "avatar_url", "points") ON "public"."profiles" TO anon;

-- profiles: escrita de pontos (gamificação) — só a própria coluna "points",
-- nunca e-mail/nome/avatar/is_operator por essa via.
CREATE POLICY "profiles_update_own_points" ON "public"."profiles" FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
-- Estorno de pontos é feito pelo operador na própria decisão de rejeição
-- (o autor do conteúdo não é quem está autenticado nesse momento).
CREATE POLICY "profiles_update_operator_points" ON "public"."profiles" FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.id = auth.uid() AND p.is_operator))
    WITH CHECK (true);

GRANT UPDATE ("points") ON "public"."profiles" TO authenticated;

-- app_runtime também precisa assumir "anon" para as leituras públicas
-- (PrismaService.asPublic) — mesmo padrão já usado para "authenticated".
GRANT anon TO app_runtime;
