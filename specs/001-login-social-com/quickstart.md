# Quickstart: Login social com Google

## Pré-requisitos

- Node.js 22.x, npm
- Acesso ao projeto Supabase `poupe-certo` (ref `mcuipdmthhpfbjneuspw`) — URL, anon key, e as duas connection strings do Postgres (pooled + direct)
- Provider Google OAuth habilitado no Supabase Dashboard (Authentication → Providers → Google, com Client ID/Secret do Google Cloud Console) — passo manual, fora do escopo automatizável por aqui

## Setup local

```bash
npm install
cp .env.example .env   # preencher DATABASE_URL, DIRECT_URL, SUPABASE_URL
npx prisma migrate deploy
npm run start:dev
```

## Validar que o bootstrap funciona ponta a ponta

1. **Health check** (sem auth):
   ```bash
   curl http://localhost:3000/health
   # esperado: {"status":"ok"}
   ```

2. **Sem token → 401**:
   ```bash
   curl -i http://localhost:3000/users/me
   # esperado: HTTP 401
   ```

3. **Com token válido → perfil**:
   - Fazer login com Google pelo frontend (ou via `supabase-js` num script local apontando pro mesmo projeto) e capturar o `access_token` da sessão.
   ```bash
   curl -i http://localhost:3000/users/me \
     -H "Authorization: Bearer <access_token>"
   # esperado: HTTP 200 + corpo do perfil (ver contracts/api.md)
   ```

4. **Perfil sincronizado automaticamente**: conferir no Supabase (Table Editor ou `mcp__supabase__execute_sql`) que `public.profiles` tem uma linha com o mesmo `id` do `auth.users` recém-criado, sem nenhuma chamada manual de criação.

## Critério de pronto (liga com Success Criteria do spec)

- `GET /health` responde sem autenticação (SC de disponibilidade básica).
- `GET /users/me` nega 100% das chamadas sem token válido (SC-002).
- `GET /users/me` com token válido devolve o perfil certo, sem repetir login (SC-003).
