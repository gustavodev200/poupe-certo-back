-- Aprovar/rejeitar conteúdo de OUTRA pessoa mexe nos pontos dela
-- (ModerationService, rodando como o operador via asUser). A policy
-- "profiles_update_operator_points" já permitia o UPDATE, mas no Postgres a
-- linha também precisa passar numa policy de SELECT — e só existia
-- "profiles_select_own". Resultado: 0 linhas afetadas → Prisma P2025 → 500.
--
-- A checagem de operador fica numa função SECURITY DEFINER: uma policy de
-- SELECT em profiles consultando a própria profiles entraria em recursão.
CREATE FUNCTION "public"."current_user_is_operator"()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT is_operator FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

REVOKE ALL ON FUNCTION "public"."current_user_is_operator"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."current_user_is_operator"() TO authenticated;

CREATE POLICY "profiles_select_operator" ON "public"."profiles" FOR SELECT TO authenticated
    USING ("public"."current_user_is_operator"());
