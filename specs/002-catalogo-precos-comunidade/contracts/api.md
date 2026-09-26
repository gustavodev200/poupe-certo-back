# API Contract: Catálogo comunitário de preços

Base URL: mesma da feature 001. Autenticação: mesmo header `Authorization: Bearer <supabase_access_token>` nas rotas protegidas. Documentação interativa completa (Swagger/OpenAPI) em `GET /docs` quando `SWAGGER_ENABLED=true`.

Categorias aceitas/retornadas (código curto): `merc | beb | lim | hig | fri | pad` (ver `data-model.md`).

Erros seguem sempre `{ statusCode, message }` (filtro global existente), nunca stack trace ou erro cru do Prisma/Postgres.

---

## Produtos e busca (público — sem autenticação)

### `GET /products/search?q=&category=&sort=preco|recente&page=&pageSize=`

Busca produtos aprovados por nome/marca, com filtro opcional de categoria.

**Response 200**:
```json
{
  "items": [
    {
      "ean": "7891234567890",
      "name": "Arroz Camil Tipo 1",
      "brand": "Camil",
      "qty": "5kg",
      "category": "merc",
      "lowestOffer": {
        "market": { "id": "uuid", "name": "Mercado B" },
        "price": 25.9,
        "reportedAt": "2026-09-25T00:00:00.000Z",
        "confirmations": 8
      },
      "offerCount": 4
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

Produto sem nenhuma oferta `ACTIVE` ainda aparece na busca, com `"lowestOffer": null` e `"offerCount": 0`.

### `GET /products/:ean`

Detalhe de um produto aprovado: todas as ofertas por mercado e histórico de menor preço.

**Response 200**:
```json
{
  "ean": "7891234567890",
  "name": "Arroz Camil Tipo 1",
  "brand": "Camil",
  "qty": "5kg",
  "category": "merc",
  "offers": [
    {
      "priceReportId": "uuid",
      "market": { "id": "uuid", "name": "Mercado B" },
      "price": 25.9,
      "reportedAt": "2026-09-25T00:00:00.000Z",
      "confirmations": 8
    }
  ],
  "stats": { "lowest": 25.9, "average": 27.65, "highest": 29.9 },
  "history": [{ "period": "2026-08-1", "lowestPrice": 27.9 }]
}
```

**Response 404**: produto inexistente ou não aprovado (mesma resposta para os dois casos — não vaza se um EAN pendente existe).
```json
{ "statusCode": 404, "message": "Produto não encontrado" }
```

### `GET /products/ean/:ean/exists` *(auxiliar para o fluxo de scan)*

Usado pela tela `/scan` para decidir entre ir para `/confirm-price` (existe) ou `/new-product` (não existe), sem expor todo o detalhe.

**Response 200**: `{ "exists": true, "approved": true }` | `{ "exists": false, "approved": false }` | `{ "exists": true, "approved": false }` (pendente — tratado como "não disponível para reporte ainda" pelo cliente).

---

## Produtos — cadastro (protegido)

### `POST /products`

**Headers**: `Authorization: Bearer <token>` (obrigatório)

**Body**:
```json
{
  "ean": "7891234567891",
  "name": "Feijão Preto Camil",
  "brand": "Camil",
  "qty": "1kg",
  "category": "merc",
  "imageUrl": null
}
```

**Response 201**:
```json
{ "ean": "7891234567891", "status": "PENDING", "pointsAwarded": 5 }
```

**Response 409** (EAN já existe, aprovado ou pendente):
```json
{ "statusCode": 409, "message": "Produto já cadastrado" }
```

**Response 401**: sem token válido. **Response 400**: campo inválido (ex.: `ean` fora do padrão, `name` curto demais) — `message` traz as violações do Zod.

---

## Mercados

### `GET /markets` *(público)*

**Response 200**: `[{ "id": "uuid", "name": "Mercado X", "address": "Av. Central, 900", "city": "Goiânia", "uf": "GO" }]`

### `POST /markets` *(protegido)*

Cria um mercado novo ou devolve o existente (upsert por nome, case-insensitive).

**Body**: `{ "name": "Mercado Y", "address": "R. Nova, 10", "city": "Goiânia", "uf": "GO" }`

**Response 200** (já existia) ou **201** (criado): `{ "id": "uuid", "name": "Mercado Y", "address": "...", "city": "...", "uf": "GO" }`

---

## Preços — reportar e confirmar (protegido)

### `POST /products/:ean/price-reports`

**Headers**: `Authorization: Bearer <token>` (obrigatório)

**Body**: `{ "marketId": "uuid", "price": 25.9 }`

**Response 201** (aceito direto):
```json
{ "id": "uuid", "status": "ACTIVE", "pointsAwarded": 2 }
```

**Response 202** (marcado para revisão — fora do padrão de preço):
```json
{ "id": "uuid", "status": "PENDING_REVIEW", "pointsAwarded": 0, "message": "Preço fora do padrão, enviado para revisão" }
```

**Response 404**: produto não existe ou não está aprovado. **Response 400**: preço zero/negativo/inválido, ou `marketId` que não existe. **Response 401**: sem token.

### `POST /price-reports/:id/confirmations`

**Headers**: `Authorization: Bearer <token>` (obrigatório)

**Response 200** (idempotente — mesma resposta se já havia confirmado antes):
```json
{ "priceReportId": "uuid", "confirmations": 9 }
```

**Response 404**: `priceReportId` não existe ou não está `ACTIVE`. **Response 401**: sem token.

---

## Perfil e ranking

### `GET /users/me/stats` *(protegido)*

```json
{
  "pricesReported": 87,
  "productsCreated": 32,
  "confirmationsGiven": 24,
  "confidencePercent": 96,
  "points": 132,
  "level": 2,
  "pointsToNextLevel": 68,
  "progressPercent": 32,
  "rankPosition": 8
}
```

### `GET /users/me/contributions?page=&pageSize=` *(protegido)*

```json
{
  "items": [
    {
      "type": "price_report",
      "product": { "ean": "...", "name": "Arroz Camil 5kg" },
      "market": { "id": "uuid", "name": "Mercado B" },
      "price": 25.9,
      "createdAt": "2026-09-25T00:00:00.000Z"
    },
    {
      "type": "product_created",
      "product": { "ean": "...", "name": "Feijão Preto Camil" },
      "createdAt": "2026-09-24T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 119
}
```

### `GET /leaderboard?limit=` *(público)*

```json
[
  { "displayName": "Marina Alves", "avatarUrl": "https://...", "level": 7, "points": 780, "pricesReported": 156 }
]
```

Nunca inclui e-mail ou qualquer dado além de nome de exibição, foto, nível e contadores públicos (FR-021, SC — proteção de dado de terceiro).

---

## Moderação (protegido — exige papel de operador)

Todas as rotas abaixo exigem `Authorization: Bearer <token>` de uma pessoa com `profiles.is_operator = true`. Uma pessoa autenticada comum recebe `403`.

### `GET /moderation/queue?type=product|price-report`

```json
{
  "products": [{ "ean": "...", "name": "...", "brand": "...", "createdBy": "uuid", "createdAt": "..." }],
  "priceReports": [{ "id": "uuid", "product": { "ean": "...", "name": "..." }, "market": { "id": "uuid", "name": "..." }, "price": 99.9, "reportedBy": "uuid", "createdAt": "..." }]
}
```

### `PATCH /moderation/products/:ean`

**Body**: `{ "decision": "approve" }` ou `{ "decision": "reject" }`

**Response 200**: `{ "ean": "...", "status": "APPROVED" }` ou `{ "ean": "...", "status": "REJECTED", "pointsReverted": 5 }`

**Response 409**: produto já tinha sido decidido antes (Edge Case).

### `PATCH /moderation/price-reports/:id`

**Body**: `{ "decision": "approve" }` ou `{ "decision": "reject" }`

**Response 200**: `{ "id": "...", "status": "ACTIVE" }` ou `{ "id": "...", "status": "REJECTED" }`

**Response 409**: reporte já tinha sido decidido antes.

**Response 403** (para as três rotas acima, pessoa autenticada sem papel de operador):
```json
{ "statusCode": 403, "message": "Forbidden" }
```
