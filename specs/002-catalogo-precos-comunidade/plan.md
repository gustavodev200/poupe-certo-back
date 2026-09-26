# Implementation Plan: Catálogo comunitário de preços

**Branch**: `002-catalogo-precos-comunidade` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-catalogo-precos-comunidade/spec.md`

## Summary

Domínio central do produto: catálogo de produtos identificados por EAN, preços reportados pela comunidade por mercado, confirmação social de preços, cadastro de produto novo com moderação, e perfil com pontuação/nível/ranking. Leitura (busca, detalhe de produto, ranking público) é pública, sem autenticação. Escrita (reportar preço, confirmar preço, cadastrar produto, ler o próprio perfil) exige o `SupabaseJwtGuard` já existente da feature 001. Um novo papel "operador" (`profiles.is_operator`), sem tela própria no frontend, opera fila de moderação via endpoints dedicados protegidos por um novo `OperatorGuard`, documentados no Swagger. Prisma continua sendo o único dono do acesso a dado (RLS habilitada como defesa em profundidade, não como camada de autorização de negócio — essa fica explícita nos services do Nest, reaproveitando o padrão `PrismaService.asUser` já existente e adicionando `PrismaService.asPublic` para leitura anônima via role `anon` do Supabase).

## Technical Context

**Language/Version**: TypeScript 6.0.3 sobre Node.js 22.x (mesmo runtime da feature 001)

**Primary Dependencies**: NestJS 12.1 (módulos novos: `markets`, `products`, `price-reports`, `leaderboard`, `moderation`; extensão de `users`), Prisma 7.10.0 (mesmo padrão `prisma-client` + `@prisma/adapter-pg`), `zod` 4 (validação de toda entrada externa via um `ZodValidationPipe` novo — `nestjs-zod` continua fora por incompatibilidade com Nest 12), `@nestjs/swagger` + `swagger-ui-express` (novo — documentação OpenAPI, ver research.md sobre o padrão de DTOs de documentação convivendo com Zod).

**Storage**: mesmo Postgres do projeto Supabase `poupe-certo`, novas tabelas `markets`, `products`, `price_reports`, `price_confirmations`, e colunas novas em `profiles` (`points`, `is_operator`).

**Testing**: Jest (unit dos services — cálculo de outlier, pontos, nível) + Supertest (e2e dos endpoints HTTP, incluindo casos de autorização negada)

**Target Platform**: Vercel Serverless Function (Node.js), Linux — inalterado

**Project Type**: web-service (API REST consumida pelo `poupe-certo-front`)

**Performance Goals**: busca e detalhe de produto (endpoints públicos, maior volume esperado de tráfego) em p95 < 400ms fora do cold start, em linha com SC-001 (<10s ponta a ponta no cliente)

**Constraints**: mesmas da feature 001 (Vercel Hobby: timeout de 10s, cold start, sem processo persistente) — soma-se rate limit dedicado (FR-023) nos endpoints de escrita mais sensíveis a abuso/spam, além do `ThrottlerGuard` global já configurado

**Scale/Scope**: estágio inicial, mesma ordem de grandeza da feature 001 (dezenas de usuários) — decisões de índice/consulta priorizam simplicidade sobre otimização prematura (YAGNI), mas sem deixar buracos de segurança

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| I. Stack Declarada, Não Assumida | PASS — reaproveita `project.config.json` (`preset: "prisma-postgres"`) da feature 001, sem mudança de stack. |
| II. Zod na Borda, Sempre | PASS (com peça nova) — todo body/query externo desta feature (reportar preço, confirmar preço, cadastrar produto, decidir moderação, busca) passa por schema Zod via um `ZodValidationPipe` novo em `common/pipes/`. Não existe caminho de escrita que pule essa validação. |
| III. Autorização Explícita no Servidor | PASS — sessão válida (`SupabaseJwtGuard`) nunca é tratada como suficiente: cada service confere explicitamente a regra de negócio (ex.: só o próprio autor um dia poderia editar seu produto — não implementado, fora do escopo; moderação exige `OperatorGuard` além da sessão; "produto pendente não aparece" é filtro explícito de `status` nas queries de leitura pública, nunca dependência de RLS). |
| IV. RLS Obrigatória em Tabelas Supabase | PASS (com desenho específico) — todas as tabelas novas habilitam RLS na própria migration que as cria. Leitura pública (produtos/preços aprovados, mercados, ranking) usa policy para a role `anon` restrita a `status = 'APPROVED'`/`ACTIVE`; leitura/escrita autenticada usa policy para `authenticated` (mesma role assumida por `asUser`); nenhuma tabela fica sem policy. Ver research.md para o detalhe de `asPublic`. |
| V. Segurança Antes do Code Review | PLANEJADO — `/security` roda depois de `/speckit-implement` e antes de `/review` (feature toca dado de usuário, entrada externa em volume e um papel de privilégio elevado — operador). |
| VI. YAGNI | PASS — sem tela de admin (não existe no frontend ainda: endpoints de moderação bastam, documentados via Swagger); sem geolocalização/distância (não coletada em nenhuma tela); sem filtro por cidade (localização é só client-side); sem tabela de "preço vigente" desnormalizada (calculada em memória a partir dos reportes ACTIVE, volume baixo o suficiente para isso ser correto e simples). |
| VII. Rastreabilidade Spec → Review | PASS — `spec.md` (com `## Clarifications`), este `plan.md`, `tasks.md` (próximo comando), depois `security-review.md`/`code-review.md`. |

