# Tasks: Login social com Google

**Input**: Design documents from `/specs/001-login-social-com/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Não solicitados na spec nem no plan como TDD — a fase de testes deste workspace roda depois, via `/test` (comando próprio, pós-`/speckit-implement`), não dentro deste tasks.md.

**Organization**: Tarefas agrupadas por user story (US1 = Entrar com Google, US2 = Sair da conta).

## Pré-requisito manual (fora do escopo de qualquer task abaixo)

Habilitar o provider Google em Authentication → Providers → Google no Dashboard do Supabase do projeto `poupe-certo`, com Client ID/Secret criados no Google Cloud Console, e configurar Site URL/Redirect URLs (local + produção). Não é automatizável via MCP/CLI — é passo manual do usuário antes de US1 ser testável ponta a ponta (o backend funciona sem isso, só não há como completar o login de verdade).

---

## Phase 1: Setup

**Purpose**: Inicialização do projeto Nest neste repositório (hoje só tem o workspace-template, sem app).

- [X] T001 Gerar o projeto NestJS 12.0.1 na raiz do repositório (`package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts` mínimos) conforme estrutura do `plan.md`
- [X] T002 Instalar dependências: `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/throttler`, `helmet`, `jose`, `zod`, `nestjs-zod`, `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`
- [X] T003 [P] Configurar ESLint/Prettier padrão Nest em `.eslintrc`/`eslint.config.mjs` e `.prettierrc`
- [X] T004 [P] Criar `.env.example` na raiz com `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `FRONTEND_URL` (placeholders, sem segredo real)

**Checkpoint**: `npm run start:dev` sobe um Nest vazio sem erro.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura que todas as user stories dependem — banco, config, erro, boot.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase terminar.

- [X] T005 Rodar `npx prisma init` e configurar `prisma/schema.prisma` com `datasource db { url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }` per `research.md#3`
- [ ] T006 Criar migration Prisma (`prisma/migrations/..._init_profiles/migration.sql`) que: cria `public.profiles` (campos de `data-model.md`), habilita RLS com policy `auth.uid() = id`, cria a role `app_runtime` (sem `BYPASSRLS`, `GRANT SELECT` em `profiles`) per `research.md#4`, e cria o trigger `AFTER INSERT ON auth.users` que popula `profiles` per `research.md#5`
- [X] T007 [P] Implementar `PrismaService`/`PrismaModule` (singleton cacheado em `globalThis`, `@prisma/adapter-pg`) em `src/prisma/prisma.service.ts` e `src/prisma/prisma.module.ts`
- [X] T008 [P] Implementar schema Zod de env vars e `ConfigModule` com validação no boot em `src/common/config/env.schema.ts`
- [X] T009 [P] Implementar filtro global de exceção (nunca vaza stack trace/erro do Prisma) em `src/common/filters/http-exception.filter.ts`
- [X] T010 Montar `src/main.ts`/`src/app.module.ts`: `helmet`, CORS restrito a `FRONTEND_URL`, `ThrottlerModule`, pipe de validação Zod global, filtro global (depende de T007, T008, T009)
- [X] T011 Criar entrypoint serverless `api/index.ts` (bootstrap Nest cacheado entre invocações, `ExpressAdapter`) e `vercel.json` per `research.md#6`

**Checkpoint**: app sobe local com Prisma conectado no Postgres do Supabase; `prisma migrate deploy` aplicado sem erro.

---

## Phase 3: User Story 1 - Entrar com Google (Priority: P1) 🎯 MVP

**Goal**: pessoa autentica com a própria conta Google e chega autenticada na aplicação, com perfil criado automaticamente.

**Independent Test**: `quickstart.md` passos 1–4 — health check público, `/users/me` nega sem token, `/users/me` devolve perfil correto com token válido, perfil aparece em `profiles` sem chamada manual.

### Implementation for User Story 1

