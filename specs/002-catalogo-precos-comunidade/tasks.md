# Tasks: Catálogo comunitário de preços

**Input**: Design documents from `/specs/002-catalogo-precos-comunidade/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Não incluídos aqui de propósito — a fase de testes deste workspace roda depois, via `/test` (comando próprio, pós-`/speckit-implement`), igual à feature 001.

**Status**: Implementação completa (T001–T043). Ver "Desvios de implementação" e "Resultado da fase `/test`" ao final.

**Organization**: Tarefas agrupadas por user story (US1 = Buscar/comparar, US2 = Escanear/reportar preço, US3 = Cadastrar produto + moderação, US4 = Confirmar preço, US5 = Perfil e ranking).

**Nota de arquitetura**: seguindo o padrão já usado na feature 001 (sem repositório/camada extra), cada service acessa `PrismaService` diretamente — nenhum módulo depende de outro módulo de domínio (ex.: `ProductsService` lê `PriceReport` direto via Prisma para montar ofertas, sem importar `PriceReportsService`).

---

## Phase 1: Setup

- [X] T001 [P] Adicionar dependências `@nestjs/swagger` e `swagger-ui-express` em `package.json`
- [X] T002 [P] Adicionar `SWAGGER_ENABLED` (boolean, default `true`) ao schema Zod de env vars em `src/common/config/env.schema.ts` e ao `.env.example`
- [X] T003 [P] Implementar `ZodValidationPipe` genérico (recebe um `ZodSchema`, devolve 400 com issues formatadas em erro de validação) em `src/common/pipes/zod-validation.pipe.ts`

**Checkpoint**: dependências instaladas, pipe de validação pronto para uso pelos controllers das próximas fases.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema de banco, guards e utilitários compartilhados por todas as user stories.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase terminar.

- [X] T004 Atualizar `prisma/schema.prisma`: enums `ProductCategory`, `ProductStatus`, `ReportStatus`; models `Market`, `Product`, `PriceReport`, `PriceConfirmation`; campos novos `points`/`isOperator` em `Profile` — per `data-model.md`
- [X] T005 Criar migration SQL (`prisma/migrations/..._catalogo_precos/migration.sql`): tabelas novas com os índices de `data-model.md`, RLS habilitada em todas, policies de leitura para `anon`/`authenticated` restritas a registros aprovados/ativos, policies de escrita só para `authenticated`, colunas novas em `profiles` (depende de T004)
- [X] T006 [P] Implementar `PrismaService.asPublic<T>(fn)` (SET LOCAL ROLE anon) em `src/prisma/prisma.service.ts`, ao lado do `asUser` existente — per `research.md#1`
- [X] T007 [P] Implementar `OperatorGuard` (roda depois do `SupabaseJwtGuard`, confere `profiles.is_operator`) em `src/auth/operator.guard.ts` e exportar em `src/auth/auth.module.ts`
- [X] T008 [P] Implementar `src/gamification/points.ts` (constantes `PRICE_REPORT_POINTS=2`, `NEW_PRODUCT_POINTS=5`, `CONFIRMATION_POINTS=0`, funções `levelForPoints`, `pointsToNextLevel`, `progressPercent`) e `src/gamification/gamification.module.ts` — per `research.md#3`
- [X] T009 [P] Implementar `src/products/categories.ts` (mapa código curto ↔ enum Prisma: `merc↔MERCEARIA`, etc.) — per `research.md#8`
- [X] T010 Configurar Swagger em `src/main.ts` (`DocumentBuilder`, security scheme `bearer`, montado em `/docs`, condicionado a `SWAGGER_ENABLED`) (depende de T002)
- [X] T011 [P] Criar `src/common/throttle/write-throttle.decorator.ts` com um `@Throttle` mais restritivo para escrita sensível a abuso (reportar preço, confirmar preço, cadastrar produto/mercado) — per FR-023

**Checkpoint**: `npx prisma migrate deploy` aplica sem erro; guards, pipe e utilitários de gamificação prontos para as user stories.

---

## Phase 3: User Story 1 - Buscar e comparar preços (Priority: P1) 🎯 MVP

