-- shopping_list_items -----------------------------------------------------
-- Lista de compras pessoal: dado 100% privado, sem contraparte pública
-- (diferente de price_reports/price_confirmations, que têm leitura anônima).

CREATE TABLE "public"."shopping_list_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "product_ean" TEXT NOT NULL,
    "market_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shopping_list_items_price_positive" CHECK ("price" > 0),
    CONSTRAINT "shopping_list_items_unique_per_person" UNIQUE ("user_id", "product_ean"),
    CONSTRAINT "shopping_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "shopping_list_items_product_ean_fkey" FOREIGN KEY ("product_ean") REFERENCES "public"."products"("ean") ON DELETE CASCADE,
    CONSTRAINT "shopping_list_items_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE RESTRICT
);

CREATE INDEX "shopping_list_items_user_id_idx" ON "public"."shopping_list_items" ("user_id");

ALTER TABLE "public"."shopping_list_items" ENABLE ROW LEVEL SECURITY;

-- Dado privado: uma única policy own-row cobre as quatro operações — não há
-- regra diferente por comando (diferente de price_reports, que tem
-- select-público vs. insert-próprio vs. update-operador).
CREATE POLICY "shopping_list_items_own_row" ON "public"."shopping_list_items"
    FOR ALL TO authenticated
    USING ("user_id" = auth.uid())
    WITH CHECK ("user_id" = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."shopping_list_items" TO authenticated;
