# Feature Specification: Login social com Google

**Feature Branch**: `001-login-social-com`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Login social com Google via Supabase Auth para o backend NestJS: autenticar usuarios, proteger rotas validando a sessao emitida pelo Supabase, sincronizar perfil do usuario no banco, expor endpoint autenticado que confirma a sessao atual"

## Clarifications

### Session 2026-09-25

- Q: Precisa existir, já nesta fase, uma forma da pessoa apagar a própria conta e dados (direito de exclusão)? → A: Não — fora do MVP, registrado como débito conhecido para feature futura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar com a conta Google (Priority: P1)

Uma pessoa que nunca acessou a plataforma chega na tela de login e vê um único botão, "Continuar com Google". Ao clicar, ela autoriza o acesso com a própria conta Google e é levada direto para a área principal da plataforma — sem preencher formulário, criar senha ou confirmar e-mail.

**Why this priority**: É o único caminho de entrada da plataforma nesta fase — sem ele, ninguém acessa nada. Não existe cadastro por e-mail/senha.

**Independent Test**: Pode ser testado sozinho: clicar em "Continuar com Google", autorizar com uma conta Google de teste, e verificar que a pessoa chega autenticada na área principal, com um perfil já existindo para ela.

**Acceptance Scenarios**:

1. **Given** uma pessoa sem conta prévia na plataforma, **When** ela clica em "Continuar com Google" e autoriza o acesso, **Then** ela é autenticada e um perfil novo é criado automaticamente para ela.
2. **Given** uma pessoa que já entrou antes com a mesma conta Google, **When** ela repete o login, **Then** ela é autenticada no perfil já existente (nenhum perfil duplicado é criado).
3. **Given** uma pessoa não autenticada, **When** ela tenta acessar uma área que exige login, **Then** o acesso é negado e ela é direcionada para a tela de login.

---

### User Story 2 - Sair da conta (Priority: P2)

Uma pessoa autenticada quer encerrar a própria sessão (por exemplo, ao usar um computador compartilhado) e voltar ao estado de "não autenticado".

**Why this priority**: Importante para confiança/segurança do usuário, mas a plataforma continua utilizável (por uma única sessão) mesmo sem essa ação existir no primeiro dia.

**Independent Test**: Pode ser testado sozinho: com uma sessão ativa, acionar "Sair" e confirmar que uma tentativa seguinte de acessar área protegida é negada até novo login.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada, **When** ela aciona "Sair", **Then** a sessão é encerrada e uma nova tentativa de acessar área protegida exige login novamente.

---

### Edge Cases

- O que acontece quando a pessoa cancela ou nega a autorização na tela do Google (não completa o consentimento)? A plataforma deve devolvê-la à tela de login, sem criar perfil e com mensagem clara de que o login não foi concluído.
- Como o sistema trata uma sessão expirada ou inválida ao tentar acessar área protegida? Deve ser tratada como não autenticado (nunca como erro genérico que trave a aplicação).
- O que acontece quando a mesma conta Google é usada em dois dispositivos ao mesmo tempo? Ambas as sessões devem funcionar de forma independente, referenciando o mesmo perfil.
- O que acontece se a pessoa revogar o acesso da plataforma diretamente nas configurações da própria conta Google? Sessões já ativas no momento da revogação podem continuar válidas até expirar naturalmente; uma nova tentativa de login deve exigir novo consentimento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que uma pessoa se autentique usando exclusivamente a própria conta Google, através de uma única ação ("Continuar com Google") — sem formulário de e-mail/senha nesta fase.
- **FR-002**: O sistema DEVE criar automaticamente um perfil para a pessoa no primeiro login bem-sucedido, sem exigir nenhum passo adicional de cadastro.
- **FR-003**: O sistema DEVE reconhecer uma pessoa que já tem perfil e autenticá-la nesse mesmo perfil em logins seguintes, nunca duplicando perfil para a mesma conta Google.
- **FR-004**: O sistema DEVE negar acesso a qualquer área/funcionalidade protegida para quem não estiver autenticado.
- **FR-005**: O sistema DEVE permitir que uma pessoa autenticada encerre a própria sessão ("Sair").
- **FR-006**: O sistema DEVE permitir que o frontend verifique, a qualquer momento, se a sessão atual é válida e a quem ela pertence (ex.: "quem sou eu"), para decidir o que exibir.
- **FR-007**: O sistema DEVE armazenar apenas os dados mínimos de perfil necessários para identificar a pessoa (nome, e-mail, foto), sem expor esses dados a quem não tem autorização para vê-los.
- **FR-008**: O sistema NÃO DEVE oferecer nenhum outro método de login (e-mail/senha, outros provedores sociais) nesta fase.

### Key Entities *(include if feature involves data)*

- **Perfil (Profile)**: representa uma pessoa autenticada na plataforma — nome, e-mail, foto, data de criação. Um perfil por conta Google.
- **Sessão**: representa um período autenticado ativo de uma pessoa; tem validade limitada e pode ser encerrada manualmente ("Sair") ou expirar sozinha.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa nova consegue ir de "clicar em Continuar com Google" até estar na área principal da plataforma em menos de 15 segundos, em condições normais de rede.
- **SC-002**: 100% das tentativas de acesso a área protegida sem sessão válida são negadas.
- **SC-003**: Uma pessoa que já autenticou não precisa repetir o login enquanto a sessão continuar válida (sem prompts de login repetidos durante o uso normal).
- **SC-004**: Zero incidentes de exposição de dado de perfil de uma pessoa para outra pessoa não autorizada.

## Assumptions

- Google é o único método de login nesta fase — sem e-mail/senha, sem outros provedores sociais (confirmado pelo usuário).
- A pessoa já possui uma conta Google antes de usar a plataforma.
- A duração/expiração da sessão segue o padrão do provedor de autenticação usado por trás (não há requisito de negócio específico de duração nesta fase).
- Frontend e backend são aplicações separadas, comunicando-se pela internet (não há requisito de estarem no mesmo servidor).
- Não há, nesta fase, requisito de papéis/permissões diferentes entre pessoas (ex.: admin vs. usuário comum) — todo perfil autenticado tem o mesmo nível de acesso.
- Exclusão de conta/dados pessoais (direito de exclusão) fica fora do escopo desta feature — débito conhecido, entra numa feature futura antes de qualquer lançamento público (relevante por LGPD, dado que a plataforma trata dado pessoal de usuário no Brasil).
