# Quickstart: Catálogo comunitário de preços

## Pré-requisitos

- Ambiente da feature 001 já funcionando (`npm install`, `.env` preenchido, `npx prisma migrate deploy`, `GET /health` e `GET /users/me` OK).
- Um `access_token` válido de pelo menos uma pessoa autenticada (mesmo processo da feature 001).
- Para os cenários de moderação: marcar manualmente `is_operator = true` na linha de `public.profiles` de uma pessoa de teste (não existe endpoint para isso, por decisão de escopo — ver Assumptions do spec).

## Setup local

```bash
npm install
npx prisma migrate deploy
npm run start:dev
```

Swagger disponível em `http://localhost:3333/docs` (usar o botão "Authorize" com `Bearer <access_token>` para testar rotas protegidas direto pela UI).

## Validar o fluxo ponta a ponta

1. **Busca pública, sem token**:
   ```bash
   curl "http://localhost:3333/products/search?q=arroz"
   # esperado: HTTP 200, lista vazia se ainda não há produtos aprovados
   ```

2. **Cadastrar produto novo (protegido) → fica pendente, não aparece na busca**:
   ```bash
   curl -i -X POST http://localhost:3333/products \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"ean":"7891234567890","name":"Arroz Camil Tipo 1","brand":"Camil","qty":"5kg","category":"merc"}'
   # esperado: HTTP 201, status "PENDING"
   curl "http://localhost:3333/products/search?q=arroz"
   # esperado: continua vazio — produto pendente não aparece (FR-013)
   ```

3. **Aprovar como operador**:
   ```bash
   curl -i -X PATCH http://localhost:3333/moderation/products/7891234567890 \
     -H "Authorization: Bearer <token_operador>" -H "Content-Type: application/json" \
     -d '{"decision":"approve"}'
   # esperado: HTTP 200, status "APPROVED"
   curl "http://localhost:3333/products/search?q=arroz"
   # esperado: agora aparece
   ```

4. **Criar mercado e reportar preço**:
   ```bash
   curl -X POST http://localhost:3333/markets -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"name":"Mercado Teste","city":"Goiânia","uf":"GO"}'
   # anotar o "id" retornado como <marketId>
   curl -i -X POST http://localhost:3333/products/7891234567890/price-reports \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"marketId":"<marketId>","price":25.90}'
   # esperado: HTTP 201, status "ACTIVE", pointsAwarded 2
   ```

5. **Preço fora do padrão vai para revisão** (repetir o passo 4 com um preço absurdo depois de já existir uma amostra maior — ex.: `"price": 999.90`):
   ```bash
   # esperado: HTTP 202, status "PENDING_REVIEW", pointsAwarded 0
   curl "http://localhost:3333/products/7891234567890"
   # esperado: a oferta de 999.90 NÃO aparece na lista de ofertas (FR-009)
   ```

6. **Confirmar preço, duas vezes seguidas pela mesma pessoa**:
   ```bash
   curl -X POST http://localhost:3333/price-reports/<priceReportId>/confirmations -H "Authorization: Bearer <token>"
   curl -X POST http://localhost:3333/price-reports/<priceReportId>/confirmations -H "Authorization: Bearer <token>"
   # esperado: "confirmations" igual nas duas respostas — segunda chamada não soma de novo (SC-005)
   ```

7. **Perfil reflete as ações**:
   ```bash
   curl http://localhost:3333/users/me/stats -H "Authorization: Bearer <token>"
   # esperado: pricesReported >= 1, points >= 2, level/progressPercent coerentes
   ```

8. **Sem token em qualquer rota protegida → 401; com token comum em rota de moderação → 403**.

## Critério de pronto (liga com Success Criteria do spec)

- Busca e detalhe de produto respondem sem autenticação (SC-001).
- Preço zero/negativo/inválido é recusado antes de virar oferta (SC-002).
- Preço fora do padrão nunca aparece na lista pública antes de aprovado (SC-003).
- Confirmação duplicada pela mesma pessoa não soma duas vezes (SC-005).
- Toda rota protegida nega acesso sem token; toda rota de moderação nega acesso sem `is_operator` (SC-006, SC-007).