- [X] T012 [US1] Implementar `SupabaseJwtGuard` (verifica Bearer token via `jose` + `createRemoteJWKSet` contra `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) em `src/auth/supabase-jwt.guard.ts`
- [X] T013 [P] [US1] Implementar decorator `@CurrentUser()` (extrai `sub`/claims do request) em `src/auth/current-user.decorator.ts`
- [X] T014 [P] [US1] Montar `AuthModule` em `src/auth/auth.module.ts` (depende de T012, T013)
- [X] T015 [US1] Implementar `UsersService.findByAuthId` (busca `profiles` via Prisma) em `src/users/users.service.ts` (depende de T007)
- [X] T016 [US1] Implementar `UsersController` com `GET /users/me` (protegido por `SupabaseJwtGuard`, formato de resposta per `contracts/api.md`) em `src/users/users.controller.ts` (depende de T012, T013, T015)
- [X] T017 [US1] Montar `UsersModule` e registrar em `AppModule` (depende de T014, T016)
- [X] T018 [P] [US1] Implementar `HealthController` com `GET /health` público (sem guard) em `src/health/health.controller.ts`

**Checkpoint**: User Story 1 completa e testável sozinha via `quickstart.md`.

---

## Phase 4: User Story 2 - Sair da conta (Priority: P2)

**Goal**: pessoa autenticada encerra a própria sessão.

**Independent Test**: após "Sair", nova tentativa de acessar `/users/me` com o token antigo (uma vez expirado/revogado no client) exige novo login.

**Nota de escopo**: FR-005 é satisfeito inteiramente pelo Supabase Auth do lado do frontend (`supabase.auth.signOut()` encerra a sessão local e revoga o refresh token direto no GoTrue) — não existe estado de sessão no Nest para invalidar (o backend só valida assinatura/expiração do JWT, sem sessão própria). **Nenhuma tarefa de backend nesta fase** — YAGNI: criar um endpoint de logout no Nest seria estado duplicado sem função real.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T019 [P] Validar a policy de RLS de `profiles` com uma query via `mcp__supabase__execute_sql` usando a role `app_runtime` (confirmar que ela não bypassa RLS) — evidência anexada ao `security-review.md` na fase `/security`
- [ ] T020 Rodar `quickstart.md` ponta a ponta (health, 401 sem token, 200 com token, perfil sincronizado) e registrar resultado
- [X] T021 [P] Revisar `.env.example` e `README.md` do repo com instruções de setup real (sem segredo, só placeholders)

---

## Dependencies & Execution Order

- **Setup (Fase 1)**: sem dependências.
- **Foundational (Fase 2)**: depende da Fase 1 — bloqueia todas as user stories.
- **US1 (Fase 3)**: depende só da Fase 2.
- **US2 (Fase 4)**: depende só da Fase 2; sem tarefas de backend (ver nota de escopo).
- **Polish (Fase 5)**: depende de US1 completa (T019/T020 exercitam o que US1 construiu).

## Parallel Example: Foundational

```bash
Task: "Implementar PrismaService/PrismaModule em src/prisma/prisma.service.ts"
Task: "Implementar schema Zod de env vars em src/common/config/env.schema.ts"
Task: "Implementar filtro global de exceção em src/common/filters/http-exception.filter.ts"
```

## Implementation Strategy

### MVP First

1. Fase 1 (Setup) → Fase 2 (Foundational) → Fase 3 (US1) → **STOP, validar via `quickstart.md`**.
2. Fase 4 (US2) não tem tarefa de backend — já está coberta pelo Supabase Auth; validar só do lado do frontend quando essa feature acontecer lá.
3. Fase 5 (Polish) fecha a feature antes de `/test`, `/security`, `/review`.

## Notes

- 21 tarefas no total (T001–T021), sem contar o pré-requisito manual (provider Google no Supabase Dashboard).
- `[P]` = arquivos diferentes, sem dependência entre si.
- Nenhuma tarefa de teste automatizado aqui de propósito — cai pro comando `/test` deste workspace, depois do `/speckit-implement`.
