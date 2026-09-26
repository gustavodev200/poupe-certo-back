# Feature Specification: Catálogo comunitário de preços

**Feature Branch**: `002-catalogo-precos-comunidade`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Catálogo comunitário de preços com busca, leitura de código de barras (EAN), cadastro e aprovação de produtos, registro e confirmação de preços por mercado, e perfil com pontuação/gamificação e ranking de contribuidores."

## Clarifications

### Session 2026-09-26

- Q: Quem aprova/rejeita produtos e preços em análise, já que não existe tela de administração no frontend? → A: Um papel de operador (flag no próprio perfil) com acesso a endpoints de moderação dedicados, documentados no Swagger, sem tela própria nesta fase — quem opera a plataforma usa a API diretamente.
- Q: Quando um preço reportado é sinalizado por estar muito fora da média, ele desaparece da lista de ofertas do produto até ser revisado, ou continua aparecendo com um aviso? → A: Fica invisível na lista pública de ofertas até ser aprovado — a UI atual não tem estado visual para "preço sob revisão", então evitar exibir dado não confiável é mais seguro que expor um preço possivelmente errado.
- Q: Cadastrar um produto novo concede pontos na hora do envio (como o texto do botão sugere: "Enviar para aprovação · +5 pontos") ou só depois de aprovado? → A: Concede na hora do envio (mantém a promessa mostrada no botão) mas os pontos são estornados automaticamente se o produto for rejeitado — equilibra a expectativa criada na UI com proteção contra abuso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buscar e comparar preços (Priority: P1)

Qualquer pessoa, mesmo sem estar autenticada, acessa a plataforma para descobrir onde um produto está mais barato. Ela busca por nome ou navega por categoria, vê uma lista de produtos com o menor preço disponível, e abre um produto para ver o preço em cada mercado, qual é o mais barato, a média, o maior preço, e o histórico recente.

**Why this priority**: É a proposta de valor central da plataforma — sem isso não há motivo para ninguém acessar. Precisa funcionar mesmo para quem nunca criou conta.

**Independent Test**: Pode ser testado sozinho: sem autenticação, buscar um produto existente, abrir seu detalhe, e confirmar que aparecem as ofertas por mercado ordenadas por preço, com a idade de cada preço visível.

**Acceptance Scenarios**:

1. **Given** existem produtos com preços aprovados cadastrados na base, **When** uma pessoa não autenticada busca por parte do nome ou marca, **Then** ela vê os produtos correspondentes com o menor preço de cada um.
2. **Given** um produto tem ofertas em múltiplos mercados, **When** a pessoa abre o detalhe do produto, **Then** ela vê todas as ofertas ordenadas do menor para o maior preço, com o mercado, o preço, a idade do preço e o número de confirmações de cada oferta.
3. **Given** uma busca sem nenhum produto correspondente, **When** a pessoa pesquisa, **Then** o sistema informa que nada foi encontrado, sem erro.
4. **Given** um produto tem preços registrados em datas diferentes, **When** a pessoa vê o detalhe, **Then** ela vê um histórico do menor preço ao longo do tempo.

---

### User Story 2 - Identificar produto por código de barras e reportar preço (Priority: P1)

Uma pessoa autenticada, dentro de um mercado físico, aponta a câmera (ou digita o código) para o código de barras (EAN) de um produto. Se o produto já existe na base, ela informa o preço que viu na etiqueta para aquele mercado. Se o produto não existe, ela é convidada a cadastrá-lo.

**Why this priority**: É o mecanismo que alimenta toda a base de preços — sem contribuição não há dado para comparar. Empatado em prioridade com a busca porque um depende do outro para ter valor ao longo do tempo.

**Independent Test**: Pode ser testado sozinho: autenticado, informar um EAN já cadastrado, submeter um preço para um mercado, e confirmar que a oferta aparece no detalhe do produto (ou, se o valor for um outlier, que ela fica pendente de revisão e não aparece publicamente ainda).

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada informa um EAN que já existe na base, **When** ela escolhe um mercado e informa o preço visto, **Then** o sistema registra o preço, concede pontos a ela, e o preço passa a aparecer como a oferta mais recente daquele mercado para aquele produto.
2. **Given** o preço informado está muito distante da média atual daquele produto, **When** o sistema recebe o reporte, **Then** o preço é marcado para revisão e não aparece na lista pública de ofertas até ser aprovado por um operador.
3. **Given** uma pessoa não autenticada tenta reportar um preço, **When** ela tenta enviar, **Then** o sistema nega a ação e indica que é necessário entrar na conta primeiro.
4. **Given** uma pessoa informa um EAN que não existe na base, **When** ela tenta reportar um preço para ele, **Then** o sistema indica que o produto precisa ser cadastrado antes.

---

