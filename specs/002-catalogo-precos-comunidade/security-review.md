# Security Review: Catálogo comunitário de preços

- **Plan relacionado**: `plan.md`
- **Status**: Aprovado com ressalvas

## Escopo da alteração

- **Feature**: catálogo de produtos por EAN, mercados, reportes de preço com detecção de outlier, confirmação social, cadastro de produto com moderação, perfil/gamificação/ranking.
- **Arquivos/endpoints/serviços/tabelas afetados**: módulos `markets`, `products`, `price-reports`, `moderation`, `leaderboard`; extensão de `users`; novo `OperatorGuard` e `ZodValidationPipe`; extensão de `PrismaService` (`asPublic`); tabelas novas `markets`, `products`, `price_reports`, `price_confirmations`; colunas novas `profiles.points`, `profiles.is_operator`; Swagger (`@nestjs/swagger`) montado em `/docs`.
- **Blast radius**: `PrismaService` é `@Global()` — `asPublic` novo não altera o comportamento de `asUser` já usado pela feature 001 (`UsersService.findMe`, `GET /users/me`), reconferido abaixo. Nenhum service/controller da feature 001 foi modificado além de `users.controller.ts`/`users.service.ts` (só adição de rotas novas, `GET /users/me` original inalterado).

## Achados

Dois achados reais foram identificados e **corrigidos no próprio código** durante esta revisão (não ficaram como TODO):

```text
Vulnerabilidade: Grant de UPDATE de tabela inteira em `products`/`price_reports` para a role `authenticated`, combinado com `WITH CHECK (true)` na policy de moderação.
Severidade: MEDIUM
Arquivo: prisma/migrations/20260926090000_catalogo_precos_comunidade/migration.sql
Linha: GRANTs de UPDATE de `products` e `price_reports` (antes da correção)
Componente/Endpoint: PATCH /moderation/products/:ean, PATCH /moderation/price-reports/:id
Evidência: CONFIRMADO (leitura do SQL) — a policy de UPDATE só restringe QUEM pode atualizar (operador), não QUAIS colunas. Com grant de tabela inteira, uma sessão de operador (ou uma sessão comprometida/insider) poderia, via uma query diferente da que o `ModerationService` emite, reescrever `name`, `brand`, `price`, `created_by` etc. de qualquer produto/preço — não só `status`/`reviewed_by`/`reviewed_at`.
Como pode ser explorada: um operador malicioso (ou uma conta de operador comprometida) usa uma chamada Prisma/SQL diferente da rota oficial de moderação para alterar o preço histórico de um `price_report` já confirmado por outras pessoas, ou reescrever o nome de um produto aprovado — quebrando a trilha de auditoria que sustenta a confiança do catálogo.
Impacto: integridade do dado público (preço/produto) e da trilha de auditoria de moderação; não é takeover de conta nem RCE, mas corrompe o dado central do produto.
Correção recomendada: `GRANT UPDATE` de coluna específica (`status`, `reviewed_by`, `reviewed_at`) em vez de tabela inteira.
Como validar a correção: aplicar a migration num banco de teste e confirmar (`information_schema.column_privileges` ou tentativa de `UPDATE ... SET name = 'x'` como `authenticated`+operador) que só as 3 colunas de moderação são graváveis.
Status: RESOLVIDO nesta sessão — ver migration.sql (`GRANT UPDATE ("status", "reviewed_by", "reviewed_at") ...`).
```

```text
Vulnerabilidade: Parâmetros de rota `id` (UUID) e `ean` em `moderation.controller.ts`/`price-reports.controller.ts` não passavam por validação Zod antes de chegar ao Prisma.
Severidade: LOW
Arquivo: src/price-reports/price-reports.controller.ts, src/moderation/moderation.controller.ts
Linha: `@Param('id') id: string` (confirm, decidePriceReport), `@Param('ean') ean: string` (decideProduct) — antes da correção
Componente/Endpoint: POST /price-reports/:id/confirmations, PATCH /moderation/price-reports/:id, PATCH /moderation/products/:ean
Evidência: CONFIRMADO — um `id` não-UUID faria o Postgres rejeitar o valor no `WHERE` (coluna `uuid`), Prisma repassaria um erro não-HTTP, e o filtro global devolveria 500 genérico em vez de 400. Nenhum risco de injection (Prisma sempre parametriza), mas viola o Princípio II da constituição ("Zod na borda, sempre — não-negociável") e vaza comportamento de erro inconsistente.
Como pode ser explorada: não é uma exploração de dado, é uma falha de robustez/observabilidade — um 500 em vez de 400 polui log de erro e pode mascarar tentativa real de abuso em meio a ruído de input malformado.
Impacto: baixo — sem exposição de dado, sem bypass de autorização.
Correção recomendada: validar via `ZodValidationPipe` com um schema de UUID (`common/schemas/uuid.schema.ts`), como já era feito para `ean` em `products.controller.ts`.
Como validar a correção: `POST /price-reports/abc/confirmations` deve devolver 400 (antes devolvia 500).
Status: RESOLVIDO nesta sessão.
```

