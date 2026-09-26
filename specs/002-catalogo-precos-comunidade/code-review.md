# Code Review: Catálogo comunitário de preços

- **Spec**: `spec.md` | **Plan**: `plan.md` | **Security Review**: `security-review.md`
- **Status**: Aprovado

Ver skill `code-review` para o checklist completo. Achados encontrados nesta revisão foram corrigidos no próprio código antes de fechar a fase (não ficaram como pendência).

## Achados

| Arquivo:Linha | Severidade | Problema | Correção sugerida |
|---|---|---|---|
| `src/common/config/env.schema.ts:9` | Alta | `z.coerce.boolean()` usa `Boolean(...)` do JS — a *string* `"false"` (não-vazia) coage para `true`. `SWAGGER_ENABLED=false` no `.env` não desligaria o Swagger, contradizendo a mitigação de segurança registrada em `security-review.md`. | Comparar o texto explicitamente (`value.toLowerCase() !== 'false'`) em vez de `z.coerce.boolean()`. **Corrigido nesta sessão.** |
| `src/gamification/points.ts:15-17` (antes da correção) | Média | `pointsToNextLevel` devolvia o patamar absoluto do próximo nível (ex.: 200), mas FR-019 do `spec.md` pede "pontos restantes para o próximo nível" (ex.: 68 quando já se tem 132) — divergência semântica entre spec e implementação, mesmo com testes passando (os testes validavam o comportamento errado). | Redefinir para `threshold - points`. **Corrigido nesta sessão** — `points.spec.ts`, `contracts/api.md` e `profile-stats.dto.ts` atualizados juntos para não ficarem inconsistentes entre si. |
| `src/leaderboard/leaderboard.service.ts:18-24` (antes da correção) | Média (performance) | N+1: uma query `priceReport.count()` por perfil do ranking (até `limit`, padrão 20, máx. 100) em vez de uma única consulta agregada. | Substituir por `priceReport.groupBy({ by: ['reportedBy'], ... })` e indexar os resultados num `Map`. **Corrigido nesta sessão.** |
| `src/price-reports/price-reports.controller.ts` / `src/moderation/moderation.controller.ts` (antes da correção) | Baixa | Parâmetros de rota `id` (UUID) e `ean` sem `ZodValidationPipe` — valor malformado vazava como 500 genérico em vez de 400 (viola Princípio II da constituição). | Validar via `ZodValidationPipe` com `uuidParamSchema`/`eanSchema`, como já era feito em `products.controller.ts`. **Corrigido nesta sessão** (ver `security-review.md` para o mesmo achado do ponto de vista de segurança). |
| `prisma/migrations/.../migration.sql` (antes da correção) | Média (segurança) | `GRANT UPDATE`/`GRANT INSERT` de tabela inteira em `products`/`price_reports` para `authenticated`, sem restrição de coluna — um operador (ou sessão de operador comprometida) poderia reescrever `name`/`brand`/`price`/`created_by` via uma query diferente da rota oficial de moderação. | Restringir a `GRANT` às colunas realmente necessárias (`status`, `reviewed_by`, `reviewed_at` no UPDATE). **Corrigido nesta sessão** (detalhe completo em `security-review.md`). |

Nenhum achado adicional de correção, YAGNI ou consistência de preset além dos listados acima.

## Confirmação de itens da Security Review

- [x] Todo item "Pendente" de `security-review.md` foi resolvido ou explicitamente aceito como risco (2 riscos aceitos, ambos documentados com justificativa: dependências transitivas do Prisma/MySQL adapter não usado, e Swagger público por decisão explícita do usuário).

## Confirmação de escopo

- [x] Implementação cobre todos os requisitos funcionais de `spec.md` (FR-001 a FR-023 conferidos um a um contra o código, não só contra o plano).
- [x] Nenhuma funcionalidade fora do escopo foi adicionada — favoritos/lista de compras, localização/distância e filtro por cidade continuam fora, exatamente como registrado em "Assumptions" do `spec.md`.
- [x] Testes de `tasks.md` existem e passam de verdade: `npm test` (16/16, unitário) e `npm run test:e2e` (13/13, e2e) executados nesta sessão, não apenas assumidos.

## Simplicidade e reuso (YAGNI)

- Nenhuma abstração para caso hipotético: sem tabela de "preço vigente" desnormalizada, sem RBAC genérico (só o booleano `is_operator` que a spec pede), sem módulo Nest vazio só por convenção (`gamification/points.ts` é função pura, sem `gamification.module.ts` — ver desvio já registrado em `tasks.md`).
- Reuso do padrão já estabelecido pela feature 001 (`PrismaService.asUser`, filtro de exceção global, Zod na borda) em vez de introduzir um padrão novo — `asPublic` é a única peça de infraestrutura nova, e é uma extensão direta do método existente.

## Consistência com o preset

- `project.config.json` confirma `preset: "prisma-postgres"` com o desvio documentado de `auth: "supabase-auth"` — nenhum código de `supabase-js`/PostgREST vazou; todo acesso a dado continua via Prisma (`PrismaService`), consistente com a feature 001.

## Conclusão

**Aprovado.** Todos os achados desta revisão (2 de correção/spec, 1 de performance, 1 de robustez/borda, 1 de segurança — este último em duplicidade com `security-review.md`) foram corrigidos no código antes de fechar a fase, com build (`nest build`), lint (`eslint`) e as duas suítes de teste (`npm test`, `npm run test:e2e`) verificados em verde após cada correção. Feature pronta para integração — falta apenas, como passo manual do usuário fora do escopo de código: preencher `.env` com credenciais reais do Supabase, rodar `npx prisma migrate deploy`, e validar o `quickstart.md` ponta a ponta com um login real.