### User Story 3 - Cadastrar produto novo (Priority: P2)

Uma pessoa autenticada encontra um produto cujo código de barras ainda não está na base. Ela preenche nome, marca, quantidade/embalagem e categoria, e envia para análise. O produto só aparece nas buscas públicas depois de aprovado.

**Why this priority**: Importante para o crescimento da base, mas a plataforma já entrega valor com os produtos que já existem (User Stories 1 e 2) mesmo sem essa capacidade no primeiro dia.

**Independent Test**: Pode ser testado sozinho: autenticado, enviar um cadastro de produto com um EAN inédito, confirmar que ele não aparece na busca pública enquanto pendente, e que aparece depois de aprovado por um operador.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada envia um novo produto com dados completos, **When** o envio é concluído, **Then** o sistema aceita o cadastro, concede pontos a ela, e o produto fica pendente de aprovação (não aparece na busca pública ainda).
2. **Given** um produto está pendente de aprovação, **When** um operador aprova, **Then** o produto passa a aparecer normalmente nas buscas e pode receber preços.
3. **Given** um produto está pendente de aprovação, **When** um operador rejeita, **Then** o produto não fica disponível publicamente e os pontos concedidos pelo envio são estornados da pessoa que cadastrou.
4. **Given** uma pessoa tenta cadastrar um produto com um EAN que já existe na base (aprovado ou pendente), **When** ela envia, **Then** o sistema recusa e indica que o produto já existe.

---

### User Story 4 - Confirmar se um preço ainda está correto (Priority: P2)

Uma pessoa vendo o detalhe de um produto confirma que o preço mostrado para um mercado ainda reflete a realidade, aumentando a confiança daquela informação para quem vir depois.

**Why this priority**: Reforça a qualidade do dado ao longo do tempo, mas o catálogo já funciona (com preços "envelhecendo" visualmente) sem essa ação existir.

**Independent Test**: Pode ser testado sozinho: autenticado, confirmar um preço existente, e verificar que o contador de confirmações daquele preço aumentou.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada vê uma oferta de preço, **When** ela confirma que o preço ainda está correto, **Then** o contador de confirmações daquela oferta aumenta em um.
2. **Given** uma pessoa já confirmou um preço específico antes, **When** ela tenta confirmar o mesmo preço de novo, **Then** o sistema não conta a confirmação duas vezes.
3. **Given** uma pessoa não autenticada tenta confirmar um preço, **When** ela tenta, **Then** o sistema nega a ação e indica que é necessário entrar na conta.

---

### User Story 5 - Ver o próprio perfil e ranking (Priority: P3)

Uma pessoa autenticada acessa o próprio perfil para ver quantos preços já reportou, quantos produtos criou, quantas confirmações já deu, seu percentual de confiança, pontos, nível atual, progresso para o próximo nível, posição no ranking geral de contribuidores, e um resumo das suas contribuições mais recentes.

**Why this priority**: É reforço de engajamento (gamificação) — a plataforma entrega valor de comparação de preço sem isso, mas ele incentiva mais gente a contribuir.

**Independent Test**: Pode ser testado sozinho: autenticado, reportar ao menos um preço e cadastrar um produto, depois abrir o próprio perfil e confirmar que as estatísticas refletem essas ações.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada já contribuiu com preços e produtos, **When** ela abre o próprio perfil, **Then** ela vê a contagem correta de preços reportados, produtos criados, confirmações dadas, pontos totais, nível atual e progresso até o próximo nível.
2. **Given** várias pessoas têm pontuações diferentes, **When** qualquer uma delas vê o próprio perfil, **Then** ela vê a própria posição no ranking geral de contribuidores.
3. **Given** uma pessoa quer ver quem mais contribui, **When** ela acessa o ranking geral, **Then** ela vê uma lista das pessoas com mais pontos, sem informações sensíveis de quem não deu consentimento para exibição pública (usa apenas nome de exibição e nível).

---

### Edge Cases

