# Data Model: Catálogo comunitário de preços

## Enums

- **ProductCategory**: `MERCEARIA | BEBIDAS | LIMPEZA | HIGIENE | FRIOS | PADARIA` — conjunto fixo (ver Assumptions do spec). Contrato HTTP usa os códigos curtos `merc|beb|lim|hig|fri|pad` (mapa em `products/categories.ts`).
- **ProductStatus**: `PENDING | APPROVED | REJECTED`
- **ReportStatus**: `ACTIVE | PENDING_REVIEW | REJECTED`

## Profile (extensão da tabela existente `profiles`)

Campos novos (a tabela e as colunas já existentes — `id`, `email`, `displayName`, `avatarUrl`, `createdAt` — não mudam):

| Campo | Tipo | Regra |
|---|---|---|
| `points` | `Int` (`@default(0)`) | Nunca negativo (estorno satura em 0, nunca fica negativo — ver FR-017) |
| `isOperator` | `Boolean` (`@map("is_operator")`, `@default(false)`) | Só alterável manualmente no banco nesta fase (fora de qualquer endpoint) |

Derivado (calculado, não persistido): `level`, `pointsToNextLevel`, `progressPercent`, posição no ranking (ver research.md #3).

## Market

Representa um estabelecimento físico onde preços são observados.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String @id @db.Uuid` (`gen_random_uuid()`) | |
| `name` | `String` | Obrigatório, 2–150 caracteres; único (case-insensitive) |
| `address` | `String?` | Opcional, até 200 caracteres |
| `city` | `String?` | Opcional, até 100 caracteres |
| `uf` | `String?` (`@db.Char(2)`) | Opcional, 2 letras maiúsculas quando presente |
| `createdAt` | `DateTime @default(now())` | |

**Validação (Zod)**: `name` obrigatório; `uf`, quando presente, casa com `/^[A-Z]{2}$/`.

## Product

Identificado unicamente pelo código de barras.

| Campo | Tipo | Regra |
|---|---|---|
| `ean` | `String @id` | 8–14 dígitos numéricos (padrão EAN-8/EAN-13/ITF-14) |
| `name` | `String` | Obrigatório, 2–200 caracteres |
| `brand` | `String` | Obrigatório, 2–120 caracteres |
| `qty` | `String` | Obrigatório, 1–40 caracteres (texto livre, ex.: "5kg", "500ml") |
| `category` | `ProductCategory` | Obrigatório |
| `imageUrl` | `String?` | Opcional, URL |
| `status` | `ProductStatus @default(PENDING)` | Transições: `PENDING → APPROVED`, `PENDING → REJECTED`; nenhuma outra transição permitida (Edge Case: decisão dupla é recusada) |
| `createdBy` | `String @db.Uuid` (FK → `Profile.id`) | Obrigatório |
| `createdAt` | `DateTime @default(now())` | |
| `reviewedBy` | `String? @db.Uuid` (FK → `Profile.id`) | Preenchido só na aprovação/rejeição |
| `reviewedAt` | `DateTime?` | Preenchido só na aprovação/rejeição |

**Validação (Zod)**: `ean` casa com `/^\d{8,14}$/`; `name`, `brand`, `qty`, `category` obrigatórios.

**Regra de negócio**: `POST /products` recusa se já existir um `Product` com o mesmo `ean`, em qualquer status (FR-018).

## PriceReport

Uma observação de preço de um `Product` em um `Market`, feita por uma pessoa em um momento.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String @id @db.Uuid` (`gen_random_uuid()`) | |
| `productEan` | `String` (FK → `Product.ean`) | Obrigatório; produto deve estar `APPROVED` |
| `marketId` | `String @db.Uuid` (FK → `Market.id`) | Obrigatório |
| `price` | `Decimal @db.Decimal(10,2)` | Obrigatório, estritamente positivo |
| `status` | `ReportStatus @default(ACTIVE)` | Calculado no momento da criação (ver research.md #2); transições `PENDING_REVIEW → APPROVED-como-ACTIVE` ou `PENDING_REVIEW → REJECTED` só via moderação |
| `reportedBy` | `String @db.Uuid` (FK → `Profile.id`) | Obrigatório |
| `createdAt` | `DateTime @default(now())` | Usado como "idade" do preço |
| `reviewedBy` | `String? @db.Uuid` (FK → `Profile.id`) | Preenchido só quando havia `PENDING_REVIEW` e um operador decide |
| `reviewedAt` | `DateTime?` | |

**Validação (Zod)**: `price` estritamente positivo, número finito (FR-007); `marketId` formato UUID.

**Derivado**: oferta vigente de um produto num mercado = `PriceReport` com `status = ACTIVE` mais recente daquele par (ver research.md #6). Ofertas com `status != ACTIVE` nunca aparecem em endpoints públicos (FR-009).

## PriceConfirmation

Confirmação de que um `PriceReport` específico ainda está correto.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String @id @db.Uuid` (`gen_random_uuid()`) | |
| `priceReportId` | `String @db.Uuid` (FK → `PriceReport.id`, `onDelete: Cascade`) | Obrigatório |
| `confirmedBy` | `String @db.Uuid` (FK → `Profile.id`) | Obrigatório |
| `createdAt` | `DateTime @default(now())` | |

**Restrição**: `@@unique([priceReportId, confirmedBy])` — garante no máximo uma confirmação por pessoa por preço (FR-014, SC-005). Uma segunda tentativa é idempotente (não gera erro nem nova linha, apenas confirma que já existe).

## Relações (resumo)

```text
Profile 1──* Product      (createdBy)
Profile 1──* PriceReport  (reportedBy)
Profile 1──* PriceConfirmation (confirmedBy)
Product 1──* PriceReport  (productEan)
Market  1──* PriceReport  (marketId)
PriceReport 1──* PriceConfirmation (priceReportId)
```

## Índices

- `Product`: índice em `(status, category)` (filtro comum de busca pública); índice em `lower(name)` e `lower(brand)` (busca por texto).
- `PriceReport`: índice em `(productEan, marketId, status, createdAt desc)` (cálculo da oferta vigente); índice em `(reportedBy)` (estatísticas/contribuições do perfil).
- `Market`: índice único em `lower(name)`.
- `Profile`: índice em `(points desc)` (ranking).