```text
Vulnerabilidade: `ModerationService.listQueue` sem limite de página — retorna toda a fila de pendências de uma vez.
Severidade: LOW
Arquivo: src/moderation/moderation.service.ts
Componente/Endpoint: GET /moderation/queue
Evidência: PROVÁVEL — endpoint restrito a operador (baixo volume de chamada), mas o volume de linhas retornadas cresce sem teto se a fila de pendências crescer (ex.: tentativa de spam de cadastro, ainda que rate-limitada).
Impacto: baixo — memória/latência da resposta, não vazamento de dado de terceiro.
Correção recomendada: teto fixo (`take`) na consulta, paginação real fica para quando houver tela de admin.
Como validar a correção: consulta nunca retorna mais que `MODERATION_QUEUE_PAGE_SIZE` itens por lista.
Status: RESOLVIDO nesta sessão (`MODERATION_QUEUE_PAGE_SIZE = 200`).
```

Nenhum achado CRITICAL ou HIGH identificado.

## Checklist por tópico

### Autenticação e Autorização (`references/auth-authz.md`)

- [x] Toda rota de escrita exige `SupabaseJwtGuard` (sessão) — Resolvido — auditado endpoint a endpoint (ver tabela abaixo).
- [x] Autorização de negócio no servidor, não só sessão — Resolvido — `OperatorGuard` checa `profiles.is_operator` no banco (nunca um campo vindo do client); services checam `status` explicitamente antes de qualquer efeito (ex.: produto precisa estar `APPROVED` para receber preço).
- [x] IDOR — Resolvido — nenhum endpoint desta feature usa um ID de URL/body para acessar/alterar recurso de outra pessoa sem checagem: confirmar preço é intencionalmente aberto a qualquer autenticado (regra de negócio, não falha); moderação é aberta a qualquer item pendente intencionalmente (é o papel do operador); estatísticas/contribuições sempre usam `user.id` do próprio token, nunca um ID do client.
- [x] RBAC não confia em valor do client — Resolvido — `is_operator` é lido do banco (`profiles`) a cada requisição via `OperatorGuard`, nunca de um claim/campo enviado pelo cliente.
- [ ] JWT — N/A nesta feature (reaproveita `SupabaseJwtGuard`/JWKS já auditado na feature 001; nenhuma mudança nesse componente).

### Injection: SQLi, XSS, CSRF, SSRF, Path Traversal, Command Injection (`references/injection.md`)

- [x] SQL Injection — Resolvido — toda query usa a API do Prisma Client (nenhum `$queryRawUnsafe`/concatenação); os únicos `$executeRaw` do projeto (em `prisma.service.ts`) são template tags parametrizados já existentes da feature 001, inalterados.
- [x] XSS — N/A — API JSON pura, sem renderização de HTML.
- [x] CSRF — N/A — API sem cookie de sessão; autenticação via `Authorization: Bearer`, imune a CSRF clássico (que depende de cookie enviado automaticamente pelo browser).
- [x] SSRF — N/A — nenhuma feature busca URL fornecida por usuário.
- [x] Path Traversal / Command Injection — N/A — sem manipulação de arquivo/processo nesta feature.

### API: Rate limiting, CORS, Headers, Mass Assignment, Webhooks (`references/api-security.md`)

- [x] Rate limiting — Resolvido — `ThrottlerGuard` global (60/min) já existente + `@Throttle` dedicado (10/min) em todo endpoint de escrita sensível a spam (`POST /products`, `POST /products/:ean/price-reports`, `POST /price-reports/:id/confirmations`, `POST /markets`).
- [x] CORS — Resolvido — allowlist de `FRONTEND_URL` já existente (feature 001), sem `*`; nenhuma mudança nesta feature.
- [x] Headers — Resolvido — `helmet()` global já existente, inalterado.
- [x] Mass Assignment — Resolvido — todo schema Zod de entrada lista campos explícitos; `status`, `createdBy`/`reportedBy`, `reviewedBy`/`reviewedAt`, `points`, `isOperator` nunca vêm do body do cliente — são sempre setados pelo service a partir do token (`user.id`) ou de constantes internas. Reforçado no banco por grants de coluna (achado 1 acima).
- [x] Paginação — Resolvido — `search`/`contributions` têm `page`/`pageSize` (máx. 100); `leaderboard` tem `limit` (máx. 100); fila de moderação tem teto fixo (achado 3 acima).
- [ ] Webhooks — N/A, feature não recebe webhook.

### Secrets, Exposição de Dados, Logs, Dependências, Config de Produção (`references/data-secrets-logging.md`)

