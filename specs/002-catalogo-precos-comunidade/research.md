# Phase 0 Research: Catálogo comunitário de preços

## 1. Leitura pública sem sessão, sob o mesmo modelo RLS

**Decision**: adicionar `PrismaService.asPublic<T>(fn)`, irmão de `asUser`, que roda `SET LOCAL ROLE anon` (sem claims JWT) dentro de uma transação, e usá-lo em todo endpoint que não passa por `SupabaseJwtGuard` (busca, detalhe de produto, ranking, listagem de mercados).

**Rationale**: o projeto Supabase já provisiona as roles `anon` e `authenticated` (usadas por PostgREST/GoTrue) independentemente do Prisma — o comentário original de `asUser` já diz "RLS aplica igual PostgREST". Reaproveitar a role `anon` mantém o mesmo modelo mental (nunca ler direto como a role de login `app_runtime`, sempre assumir uma role de aplicação com policy própria) para leitura autenticada e não autenticada, sem introduzir um terceiro conceito de autorização.

**Alternatives considered**:
- Grant de `SELECT` direto para `app_runtime` nas tabelas públicas, sem trocar de role: rejeitado por quebrar o padrão "app_runtime não lê nada sozinha" já estabelecido na migration da feature 001 — um bug em outra parte do código que esqueça de restringir por `status` passaria a vazar produtos pendentes, porque a RLS não estaria realmente em vigor para essa role.
- Um usuário de aplicação único sem RLS nenhuma nas tabelas públicas: rejeitado pelo Princípio IV da constituição (RLS obrigatória em toda tabela Supabase), mesmo quando a autorização de negócio real está no service.

## 2. Detecção de preço fora do padrão (outlier)

**Decision**: ao registrar um `PriceReport`, calcular a mediana dos preços `ACTIVE` mais recentes daquele produto (todas as ofertas, todos os mercados, até um teto de amostras recentes). Se houver menos de 3 amostras, aceitar direto (`ACTIVE`) — não há base para julgar. Caso contrário, se o desvio absoluto em relação à mediana for maior que 50%, marcar como `PENDING_REVIEW`; senão, `ACTIVE`.

**Rationale**: mediana é robusta a outliers anteriores (diferente de média, que um preço absurdo já puxaria para cima/baixo); 50% é um limiar simples, fácil de explicar e ajustar (constante nomeada, não mágica), coerente com o texto já existente na UI ("valores muito fora da média"). Calcular em memória a partir dos reportes existentes evita manter uma tabela de agregação adicional, adequado ao volume de dados esperado nesta fase (YAGNI).

**Alternatives considered**: z-score contra desvio padrão — rejeitado por exigir amostra maior para ser estatisticamente estável e ser mais difícil de explicar/ajustar do que um percentual simples sobre a mediana.

## 3. Pontuação e nível

**Decision**: `PRICE_REPORT_POINTS = 2`, `NEW_PRODUCT_POINTS = 5`, `CONFIRMATION_POINTS = 0` (confirmar não pontua, só incrementa confiança do preço). Nível: `level = floor(points / 100) + 1`; pontos para o próximo nível: `level * 100`; progresso: `(points % 100) / 100`.

**Rationale**: os valores de pontos vêm literalmente dos textos dos botões na UI existente ("+2 pontos", "+5 pontos"); a progressão de nível é deliberadamente linear e simples — não há requisito de negócio para uma curva específica, e os números de exemplo vistos em telas de protótipo (ex.: "nível 4", "132 pts") são dado de exemplo/mock, não especificação a reproduzir (documentado em Assumptions do spec).

**Alternatives considered**: progressão exponencial (patamares crescentes) — rejeitada por não ter nenhum requisito que a justifique agora; pode virar ajuste de constante depois, sem mudar a forma da API.

## 4. Papel de operador sem tela de administração

**Decision**: coluna `profiles.is_operator boolean default false`; um `OperatorGuard` novo que roda depois do `SupabaseJwtGuard` (precisa de `request.user` já populado) e consulta o próprio perfil para checar a flag. Conceder o papel é uma operação manual direta no banco (fora do escopo desta feature, ver Assumptions do spec) — não existe endpoint para uma pessoa se auto-promover a operador.

