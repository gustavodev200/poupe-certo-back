# Implementation Plan: Login social com Google

**Branch**: `001-login-social-com` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-login-social-com/spec.md`

## Summary

Bootstrap do backend NestJS do `poupe-certo`: autenticação via Google OAuth delegada ao Supabase Auth (GoTrue) do projeto Supabase já existente (`poupe-certo`, ref `mcuipdmthhpfbjneuspw`). O Nest nunca executa login — apenas valida o access token JWT emitido pelo Supabase (via JWKS do projeto) num `AuthGuard` global, sincroniza o perfil do usuário na primeira vez que ele aparece (trigger Postgres em `auth.users`), e expõe um endpoint autenticado (`GET /users/me`) que confirma a sessão. Acesso ao Postgres do próprio projeto Supabase é feito via Prisma ORM, com uma role de aplicação de privilégio mínimo (não a role usada para migrations). Deploy alvo: Vercel, função serverless Node, free tier.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22.x (runtime padrão atual do Vercel)

**Primary Dependencies**: NestJS 12.1 (`@nestjs/core`, `@nestjs/platform-express`), Prisma 7.10.0 estável (`prisma-client` generator engine-less + `@prisma/adapter-pg`; URLs de CLI em `prisma.config.ts`), `jose` (JWT via JWKS), `zod` 4 (env vars no boot), `helmet`, `@nestjs/throttler`, `@nestjs/config`. TypeScript 6.0.3 (TS 7 ainda incompatível com `ts-jest`).

**Desvios de versão registrados na implementação**: `nestjs-zod` removido (peer dep só até Nest 11) — esta feature não tem body/query de entrada, então Zod fica só nas env vars; um pipe próprio entra quando surgir o primeiro DTO. Tag `latest` do npm do Prisma aponta pra `8.0.0-rc` (CLI novo, incompatível) — fixado em `7.10.0` (`prev`, estável).

**Storage**: PostgreSQL do projeto Supabase `poupe-certo` (ref `mcuipdmthhpfbjneuspw`), acessado via Prisma (não via supabase-js/PostgREST)

**Testing**: Jest (padrão Nest) para unit; Supertest para e2e dos endpoints HTTP

**Target Platform**: Vercel Serverless Function (Node.js), Linux

**Project Type**: web-service (API REST, consumida pelo `poupe-certo-front` via `NEXT_PUBLIC_API_URL`)

**Performance Goals**: Endpoints próprios (`/health`, `/users/me`) respondem em p95 < 300ms fora do cold start; o tempo de ponta a ponta do login (SC-001, <15s) é dominado pelo round-trip OAuth do Google/Supabase, não pelo Nest

**Constraints**: Vercel Hobby (free tier) — timeout de 10s por invocação, cold start a cada instância fria, sem WebSocket/long-polling, sem processo persistente entre invocações (bootstrap do Nest cacheado em memória do runtime, não conexão de banco mantida indefinidamente)

**Scale/Scope**: Produto em estágio inicial, baixa concorrência (dezenas de usuários, não milhares) — sem necessidade de arquitetura para escala horizontal além do que Vercel/Supabase free tier já dão

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| I. Stack Declarada, Não Assumida | PASS — `project.config.json` criado com `preset: "prisma-postgres"` e desvio pontual documentado (`auth: "supabase-auth"`), conforme `core/stack-detection`. |
| II. Zod na Borda, Sempre | PASS — DTOs via `nestjs-zod`; env vars validadas com Zod no boot (falha rápido se faltar secret). |
| III. Autorização Explícita no Servidor | PASS — `AuthGuard` autentica (JWKS); autorização fina fica no service (`UsersService` só permite ler/alterar o próprio perfil — `req.user.id === profile.id`). Nesta feature não há dado de terceiro envolvido, mas o padrão já nasce correto. |
| IV. RLS Obrigatória em Tabelas Supabase | PASS (com desenho específico) — tabela `profiles` habilita RLS + policy `auth.uid() = id` na mesma migration. Para a policy ter efeito real (não ser ignorada por uma role com `BYPASSRLS`), o Prisma roda em runtime com uma role de aplicação de privilégio mínimo, dedicada, sem `BYPASSRLS` — não a role usada para `prisma migrate deploy`. Ver `research.md`. |
| V. Segurança Antes do Code Review | PLANEJADO — `/security` roda após `/speckit-implement` e antes de `/review` (feature toca autenticação e dado de usuário). |
| VI. YAGNI | PASS — skeleton mínimo: só os módulos necessários pra provar login+perfil+sessão ponta a ponta (`Prisma`, `Auth`, `Users`, `Health`). Sem GraphQL, sem microservices, sem exclusão de conta (fora do escopo, ver Clarifications do spec). |
| VII. Rastreabilidade Spec → Review | PASS — `spec.md` (com `## Clarifications`), este `plan.md`, `tasks.md` (próximo comando), e depois `security-review.md`/`code-review.md`. |

Nenhuma violação sem justificativa — Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-login-social-com/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md         # Fase 1
├── quickstart.md         # Fase 1
├── contracts/            # Fase 1
│   └── api.md
└── tasks.md              # Fase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root)

```text
src/
├── main.ts                        # bootstrap Nest (usado local/dev)
├── app.module.ts
├── common/
│   ├── config/
│   │   └── env.schema.ts          # Zod schema das env vars, validado no boot
│   └── filters/
│       └── http-exception.filter.ts  # nunca vaza stack trace/erro do Prisma
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts          # PrismaClient singleton (adapter-pg)
├── auth/
│   ├── auth.module.ts
│   ├── supabase-jwt.guard.ts      # valida Bearer token via JWKS do Supabase
│   ├── current-user.decorator.ts
│   └── supabase-jwt.strategy.ts   # jose + createRemoteJWKSet
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts        # GET /users/me
│   └── users.service.ts
└── health/
    └── health.controller.ts       # GET /health

prisma/
├── schema.prisma
└── migrations/
    └── ..._init_profiles/migration.sql   # cria profiles + RLS + trigger auth.users

api/
└── index.ts                       # entrypoint serverless (Vercel)

test/
├── users.e2e-spec.ts
└── health.e2e-spec.ts

vercel.json
.env.example
```

**Structure Decision**: Opção 1 (projeto único) adaptada — este repositório já É o backend (sem monorepo/frontend aqui). Sem separação `backend/`/`frontend/` porque o front vive em `poupe-certo-front`, repositório separado.

## Complexity Tracking

Sem violações a justificar.