- O que acontece quando o mesmo EAN é reportado por duas pessoas em rápida sucessão para o mesmo mercado? Ambos os preços são aceitos como reportes independentes; o mais recente passa a ser a oferta vigente daquele mercado.
- O que acontece se um operador tentar aprovar/rejeitar um produto ou preço que já foi decidido antes? O sistema recusa a segunda decisão e informa o estado atual.
- O que acontece quando alguém tenta reportar um preço zero, negativo ou absurdamente alto (ex.: erro de digitação)? O sistema recusa valores zero/negativos de imediato; valores positivos mas muito fora da média entram em revisão em vez de serem recusados.
- O que acontece com o ranking e o percentual de confiança de uma pessoa cujo único produto cadastrado foi rejeitado? Os pontos são estornados e a contagem de "produtos criados" não inclui produtos rejeitados.
- O que acontece quando um produto não tem nenhuma oferta de preço ainda (recém-aprovado)? Ele aparece na busca, mas o detalhe indica que ainda não há preços reportados, convidando a pessoa a ser a primeira a reportar.
- O que acontece se uma pessoa tentar confirmar o próprio preço que ela mesma reportou? O sistema permite (não há indício na UI de que isso deva ser bloqueado), mas cada pessoa só conta uma confirmação por preço, então isso não gera contagem duplicada em reportes futuros dela mesma sobre o mesmo preço.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que qualquer pessoa, autenticada ou não, busque produtos por nome/marca e filtre por categoria, vendo apenas produtos aprovados.
- **FR-002**: O sistema DEVE permitir que qualquer pessoa, autenticada ou não, veja o detalhe de um produto aprovado: menor preço, preço médio, maior preço, todas as ofertas por mercado (ordenadas por preço) e o histórico de menor preço ao longo do tempo.
- **FR-003**: O sistema DEVE mostrar, para cada oferta de preço, a idade do reporte (o quão recente é) e o número de confirmações que ela recebeu, permitindo à interface classificar a confiança (recente / pode ter mudado / desatualizado / expirado) sem lógica adicional do cliente.
- **FR-004**: O sistema DEVE exigir autenticação para: reportar um preço, confirmar um preço, cadastrar um produto novo, e ver o próprio perfil/estatísticas — negando a ação com indicação clara para quem não estiver autenticado.
- **FR-005**: O sistema DEVE permitir que uma pessoa autenticada consulte um produto pelo código de barras (EAN) e receba, quando ele existir, os mesmos dados do detalhe do produto; quando não existir, DEVE indicar que o produto ainda não está cadastrado.
- **FR-006**: O sistema DEVE permitir que uma pessoa autenticada reporte um novo preço (mercado + valor) para um produto já existente na base.
- **FR-007**: O sistema DEVE recusar reportes de preço com valor zero, negativo ou não numérico, com mensagem clara do motivo.
- **FR-008**: O sistema DEVE avaliar automaticamente se um preço reportado está muito fora da média atual daquele produto e, se estiver, marcá-lo como pendente de revisão em vez de publicá-lo imediatamente como oferta válida.
- **FR-009**: O sistema NÃO DEVE exibir, na lista pública de ofertas de um produto, preços que estejam pendentes de revisão ou tenham sido rejeitados.
- **FR-010**: O sistema DEVE conceder pontos a uma pessoa quando um preço reportado por ela é aceito imediatamente (não pendente de revisão).
- **FR-011**: O sistema DEVE permitir que uma pessoa autenticada cadastre um produto novo (nome, marca, quantidade/embalagem, categoria, código de barras) quando o código de barras informado ainda não existir na base (nem como aprovado, nem como pendente).
- **FR-012**: O sistema DEVE conceder pontos a uma pessoa no momento em que ela envia um produto novo para análise, mesmo antes da aprovação.
- **FR-013**: O sistema DEVE manter todo produto recém-cadastrado por uma pessoa comum como pendente de aprovação, invisível nas buscas públicas até a decisão de um operador.
- **FR-014**: O sistema DEVE permitir que uma pessoa autenticada confirme que um preço específico ainda está correto, incrementando o contador de confirmações daquele preço no máximo uma vez por pessoa por preço.
- **FR-015**: O sistema DEVE expor, restrito a pessoas com papel de operador, a capacidade de listar itens (produtos e preços) pendentes de revisão e decidir aprovar ou rejeitar cada um.
- **FR-016**: O sistema DEVE negar o acesso às capacidades de moderação (FR-015) para qualquer pessoa sem o papel de operador, incluindo pessoas autenticadas comuns.
- **FR-017**: O sistema DEVE, ao rejeitar um produto pendente, estornar da pessoa que o cadastrou os pontos concedidos no envio (FR-012) e impedir que esse produto passe a existir publicamente.
- **FR-018**: O sistema DEVE recusar um segundo cadastro de produto para um código de barras que já exista na base, esteja ele aprovado ou pendente de revisão.
- **FR-019**: O sistema DEVE calcular e expor, para a própria pessoa autenticada: número de preços reportados por ela que foram aceitos, número de produtos criados por ela que foram aprovados, número de confirmações que ela deu, percentual de confiança (proporção dos próprios reportes que não foram rejeitados/marcados como revisão fora do padrão), pontos totais, nível atual e pontos restantes para o próximo nível.
- **FR-020**: O sistema DEVE expor a posição da própria pessoa autenticada em um ranking geral de contribuidores ordenado por pontos.
- **FR-021**: O sistema DEVE expor um ranking público dos principais contribuidores (nome de exibição, nível, pontuação/contagem de contribuições) sem exigir autenticação para visualização.
- **FR-022**: O sistema DEVE expor, para a própria pessoa autenticada, um retrospecto (feed) das suas contribuições mais recentes (preços reportados e produtos criados), com produto, mercado (quando aplicável), valor e data.
- **FR-023**: O sistema DEVE aplicar limite de taxa (rate limit) às ações de escrita sensíveis a abuso (reportar preço, confirmar preço, cadastrar produto) por pessoa autenticada, além do limite geral já existente na plataforma.