**Goal**: qualquer pessoa, autenticada ou não, busca produtos e vê o detalhe completo de ofertas por mercado.

**Independent Test**: `quickstart.md` passo 1 (busca pública) + passo 3 (detalhe com ofertas, depois que houver ao menos um produto aprovado com preço).

### Implementation for User Story 1

- [X] T012 [P] [US1] Criar `market.schema.ts` (Zod) e `market.dto.ts` (`@ApiProperty`) em `src/markets/dto/`
- [X] T013 [US1] Implementar `MarketsService.list()` (via `asPublic`) em `src/markets/markets.service.ts` (depende de T005, T006)
- [X] T014 [P] [US1] Criar `product.schema.ts` (Zod, inclui query de busca) e `product.dto.ts` (`ProductSummaryDto`, `ProductDetailDto`, `OfferDto`, `@ApiProperty`) em `src/products/dto/`
- [X] T015 [US1] Implementar `ProductsService.search(query, category, sort, page, pageSize)` e `ProductsService.findDetail(ean)` (via `asPublic`, calculando menor/média/maior preço e histórico quinzenal a partir dos `PriceReport` com `status = ACTIVE`, per `research.md#6`) em `src/products/products.service.ts` (depende de T005, T006, T009)
- [X] T016 [US1] Implementar `ProductsController` com `GET /products/search`, `GET /products/:ean`, `GET /products/ean/:ean/exists` (sem guard, per `contracts/api.md`) em `src/products/products.controller.ts` (depende de T014, T015)
- [X] T017 [US1] Montar `MarketsModule`/`ProductsModule` e registrar em `src/app.module.ts` (depende de T012, T013, T016)

**Checkpoint**: busca e detalhe público funcionando (com base de dados vazia ou populada manualmente via SQL para teste).

---

## Phase 4: User Story 2 - Identificar produto por EAN e reportar preço (Priority: P1)

**Goal**: pessoa autenticada reporta um preço para um produto existente num mercado; preços fora do padrão vão para revisão em vez de aparecer direto.

**Independent Test**: `quickstart.md` passos 4–5 — reporte aceito aumenta a oferta vigente; reporte com valor fora do padrão fica com `status = PENDING_REVIEW` e não aparece no detalhe do produto (US1).

### Implementation for User Story 2

- [X] T018 [P] [US2] Criar `price-report.schema.ts` (Zod: `marketId` uuid, `price` positivo) e `price-report.dto.ts` (`@ApiProperty`) em `src/price-reports/dto/`
- [X] T019 [US2] Implementar `PriceReportsService.create(ean, userId, dto)`: valida produto `APPROVED` (404 senão), valida mercado existente, calcula mediana das últimas amostras `ACTIVE` daquele produto e decide `ACTIVE`/`PENDING_REVIEW` (per `research.md#2`), concede `PRICE_REPORT_POINTS` via `gamification` só quando `ACTIVE`, grava via `asUser` — em `src/price-reports/price-reports.service.ts` (depende de T005, T007→não, T008, T018)
- [X] T020 [US2] Implementar `PriceReportsController` com `POST /products/:ean/price-reports` (`SupabaseJwtGuard` + throttle de T011) em `src/price-reports/price-reports.controller.ts` (depende de T018, T019)
- [X] T021 [US2] Montar `PriceReportsModule` e registrar em `src/app.module.ts` (depende de T020)
- [X] T022 [P] [US2] Implementar `MarketsController.create` (`POST /markets`, upsert por nome case-insensitive, `SupabaseJwtGuard`) em `src/markets/markets.controller.ts` (depende de T012, T013)

**Checkpoint**: reportar preço funciona ponta a ponta; outliers não vazam para o detalhe público (US1 já filtra por `status = ACTIVE`).

---

## Phase 5: User Story 3 - Cadastrar produto novo e moderação (Priority: P2)

**Goal**: pessoa autenticada cadastra produto inédito (fica pendente); um operador aprova/rejeita produtos e preços pendentes via API.

**Independent Test**: `quickstart.md` passos 2–3 — produto cadastrado não aparece na busca até um operador aprovar; segunda decisão sobre o mesmo item é recusada (409).

