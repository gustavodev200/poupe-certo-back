# API Contract: Login social com Google

Base URL: definida por `FRONTEND_URL`/deploy do Vercel (ex.: `https://poupe-certo-api.vercel.app`).

Autenticação: header `Authorization: Bearer <supabase_access_token>` em toda rota protegida. Token é o `access_token` que o `supabase-js` do frontend obtém após `signInWithOAuth({ provider: 'google' })`.

## `GET /health`

Rota pública, sem autenticação. Prova que a função serverless está de pé (usada por monitoramento/uptime).

**Response 200**:
```json
{ "status": "ok" }
```

## `GET /users/me`

Rota protegida. Confirma a sessão atual e devolve o perfil da pessoa autenticada.

**Headers**: `Authorization: Bearer <token>` (obrigatório)

**Response 200**:
```json
{
  "id": "uuid",
  "email": "pessoa@example.com",
  "displayName": "Nome da Pessoa",
  "avatarUrl": "https://...",
  "createdAt": "2026-09-25T12:00:00.000Z"
}
```

**Response 401** (token ausente, inválido, expirado, ou assinatura não confere com o JWKS do projeto):
```json
{ "statusCode": 401, "message": "Unauthorized" }
```

**Response 404** (token válido, mas o perfil ainda não existe — não deveria acontecer em uso normal, já que o trigger cria o perfil no mesmo instante do `auth.users`; indica falha na sincronização):
```json
{ "statusCode": 404, "message": "Profile not found" }
```

## Erros (formato geral)

Todo erro segue o formato padrão de exception do Nest (`{ statusCode, message }`) via filtro global — nunca stack trace, nunca mensagem crua do Prisma/Postgres.
