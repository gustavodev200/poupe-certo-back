# Research: Login social com Google

## 1. Versão do NestJS

**Decision**: NestJS `12.0.1` (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`).

**Rationale**: Confirmado agora via Context7 (`/nestjs/nest`) como a versão estável mais recente disponível — não assumir de memória de treino, que apontaria v10/v11.

**Alternatives considered**: Fixar em v11 "por segurança" — rejeitado, projeto novo sem débito legado, não há razão pra não usar a estável mais recente.

## 2. Verificação do JWT do Supabase Auth

**Decision**: Verificar o access token via JWKS remoto do próprio projeto Supabase, usando a lib `jose`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

async function verify(token: string) {
  return jwtVerify(token, JWKS); // valida assinatura + exp
}
```

**Rationale**: Confirmado via Context7 (docs oficiais `supabase.com/docs/guides/auth/jwts`) — é o método atual recomendado, funciona com o esquema de assinatura assimétrica que projetos Supabase novos usam por padrão (o projeto `poupe-certo` foi criado em 2026-09-25, já nesse esquema). Não depende de guardar um JWT secret compartilhado no Nest — só a URL pública do projeto. `jose` cacheia as chaves do JWKS automaticamente (não bate na rede a cada request).

**Alternatives considered**:
- Verificação HS256 com o JWT secret legado (`SUPABASE_JWT_SECRET`) — rejeitado como método principal: é o esquema antigo, exige guardar mais um segredo compartilhado no Nest, e projetos novos podem não ter esse secret disponível/ativo.
- Chamar `supabase.auth.getUser(token)` (SDK) a cada request — rejeitado: implica round-trip de rede ao Supabase em toda requisição autenticada, latência desnecessária quando dá pra verificar localmente via JWKS.

## 3. Nest ↔ Postgres do Supabase (Prisma)

**Decision**: Duas connection strings, ambas do Supavisor (pooler do Supabase):
- `DATABASE_URL` — transaction mode, porta 6543, `?pgbouncer=true&connection_limit=1` — usada pelo runtime da API.
- `DIRECT_URL` — session mode, porta 5432 — usada só por `prisma migrate deploy` (motor de migration precisa de sessão, não funciona bem atrás de pooler transaction-mode).

`schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

PrismaClient instanciado como singleton cacheado (`globalThis`), com `@prisma/adapter-pg`, para reaproveitar conexão entre invocações "quentes" da função serverless — evita esgotar o limite de conexões do Postgres a cada cold start.

**Rationale**: Confirmado via Context7 (docs Prisma) — é o padrão oficial recomendado para Prisma + Supabase + ambiente serverless. Sem isso, cada invocação fria abriria conexão nova e o Postgres do free tier esgota o limite rápido.

**Alternatives considered**:
- Prisma Accelerate (proxy de connection pooling externo) — rejeitado por ora: adiciona mais um vendor/conta pra gerenciar; o pooler do próprio Supabase (Supavisor) já resolve o problema sem custo extra e sem dependência nova.
- supabase-js/PostgREST em vez de Prisma — já decidido fora deste research (brainstorming com o usuário): Prisma foi a escolha explícita.

## 4. RLS como defesa em profundidade quando Prisma acessa o banco direto

**Decision**: A tabela `profiles` habilita RLS com policy `auth.uid() = id`. O Prisma em runtime (`DATABASE_URL`) conecta com a role `app_runtime`, no mesmo padrão do `authenticator` do PostgREST: `LOGIN NOINHERIT NOBYPASSRLS`, sem grant próprio em tabela, membro de `authenticated`. Todo acesso a dado passa por `PrismaService.asUser(userId, fn)`, que abre transação, faz `SET LOCAL ROLE authenticated` e `set_config('request.jwt.claims', {sub, role}, true)` — então `auth.uid()` resolve pro usuário do JWT e a policy é avaliada de verdade. Fora de `asUser`, a role não lê nada. `DIRECT_URL` (só migrations) usa a role `postgres`.

**Validação (2026-09-26)**: migration executada no banco real dentro de transação revertida — trigger sincronizou perfil; dono via 1 linha, outro usuário 0, sem claims 0. Nada persistido.

**Nota**: desenho inicial (role com `GRANT SELECT` direto, sem claims) foi descartado — sem claims, `auth.uid()` é NULL e a policy bloquearia todo `SELECT`.

**Rationale**: Constitution Principle IV exige RLS em toda tabela Supabase. Se o Prisma conectasse com uma role que bypassa RLS, a policy existiria "no papel" mas nunca seria avaliada — falso senso de segurança. Com uma role de aplicação sem bypass, a RLS policy funciona como cinto de segurança real: mesmo um bug de autorização no `UsersService` (esquecer o filtro `WHERE id = ...`) ainda esbarra na policy do Postgres.

**Alternatives considered**:
- Confiar só na autorização em código do `UsersService`, RLS "simbólica" com a role padrão — rejeitado: é exatamente o "falso senso de segurança" que o Principle IV existe pra evitar.
- supabase-js no lugar do Prisma pra herdar RLS "de graça" — já rejeitado fora deste research (decisão do usuário por Prisma).

## 5. Sincronização de perfil no primeiro login

**Decision**: Trigger Postgres (`AFTER INSERT ON auth.users`) que insere uma linha em `public.profiles` automaticamente — SQL puro dentro de uma migration Prisma (Prisma não gerencia o schema `auth`, mas uma migration pode conter SQL arbitrário além do gerado).

**Rationale**: É o padrão oficial documentado pelo próprio Supabase para "profiles synced with auth.users" — roda no banco, não depende do Nest estar de pé ou de nenhuma race condition entre "usuário logou" e "Nest criou o perfil".

**Alternatives considered**: Nest cria o perfil sob demanda no primeiro `GET /users/me` ("lazy create") — rejeitado: mistura responsabilidade de leitura com side-effect de escrita, e deixa uma janela onde o usuário está autenticado mas sem perfil se algo além de `/users/me` for chamado primeiro.

## 6. Deploy no Vercel (serverless)

**Decision**: Nest empacotado com adapter Express, bootstrap cacheado entre invocações "quentes":

```ts
// api/index.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let bootstrapped: Promise<void> | undefined;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.init();
}

export default async function handler(req: any, res: any) {
  bootstrapped ??= bootstrap();
  await bootstrapped;
  server(req, res);
}
```

`vercel.json` roteia todo tráfego pra essa função.

**Rationale**: Vercel Node Functions aceitam um handler `(req, res)` compatível com Express diretamente — não precisa da camada extra de tradução de evento Lambda (`@codegenie/serverless-express`) que a FAQ oficial do Nest usa para AWS Lambda puro. Padrão confirmado via Context7 (`docs.nestjs.com/faq/serverless`) adaptado pro formato de function do Vercel.

**Alternatives considered**: `@codegenie/serverless-express` (padrão da FAQ oficial, pensado pra AWS Lambda) — funciona no Vercel também, mas adiciona uma dependência e uma camada de tradução de evento desnecessária quando o runtime Node do Vercel já fala Express nativamente.

## Todos os NEEDS CLARIFICATION resolvidos

Nenhum item de Technical Context ficou em aberto.