Nenhuma violação sem justificativa — Complexity Tracking registra apenas a peça nova (DTOs de documentação paralelos ao Zod), justificada abaixo por ser exigida pelo pedido explícito de documentação Swagger.

## Project Structure

### Documentation (this feature)

```text
specs/002-catalogo-precos-comunidade/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md         # Fase 1
├── quickstart.md         # Fase 1
├── contracts/
│   └── api.md            # Fase 1
└── tasks.md              # Fase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root)

```text
src/
├── main.ts                          # + bootstrap Swagger (DocumentBuilder), gated por SWAGGER_ENABLED
├── configure-app.ts                 # inalterado
├── common/
│   ├── config/env.schema.ts         # + SWAGGER_ENABLED (default true)
│   ├── filters/http-exception.filter.ts  # inalterado
│   └── pipes/
│       └── zod-validation.pipe.ts   # NOVO — valida body/query contra um ZodSchema, 400 com issues formatadas
├── prisma/
│   ├── prisma.module.ts             # inalterado
│   └── prisma.service.ts            # + asPublic() (SET LOCAL ROLE anon) ao lado de asUser()
├── auth/
│   ├── auth.module.ts               # + exporta OperatorGuard
│   ├── supabase-jwt.guard.ts        # inalterado
│   ├── current-user.decorator.ts    # inalterado
│   └── operator.guard.ts            # NOVO — exige SupabaseJwtGuard já ter rodado + profiles.is_operator = true
├── users/
│   ├── users.module.ts              # + PointsModule
│   ├── users.controller.ts          # + GET /users/me/stats, GET /users/me/contributions
│   └── users.service.ts             # + estatísticas, progresso de nível, posição no ranking
├── gamification/
│   ├── gamification.module.ts       # NOVO — regras puras de pontos/nível, sem I/O
│   └── points.ts                    # constantes de pontuação + funções levelForPoints/progress
├── markets/
│   ├── markets.module.ts            # NOVO
│   ├── markets.controller.ts        # GET /markets, POST /markets
│   ├── markets.service.ts
│   └── dto/
│       ├── market.schema.ts         # Zod
│       └── market.dto.ts            # classes @ApiProperty (Swagger)
├── products/
│   ├── products.module.ts           # NOVO
│   ├── products.controller.ts       # GET /products/search, GET /products/:ean, POST /products
│   ├── products.service.ts          # inclui outlier check (delegando cálculo a price-reports)
│   ├── categories.ts                # mapa fixo de categorias (código curto ↔ enum Prisma)
│   └── dto/
│       ├── product.schema.ts        # Zod
│       └── product.dto.ts           # classes @ApiProperty
├── price-reports/
│   ├── price-reports.module.ts      # NOVO
│   ├── price-reports.controller.ts  # POST /products/:ean/price-reports, POST /price-reports/:id/confirmations
│   ├── price-reports.service.ts     # cálculo de outlier (mediana + desvio), oferta vigente por mercado
│   └── dto/
│       ├── price-report.schema.ts   # Zod
│       └── price-report.dto.ts      # classes @ApiProperty
├── leaderboard/
│   ├── leaderboard.module.ts        # NOVO
│   ├── leaderboard.controller.ts    # GET /leaderboard
│   └── leaderboard.service.ts
├── moderation/
│   ├── moderation.module.ts         # NOVO
│   ├── moderation.controller.ts     # GET /moderation/queue, PATCH /moderation/products/:ean, PATCH /moderation/price-reports/:id
│   └── moderation.service.ts        # estorno de pontos ao rejeitar produto (FR-017)
└── health/
    └── health.controller.ts         # inalterado

prisma/
├── schema.prisma                    # + models Market, Product, PriceReport, PriceConfirmation, enums; + campos em Profile
└── migrations/
    └── ..._catalogo_precos/migration.sql  # tabelas novas + RLS + policies (anon/authenticated) + colunas novas em profiles

test/
├── products.e2e-spec.ts
├── price-reports.e2e-spec.ts
├── moderation.e2e-spec.ts
└── leaderboard.e2e-spec.ts
```

**Structure Decision**: Continua Opção 1 (projeto único, este repositório É o backend). Um módulo Nest por agregado (`markets`, `products`, `price-reports`, `leaderboard`, `moderation`), mais um módulo `gamification` sem I/O para as regras puras de pontuação/nível serem testadas isoladamente e reaproveitadas por `users`, `products` e `price-reports` sem duplicar a fórmula.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| DTOs de documentação (`*.dto.ts`) paralelos aos schemas Zod (`*.schema.ts`) | Swagger foi pedido explicitamente; `@nestjs/swagger` só gera schema OpenAPI de qualidade a partir de classes decoradas com `@ApiProperty`, não de `z.object` diretamente | Gerar Swagger só com `@ApiBody({ schema: {...} })` inline em cada rota foi rejeitado por ficar mais difícil de reaproveitar entre rotas (ex.: o mesmo produto aparece na busca e no detalhe) e mais fácil de divergir silenciosamente do Zod real; a duplicação explícita e nomeada é mais fácil de auditar no `/review` do que schemas inline espalhados |
