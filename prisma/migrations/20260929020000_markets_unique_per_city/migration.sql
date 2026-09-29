-- Mercado é hiperlocal: o mesmo nome de rede ("Atacadão") pode existir em
-- várias cidades. O índice único antigo era só por lower(name), global —
-- fazia o cadastro numa cidade reaproveitar o mercado de outra.
DROP INDEX IF EXISTS "public"."markets_name_lower_key";

CREATE UNIQUE INDEX "markets_name_city_uf_lower_key"
  ON "public"."markets" (lower("name"), lower(coalesce("city", '')), coalesce("uf", ''));