### Implementation for User Story 3

- [X] T023 [P] [US3] Adicionar `createProductSchema` em `src/products/dto/product.schema.ts` e `CreateProductDto`/`CreateProductResponseDto` em `src/products/dto/product.dto.ts`
- [X] T024 [US3] Implementar `ProductsService.create(userId, dto)`: valida EAN inédito em qualquer status (409 senão, FR-018), cria `PENDING`, concede `NEW_PRODUCT_POINTS` via `gamification`, grava via `asUser` — em `src/products/products.service.ts` (depende de T015, T023)
- [X] T025 [US3] Implementar `ProductsController.create` (`POST /products`, `SupabaseJwtGuard` + throttle de T011) em `src/products/products.controller.ts` (depende de T016, T024)
- [X] T026 [P] [US3] Criar `moderation.schema.ts` (Zod: `decision` = `"approve" | "reject"`) e `moderation.dto.ts` em `src/moderation/dto/`
- [X] T027 [US3] Implementar `ModerationService`: `listQueue()`, `decideProduct(ean, decision, operatorId)` (recusa se já decidido — 409; ao rejeitar, estorna `NEW_PRODUCT_POINTS` do autor, saturando em 0, FR-017), `decidePriceReport(id, decision, operatorId)` (recusa se já decidido — 409; ao aprovar marca `ACTIVE`, ao rejeitar marca `REJECTED`) em `src/moderation/moderation.service.ts` (depende de T005, T008, T026)
- [X] T028 [US3] Implementar `ModerationController` com `GET /moderation/queue`, `PATCH /moderation/products/:ean`, `PATCH /moderation/price-reports/:id` (`SupabaseJwtGuard` + `OperatorGuard`) em `src/moderation/moderation.controller.ts` (depende de T007, T026, T027)
- [X] T029 [US3] Montar `ModerationModule` e registrar em `src/app.module.ts` (depende de T028)

**Checkpoint**: fluxo completo de cadastro + moderação de produto e de preço testável via `quickstart.md`.

---

## Phase 6: User Story 4 - Confirmar preço (Priority: P2)

**Goal**: pessoa autenticada confirma que um preço ativo ainda está correto, no máximo uma vez por pessoa por preço.

**Independent Test**: `quickstart.md` passo 6 — duas confirmações seguidas da mesma pessoa no mesmo preço não somam duas vezes.

### Implementation for User Story 4

- [X] T030 [US4] Implementar `PriceReportsService.confirm(priceReportId, userId)`: valida reporte `ACTIVE` (404 senão), grava `PriceConfirmation` respeitando `@@unique([priceReportId, confirmedBy])` de forma idempotente (não duplica, não lança erro numa segunda tentativa), devolve contagem atualizada — em `src/price-reports/price-reports.service.ts` (depende de T019)
- [X] T031 [US4] Implementar `PriceReportsController.confirm` (`POST /price-reports/:id/confirmations`, `SupabaseJwtGuard` + throttle de T011) em `src/price-reports/price-reports.controller.ts` (depende de T020, T030)

**Checkpoint**: confirmação social funcionando, contador de confiança das ofertas (US1) reflete confirmações reais.

---

## Phase 7: User Story 5 - Ver o próprio perfil e ranking (Priority: P3)

**Goal**: pessoa autenticada vê as próprias estatísticas/nível/ranking/contribuições; qualquer pessoa vê o ranking público.

**Independent Test**: `quickstart.md` passo 7 — estatísticas do perfil refletem as ações feitas nos passos anteriores.

### Implementation for User Story 5