**Rationale**: resolve a clarificação do spec (moderação via API documentada, sem tela) com a menor superfície nova possível — um booleano e um guard, reaproveitando toda a infraestrutura de autenticação já existente.

**Alternatives considered**: tabela de roles genérica (RBAC completo) — rejeitada por YAGNI; não há múltiplos papéis a distinguir hoje, só "comum" vs "operador".

## 5. Swagger convivendo com validação por Zod

**Decision**: `@nestjs/swagger` com `DocumentBuilder`, montado em `/docs` (JSON em `/docs-json`), com security scheme `bearer` para os endpoints que exigem `SupabaseJwtGuard`. Cada schema de entrada tem um par: `*.schema.ts` (Zod, única fonte de validação em runtime, usada pelo `ZodValidationPipe`) e `*.dto.ts` (classe com `@ApiProperty`, usada só para o `@ApiBody`/`@ApiResponse` do Swagger — nunca instanciada nem usada para validar).

**Rationale**: `nestjs-zod` (que geraria Swagger a partir do próprio schema Zod, eliminando a duplicação) não suporta Nest 12 ainda (registrado em memória/pitfalls da feature 001); escrever o schema OpenAPI manualmente via classes é a via suportada pela versão atual de `@nestjs/swagger` sem depender de um pacote incompatível. O par schema+dto fica sempre no mesmo diretório (`dto/`), nomeado de forma espelhada, para o `/review` conseguir auditar divergência facilmente.

**Alternatives considered**: gerar o Swagger inteiramente à mão via objetos JSON Schema inline nas rotas — rejeitado por ficar mais verboso nos controllers e não reaproveitável entre rotas que devolvem a mesma forma de dado (ex.: produto aparece em busca e em detalhe).

## 6. Preço "vigente" por produto+mercado

**Decision**: não existe tabela própria de "preço atual". A oferta vigente de um produto em um mercado é sempre o `PriceReport` com `status = ACTIVE` mais recente (`createdAt` desc) daquele par `(productEan, marketId)`, calculado na consulta (agrupar em memória após buscar os reportes `ACTIVE` do produto, ou via `DISTINCT ON` no Postgres).

**Rationale**: volume de reportes por produto é pequeno nesta fase; manter uma tabela desnormalizada de "preço atual" introduziria um caminho de escrita adicional (e uma fonte a mais de bug: os dois poderiam divergir) sem necessidade real ainda (YAGNI). Se o volume crescer, isso pode virar uma materialização depois sem mudar o contrato da API.

**Alternatives considered**: tabela `current_offers` mantida por trigger — rejeitada por complexidade não justificada no estágio atual do produto.

## 7. Mercado: catálogo aberto, sem geolocalização

**Decision**: `POST /markets` (autenticado) faz upsert por nome (case-insensitive): se já existe um mercado com o mesmo nome, reaproveita; senão cria. `GET /markets` lista todos, sem distância (não há geolocalização coletada em nenhuma tela ainda).

**Rationale**: mantém o crescimento orgânico do catálogo (qualquer contribuidor pode adicionar um mercado novo ao reportar o primeiro preço lá) sem introduzir geocodificação, que não tem tela nem requisito nesta fase.

**Alternatives considered**: lista fixa de mercados curada manualmente — rejeitada por contradizer o modelo comunitário (a UI já convida a pessoa a informar preços "na gôndola", implicitamente em qualquer mercado que ela frequente).

## 8. Categorias de produto

**Decision**: enum Postgres/Prisma com nomes completos (`MERCEARIA`, `BEBIDAS`, `LIMPEZA`, `HIGIENE`, `FRIOS`, `PADARIA`); a API pública usa os mesmos códigos curtos já presentes no mock do frontend (`merc`, `beb`, `lim`, `hig`, `fri`, `pad`) via um mapa fixo em `products/categories.ts`, para o contrato ficar pronto para o frontend consumir sem precisar remapear nada quando trocar o mock por chamadas reais.

**Rationale**: nomes completos no banco tornam a migration/schema autoexplicativos; o mapa de tradução isola essa escolha de storage do contrato HTTP, que é o que importa para quem consome a API.
