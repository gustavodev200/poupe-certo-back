-- Onboarding com localização real (IBGE): Profile passa a guardar a
-- cidade/UF escolhida no onboarding, persistindo entre dispositivos.
ALTER TABLE "public"."profiles"
    ADD COLUMN "city" TEXT,
    ADD COLUMN "uf" CHAR(2);

-- Reaproveita a policy "profiles_update_own_points" já existente
-- (FOR UPDATE ... USING (id = auth.uid()) WITH CHECK (id = auth.uid())):
-- RLS é por linha, não por coluna — só falta liberar as colunas novas para
-- quem já pode atualizar a própria linha. Nenhuma policy nova é necessária.
GRANT UPDATE ("city", "uf") ON "public"."profiles" TO authenticated;