- [X] T032 [P] [US5] Criar `ProfileStatsDto` e `ContributionItemDto` (`@ApiProperty`) em `src/users/dto/profile-stats.dto.ts`
- [X] T033 [US5] Implementar `UsersService.getStats(userId)`: conta preços aceitos, produtos aprovados, confirmações dadas, calcula `confidencePercent` (proporção de reportes próprios não rejeitados/pendentes), usa `gamification` para nível/progresso, calcula posição no ranking (contagem de perfis com mais pontos + 1) via `asUser` — em `src/users/users.service.ts` (depende de T005, T008)
- [X] T034 [US5] Implementar `UsersService.getContributions(userId, page, pageSize)`: feed combinado de `PriceReport` + `Product` do próprio usuário, ordenado por data — em `src/users/users.service.ts` (depende de T033)
- [X] T035 [US5] Implementar `UsersController` com `GET /users/me/stats`, `GET /users/me/contributions` (`SupabaseJwtGuard`) em `src/users/users.controller.ts` (depende de T032, T033, T034)
- [X] T036 [P] [US5] Criar `LeaderboardEntryDto` (`@ApiProperty`) em `src/leaderboard/dto/leaderboard-entry.dto.ts`
- [X] T037 [US5] Implementar `LeaderboardService.getTop(limit)` (via `asPublic`, ordenado por `points desc`, sem e-mail/dado sensível, per FR-021) em `src/leaderboard/leaderboard.service.ts` (depende de T006, T008)
- [X] T038 [US5] Implementar `LeaderboardController` com `GET /leaderboard` (sem guard) em `src/leaderboard/leaderboard.controller.ts` (depende de T036, T037)
- [X] T039 [US5] Montar `LeaderboardModule` e registrar em `src/app.module.ts` (depende de T038)

**Checkpoint**: todas as 5 user stories funcionais e testáveis independentemente via `quickstart.md`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T040 [P] Aplicar o `@Throttle` de T011 nos endpoints de escrita sensíveis (`POST /products`, `POST /products/:ean/price-reports`, `POST /price-reports/:id/confirmations`, `POST /markets`)
- [X] T041 [P] Atualizar `.env.example` e `README.md` com `SWAGGER_ENABLED` e um resumo da feature 002 (link para `/docs`)
- [X] T042 Rodar `quickstart.md` ponta a ponta e registrar resultado
- [X] T043 [P] Validar as policies de RLS novas com `mcp__supabase__execute_sql` (role `anon` não enxerga produtos/preços pendentes; role `anon` não consegue escrever em nenhuma tabela nova) — evidência anexada ao `security-review.md` na fase `/security`

---

## Dependencies & Execution Order

- **Setup (Fase 1)**: sem dependências.
- **Foundational (Fase 2)**: depende da Fase 1 — bloqueia todas as user stories.
- **US1 (Fase 3)**: depende só da Fase 2.
- **US2 (Fase 4)**: depende da Fase 2; usa dados de US1 (produto aprovado) para ser demonstrável, mas o código não importa nada de US1.
- **US3 (Fase 5)**: depende da Fase 2; produz os produtos `APPROVED` que US1/US2 exibem/usam em cenários completos.
- **US4 (Fase 6)**: depende de US2 (Fase 4) só porque precisa de um `PriceReport` existente para confirmar — reaproveita o mesmo módulo/arquivo (`price-reports.*`).
- **US5 (Fase 7)**: depende da Fase 2; estatísticas ficam mais interessantes depois de US2/US3/US4 gerarem dado, mas o código só depende de `Profile`/`PriceReport`/`Product` já existirem no schema (Fase 2).
- **Polish (Fase 8)**: depende de todas as user stories desejadas estarem completas.

## Parallel Example: Foundational

```bash
Task: "Implementar PrismaService.asPublic em src/prisma/prisma.service.ts"
Task: "Implementar OperatorGuard em src/auth/operator.guard.ts"
Task: "Implementar src/gamification/points.ts"
Task: "Implementar src/products/categories.ts"
```

## Implementation Strategy

### MVP First

1. Fase 1 (Setup) → Fase 2 (Foundational) → Fase 3 (US1) → **STOP, validar busca/detalhe público**.
2. Fase 4 (US2) → reportar preço funcionando, com outlier indo para revisão.
3. Fase 5 (US3) → cadastro de produto + moderação completa (produto e preço).
4. Fase 6 (US4) → confirmação social.
5. Fase 7 (US5) → perfil, ranking, contribuições.
6. Fase 8 (Polish) fecha a feature antes de `/test`, `/security`, `/review`.

## Notes