- [x] Secrets — Resolvido — nenhuma credencial nova introduzida; `.env.example` só ganhou `SWAGGER_ENABLED=true` (não é secret).
- [x] Exposição de dados — Resolvido — `LeaderboardEntryDto`/consulta de ranking nunca trazem e-mail (reforçado por grant de coluna no Postgres restrito a `id, display_name, avatar_url, points` para a role `anon` — mesmo um bug futuro na query não conseguiria vazar e-mail, o Postgres recusaria a coluna); produto pendente/rejeitado e preço pendente/rejeitado nunca aparecem em endpoint público (filtro de `status` explícito + RLS redundante).
- [x] Logs — Resolvido — nenhum dado sensível novo é logado; erros inesperados continuam passando só pelo `HttpExceptionFilter` existente (stack trace só em log server-side).
- [ ] Dependências vulneráveis — **Pendente, aceito como risco** — ver seção abaixo (`mysql2`/`deepmerge-ts` via `prisma`).
- [x] Config de produção — Resolvido, com ressalva — Swagger fica acessível publicamente por padrão (`SWAGGER_ENABLED=true`); ver risco aceito abaixo.

### RLS no Supabase (`references/supabase-rls.md`)

Aplicável — mesmo com preset `prisma-postgres`, o projeto usa Postgres do Supabase e a constituição (Princípio IV) exige RLS como defesa em profundidade em toda tabela nova.

- [x] Toda tabela nova (`markets`, `products`, `price_reports`, `price_confirmations`) habilita RLS na própria migration que a cria — Resolvido.
- [x] Nenhuma tabela com RLS habilitada fica sem nenhuma policy — Resolvido — todas têm ao menos uma policy de SELECT.
- [x] `USING (true)` só onde justificado — Resolvido e documentado: `markets_select_all` (mercado é dado público, sem informação sensível — igual ao exemplo de "tabela de categorias" da própria checklist) e `profiles_select_public_leaderboard` (`TO anon`, mas restrito por grant de coluna a 4 campos não sensíveis — nunca `email`/`is_operator`).
- [x] Policies de INSERT/UPDATE pensadas separadamente da de SELECT, com `WITH CHECK` de ownership (`created_by = auth.uid()` / `reported_by = auth.uid()` / `confirmed_by = auth.uid()`), nunca um valor do payload do client — Resolvido.
- [x] RBAC via RLS não confia em campo editável pelo usuário — Resolvido — `is_operator` só é alterável manualmente no banco (nenhum endpoint desta feature escreve nessa coluna).
- [x] Grant de coluna restringe o que cada role pode realmente gravar/ler além da linha (não é só "quem", é "o quê") — Resolvido nesta revisão (achado 1).
- [x] `app_runtime` continua sem `BYPASSRLS`, agora também membro de `anon` (além de `authenticated`) para `asPublic` funcionar — Resolvido, mesmo padrão da feature 001.

## Riscos aceitos explicitamente

- **Dependências vulneráveis (`mysql2`, `deepmerge-ts`, transitivas de `@prisma/config`/`prisma`)**: `npm audit` reporta 4 HIGH, mas a correção sugerida (`npm audit fix --force`) rebaixaria `prisma` para `6.19.3`, conflitando com a versão estável fixada (`7.10.0`, per `reference-npm-latest-pitfalls`). As bibliotecas vulneráveis (`mysql2`) pertencem a um adaptador de banco (MySQL) que este projeto **nunca usa** (só Postgres via `@prisma/adapter-pg`) — superfície de ataque real é nula, mas o registro fica pendente até o Prisma publicar uma versão estável que corrija a transitiva sem regressão. Aceito como risco por: agente autônomo, nesta sessão, na ausência do usuário — **recomenda-se confirmação/revisão humana** na próxima janela de manutenção de dependências.
- **Swagger público por padrão (`SWAGGER_ENABLED=true`)**: pedido explícito do usuário ("use swagger para documentar"). A documentação expõe o *shape* das rotas (não dado nem segredo), e um toggle de ambiente já existe para desligar em produção pública se o usuário preferir. Aceito como risco por: decisão de produto do usuário (documentação explícita da API), com mitigação já disponível (`SWAGGER_ENABLED=false`).
- **Testes de integração/E2E do caminho feliz não executados nesta sessão** (ver `tasks.md`, seção "Resultado da fase `/test`") por falta de Postgres real e de um `access_token` Supabase genuíno neste ambiente — não é uma vulnerabilidade, é uma lacuna de verificação a fechar manualmente antes do primeiro deploy real (roteiro em `quickstart.md`).

## Security Gate

```text
Status: PASS WITH WARNINGS

CRITICAL: 0
HIGH: 0
MEDIUM: 0 (1 encontrado, corrigido nesta sessão)
LOW: 2 (corrigidos nesta sessão) + 2 riscos aceitos (dependências transitivas, Swagger público por decisão de produto)
INFORMATIONAL: 1 (TOCTOU teórico entre a query do `OperatorGuard` e a query do service — duas transações separadas; risco desprezível, não acionável)
```
