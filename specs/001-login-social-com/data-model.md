# Data Model: Login social com Google

## Entidades

### Profile (`public.profiles`)

Representa uma pessoa autenticada na plataforma (mapeia 1:1 pra `auth.users`, tabela gerenciada pelo Supabase Auth).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | PK, igual ao `auth.users.id` (FK) — não gerado pelo Nest |
| `email` | `text` | Copiado de `auth.users` na criação; não editável via API nesta feature |
| `display_name` | `text \| null` | Vem do provider Google (`full_name`/`name`) no primeiro login |
| `avatar_url` | `text \| null` | Vem do provider Google (`avatar_url`/`picture`) no primeiro login |
| `created_at` | `timestamptz` | Default `now()` |

**Regras de negócio**:
- Um `profile` por conta Google (garantido pela FK 1:1 com `auth.users.id`, que por sua vez é único por identidade de login).
- Criado automaticamente por trigger de banco (`AFTER INSERT ON auth.users`) — nunca pelo Nest diretamente (ver `research.md#5`).
- Nenhum campo de `profiles` é editável nesta feature (sem endpoint de update/delete — exclusão de conta é débito conhecido, fora do escopo, ver `spec.md#Clarifications`).

**RLS**: habilitada, policy `auth.uid() = id` para `SELECT` (uma pessoa só lê o próprio perfil via PostgREST, se algum dia for acessado assim). O runtime do Nest usa uma role de aplicação sem bypass de RLS (`app_runtime`), então a policy também vale para o caminho via Prisma — ver `research.md#4`.

### Session (conceitual — não é tabela própria)

Representa o período autenticado de uma pessoa. Não existe uma tabela `sessions` no schema `public`: sessão é inteiramente gerenciada pelo Supabase Auth (`auth.sessions`, schema que o Nest não acessa). O Nest só enxerga sessão como "um JWT válido, ainda não expirado, assinado pelo Supabase do projeto".

## Relacionamentos

```
auth.users (Supabase, gerenciado)
   │ 1:1 (trigger cria a linha em profiles)
   ▼
public.profiles (Prisma, gerenciado por este repo)
```

Nenhuma outra entidade de negócio nesta feature — é só o bootstrap de autenticação/perfil.