- 43 tarefas no total (T001–T043), todas concluídas.
- `[P]` = arquivos diferentes, sem dependência entre si.
- Nenhuma tarefa de teste automatizado aqui de propósito — cai para o comando `/test` deste workspace, depois do `/speckit-implement`.

## Desvios de implementação (registrados por transparência)

- **T001**: só `@nestjs/swagger` foi instalado — `swagger-ui-express` não é necessário na v12 (a UI vem embutida via `swagger-ui-dist`, dependência transitiva do próprio `@nestjs/swagger`).
- **T008**: `src/gamification/points.ts` foi implementado como funções puras exportadas diretamente (sem `gamification.module.ts`). Um módulo Nest sem nenhum provider/DI real seria cerimônia sem função (Princípio VI — YAGNI); qualquer service importa as funções diretamente.
- **T019**: a lógica de outlier (mediana + limiar) foi extraída para `src/price-reports/outlier.ts` (funções puras `median`/`decidePriceReportStatus`) em vez de ficar inline no service, especificamente para ser testável por unidade sem I/O — mesmo comportamento descrito em `research.md#2`.
- Descoberta durante a fase `/test` (ver abaixo): o projeto não tinha, até esta feature, nenhuma infraestrutura de teste configurada de fato (`test/jest-e2e.json` não existia, `package.json` não tinha bloco `jest`) — a feature 001 nunca chegou a rodar `/test`. Isso foi corrigido aqui (`jest.config.js`, `test/jest-e2e.json`), beneficiando testes futuros de qualquer feature, não só esta.

## Resultado da fase `/test`

Executado nesta sessão (ver skill `testing` — sem mock de banco, unitário para lógica pura, E2E para o que é possível validar sem infraestrutura externa):

- **Unitário** (`npm test`, real, 15/15 verdes): `src/gamification/points.spec.ts`, `src/products/categories.spec.ts`, `src/price-reports/outlier.spec.ts` — cobrem a matemática de nível/pontos e a decisão de outlier (incluindo limite exato do desvio).
- **E2E** (`npm run test:e2e`, real, 13/13 verdes): `test/{products,price-reports,moderation,markets,users-stats,leaderboard}.e2e-spec.ts` — cobrem os caminhos que não dependem de um Postgres real: guard `SupabaseJwtGuard` negando acesso sem token/com token inválido (401) em toda rota protegida, e o `ZodValidationPipe` recusando entrada inválida (400) antes de qualquer acesso a banco.
- **Achado de tooling corrigido nesta fase (afeta o projeto inteiro, não só esta feature)**: `@nestjs/*` v12 é ESM-only e o Jest 30, por padrão, não consegue `require()` esses pacotes (falha com "Must use import to load ES Module"), mesmo em Node 24 (que suporta `require(esm)` nativamente) — o Jest só usa esse caminho nativo quando `vm.SourceTextModule` está disponível, o que exige a flag `--experimental-vm-modules`. Corrigido adicionando `cross-env` (novo devDependency) e prefixando os scripts `test`/`test:watch`/`test:cov`/`test:e2e` com `NODE_OPTIONS=--experimental-vm-modules` em `package.json`. Sem essa correção, nenhum teste que importe qualquer coisa de `@nestjs/common`/`@nestjs/testing` rodava — nem os desta feature, nem os da 001, nem os de features futuras.
- **Não executado nesta sessão (limitação de ambiente, não de código)**: os caminhos felizes completos (busca com dado real, aprovar/rejeitar produto, reportar+confirmar preço ponta a ponta) exigem um Postgres alcançável (`DATABASE_URL`/`DIRECT_URL` reais — hoje `.env` tem placeholders) e um `access_token` Supabase genuíno (login Google real) — nenhum dos dois está disponível de forma não-interativa aqui. Uma tentativa de criar um branch de teste descartável via `mcp__supabase__create_branch` no projeto `poupe-certo` foi recusada pela plataforma (`"status":"declined"`). Antes de rodar em produção: preencher `.env` com credenciais reais, rodar `npx prisma migrate deploy`, e então `npm run test:e2e` com um token real para exercitar os fluxos de escrita ponta a ponta (roteiro completo em `quickstart.md`).