### Key Entities *(include if feature involves data)*

- **Categoria**: conjunto fixo e pré-definido de categorias de produto (ex.: Mercearia, Bebidas, Limpeza, Higiene, Frios, Padaria), usado para classificar e filtrar produtos.
- **Mercado**: um estabelecimento físico onde preços são observados — nome e endereço/localização.
- **Produto**: um item identificado unicamente por código de barras (EAN) — nome, marca, quantidade/embalagem, categoria, estado de aprovação (pendente/aprovado/rejeitado), quem cadastrou e quando.
- **Reporte de preço**: uma observação de preço de um Produto em um Mercado, feita por uma pessoa em um momento — valor, estado (aceito/pendente de revisão/rejeitado), quem reportou e quando. A oferta vigente de um produto em um mercado é o reporte aceito mais recente daquele par produto+mercado.
- **Confirmação de preço**: o registro de que uma pessoa confirmou que um Reporte de preço específico ainda está correto — no máximo uma por pessoa por reporte.
- **Perfil (pessoa)**: já existe (feature de login); esta feature adiciona ao perfil o total de pontos acumulados, e deriva dele o nível, o progresso para o próximo nível e a posição no ranking. Também carrega o papel de operador (sim/não) usado para moderação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa não autenticada consegue ir de "abrir a busca" a "ver o detalhe completo de um produto com todas as ofertas" em menos de 10 segundos, em condições normais de rede.
- **SC-002**: 100% dos reportes de preço com valor zero, negativo ou não numérico são recusados antes de chegar a virar uma oferta pública.
- **SC-003**: 100% dos preços identificados como fora do padrão de variação esperado ficam ausentes da lista pública de ofertas até uma decisão explícita de aprovação.
- **SC-004**: Uma pessoa autenticada consegue reportar um preço para um produto já existente em menos de 15 segundos de interação, do momento em que o produto é identificado até a confirmação de sucesso.
- **SC-005**: Zero casos de uma mesma pessoa contando mais de uma confirmação sobre o mesmo reporte de preço.
- **SC-006**: 100% das tentativas de reportar preço, confirmar preço, cadastrar produto ou acessar o próprio perfil sem autenticação são negadas.
- **SC-007**: 100% das tentativas de acessar as capacidades de moderação por uma pessoa sem o papel de operador são negadas.
- **SC-008**: As estatísticas mostradas no perfil de uma pessoa (pontos, nível, contagens) refletem corretamente suas ações aceitas dentro de poucos segundos da ação ocorrer.

## Assumptions

- O conjunto de categorias de produto é fixo nesta fase (não há tela para uma pessoa comum criar categorias novas).
- Não existe, nesta fase, uma tela de administração/moderação no frontend; a capacidade de aprovar/rejeitar é operada diretamente via chamadas de API autenticadas por uma pessoa com papel de operador, documentadas no Swagger. Conceder o papel de operador a um perfil é uma operação administrativa fora do escopo desta feature (feita diretamente no banco/painel do provedor).
- A "média atual" usada para decidir se um preço é um outlier é calculada a partir das ofertas aceitas mais recentes daquele produto (todas as ofertas de todos os mercados); o limiar exato de desvio é um parâmetro de negócio configurável, não uma regra fixa no código.
- Localização (UF/cidade) da pessoa é uma preferência apenas do navegador nesta fase — não é enviada nem persistida no backend, e o ranking/listagens desta feature não são filtrados por cidade.
- Favoritar produto/lista de compras aparece na interface, mas não está conectado a nenhuma ação real ainda — fica fora do escopo desta feature.
- Distância até o mercado (exibida hoje como texto estático na interface) depende de geolocalização do dispositivo da pessoa, que ainda não é coletada em nenhuma tela — fica fora do escopo desta feature; mercados são listados sem distância calculada.
- "Buscas em alta" (trending searches) é um retrospecto de termos mais buscados recentemente — a plataforma pode registrar os termos buscados para alimentar essa lista, sem qualquer dado pessoal além da própria pessoa que buscou (quando autenticada).
- Nível e pontos por nível seguem uma progressão simples e documentada (não precisam reproduzir números específicos de nenhuma tela de exemplo/protótipo).
- O texto exibido de "R$ X,XX" e formatação de moeda é responsabilidade do frontend; o backend expõe valores numéricos.
