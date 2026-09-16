---
title: Auditoria 360 — UI, UX visual e acessibilidade
tags: [auditoria, ui-ux, acessibilidade, visual, fase-4]
created: 2026-09-14
updated: 2026-09-14
status: consolidado-com-limitacoes
type: relatorio
---

# Fase 4 — UI/UX visual, navegação e acessibilidade

## Resultado e veredito visual

**12/20 — aceitável, com trabalho significativo necessário.** Foram confirmados **11 defeitos: 0 P0, 8 P1, 3 P2 e 0 P3**, registrados em **11 novas issues Linear, JON-160 a JON-170**. Todas estão em Backlog, no projeto Antenor e Filhos [NOVA REAL], com prioridade e descrição confirmadas por leitura posterior. Nenhuma correção de aplicação foi executada.

**Teste de anti-patterns: aprovado com ressalvas.** A identidade de empório é reconhecível nas fotografias, bordo e dourado; não parece uma interface gerada genericamente sem direção. A Home e a Adega usam expressão editorial coerente com PRODUCT.md, enquanto o catálogo conserva preço, foto e compra como elementos principais. Cards aninhados da PDP/checkout e sombras fortes em ações de login são oportunidades de simplificação; não foram promovidos a defeitos independentes sem demonstrar perda funcional. A falha visual objetiva no cadastro é a marca branca sobre branco (A4-11).

As prioridades são o modal de endereço que deixa o teclado no fundo, a ação de mostrar senha inacessível via Tab e a legibilidade de texto/foco. Elas afetam diretamente a meta de concluir a compra sem assistência pelo WhatsApp.

| Dimensão impeccable | Nota /4 | Fundamentação no recorte |
|---|---:|---|
| Acessibilidade | 2 | Rótulos/ARIA e teclado existem em vários componentes, mas persistem oito grupos de falhas importantes; não satisfaz AA no recorte medido. |
| Performance visual | 3 | Skeletons, imagens lazy e dimensões reservadas presentes; falta avaliação de campo e a entrada da Adega ignora reduce. |
| Responsividade | 2 | Layouts utilizáveis em três larguras e 320px sem overflow documental medido; vários alvos frequentes são pequenos. |
| Theming | 2 | Paleta/família da vitrine reconhecíveis, mas tokens coexistem com valores literais e estilos independentes nos apps. |
| Anti-patterns | 3 | Composição intencional; densidade e camadas de cards podem melhorar, sem descaracterizar a marca estabelecida. |
| **Total** | **12/20** | **Aceitável; corrigir as lacunas importantes antes de declarar conformidade.** |

Notas são juízo técnico sobre as superfícies observadas e a inspeção estática indicada abaixo, não certificação de toda a plataforma. O contraste desejado e a regra de 44px também expõem conflitos internos do próprio DESIGN.md: ele especifica placeholder Tabaco/60, anel dourado e botões de 32/36/40px. Seguir esses tokens literalmente não basta para cumprir os critérios da auditoria.

## Snapshot, proveniência e preservação

- Repositório: `F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr`; branch `main`; HEAD `1ad50ea31862dc0fb1ba35b2de95d54bee1b2bbf`.
- Consolidação: **14/09/2026, 01:49–02:00, America/Sao_Paulo (UTC−03)**. A data precisa de cada lote está em seus manifestos/recibos.
- Evidências herdadas: 81 capturas de rotas + 3 capturas de popup, geradas antes da reinicialização, conforme orientação de recuperação do coordenador. `manifesto.json` registra 2026-09-13T23:10:17.440Z e Chrome 152.0.7977.83.
- Complemento executado nesta retomada: 57 capturas de fluxo + 23 capturas dirigidas. Chrome real controlado por Playwright, headless, PNG original, deviceScaleFactor=1.
- Stack Docker local preexistente: storefront :3000, admin :3002, picking :3003, delivery :3004, API :3001. Nenhum servidor ou serviço de aplicação foi iniciado/reiniciado.
- As medições descrevem **os builds servidos pelos containers locais**. Não foi atestada equivalência binária entre imagens Docker e HEAD; o código foi usado para explicar ocorrências compatíveis, não para inventar a revisão do build.
- Worktree sujo preexistente, inclusive `docs/deploy.md` modificado e múltiplos arquivos não rastreados. Sem commit, push, deploy, migrations, seeds, alteração de dados ou correção de código/configuração.
- Ownership desta execução: somente este relatório e `evidencias/fase-4/`, além das escritas Linear autorizadas. Os 175 artefatos herdados foram preservados.
- Browser context sem sessão e com service workers bloqueados; GET/HEAD/OPTIONS permitidos somente em localhost/127.0.0.1 e nos hosts das fontes Google. Métodos mutáveis e demais hosts foram abortados antes do envio. Carrinho foi manipulado exclusivamente em armazenamento do contexto descartável; nenhum pedido, login real ou pagamento foi enviado.
- Orca embedded browser foi tentado, mas snapshot/eval retornaram `runtime_unavailable: The Orca runtime closed the connection before responding`. Navegação complementar migrou para Playwright já instalado, conforme skills orca-cli/computer-use; não houve ação de desktop externo.

## Contexto e método

Referências: [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), [PRODUCT.md](../../PRODUCT.md), [DESIGN.md](../../DESIGN.md) e relatórios [01](01-analise-estatica-arquitetura.md), [02](02-seguranca-autenticacao-sessoes.md) e [03](03-apis-integracoes-banco.md). As fases anteriores registram lacunas semânticas e não foram reinterpretadas como certificados. A retomada priorizou os manifestos e evidências herdadas conforme mensagem do coordenador; não apresenta uma nova revisão integral dos extensos inventários das fases 1–2.

Skill impeccable: SKILL.md, fluxo `reference/audit.md` e registro `reference/product.md` consultados; `node .agents/skills/impeccable/scripts/context.mjs --target sistema` executado uma vez nesta sessão, resolvendo PRODUCT.md/DESIGN.md da raiz. A skill orientou a escala de cinco dimensões e a distinção entre falha medida e oportunidade visual.

Design system real inspecionado: `sistema/frontend/tailwind.config.js`, `src/index.css`, `components/ui/button.tsx`, `input.tsx`, `password-input.tsx`, páginas e modal citados nos achados; estilos/tokens e logins dos apps administrativos/operacionais. O storefront usa Source Sans 3; picking/delivery usam stack de sistema; o admin declara outra família. A preferência de linguagem visual do PRODUCT é explicitamente centrada no cliente; não se exige que um login operacional copie toda a composição da vitrine.

A avaliação combinou screenshots, navegação/click/Tab/Escape/focus/hover reais, árvore de acessibilidade, DOM/computed styles e inspeção de código. Sem mockup nominal/Figma fornecido, **não foi feita comparação pixel a pixel**. Foram comparadas regras de composição, dimensões e tokens, com limites explícitos de runtime e viewport.

## Inventário de superfícies e cobertura de rotas

M = 390×844; T = 768×1024; D = 1440×900; adicional R = 320×740. São CSS pixels, com user agent desktop: **viewport móvel não equivale a aparelho iOS/Android**, e não exercita ramo dependente de user agent, como GPS móvel. Arquivos usam `app--rota--viewport--estado.png`; JSON homônimo contém URL final, dimensões e medidas.

A matriz abaixo corresponde às **81 capturas herdadas** do [manifesto](evidencias/fase-4/manifesto.json), 27 casos × três viewports. “Default” é o nome de arquivo usado pelo primeiro runner; a coluna estado descreve o que foi alcançado, sem confundir uma tela de login com a área autenticada.

| App | Rota solicitada | Slug de evidência | Viewports | Estado/cobertura real |
|---|---|---|---|---|
| Storefront | / | home | M/T/D | Entrada; complemento confirma conteúdo após fechar popup. |
| Storefront | /mercado | mercado | M/T/D | Catálogo; alguns frames ainda em skeleton, complementados por conteúdo e busca. |
| Storefront | /mercado?q=zzqa-auditoria-inexistente | busca-vazia | M/T/D | Nenhum resultado; ajuda e rodapé. |
| Storefront | /adega | adega | M/T/D | Editorial/filtros; complemento rola aos produtos. |
| Storefront | /promocoes | promocoes | M/T/D | Estado vazio disponível no ambiente. |
| Storefront | /receitas | receitas | M/T/D | Lista/vazio do ambiente. |
| Storefront | /receitas/auditoria-inexistente | receita-inexistente | M/T/D | Detalhe inexistente. |
| Storefront | /produto/auditoria-inexistente | produto-inexistente | M/T/D | Erro de produto; PDP válida no complemento. |
| Storefront | /encarte/auditoria-inexistente | encarte-inexistente | M/T/D | Campanha inexistente. |
| Storefront | /cart | carrinho | M/T/D | Carrinho vazio. |
| Storefront | /checkout | checkout | M/T/D | Entrada com carrinho vazio, sem sessão autenticada. |
| Storefront | /login | login | M/T/D | Login sem envio. |
| Storefront | /register | cadastro | M/T/D | Cadastro sem envio. |
| Storefront | /esqueci-minha-senha | recuperacao | M/T/D | Formulário sem enviar e-mail. |
| Storefront | /redefinir-senha | reset-sem-token | M/T/D | Sem token; ação desabilitada conferida depois. |
| Storefront | /forbidden | sem-permissao | M/T/D | Fallback de permissão. |
| Storefront | /auditoria-inexistente | 404 | M/T/D | Página não encontrada. |
| Storefront | /privacidade | privacidade | M/T/D | Documento público, índice e rodapé. |
| Storefront | /termos | termos | M/T/D | Documento público, índice e rodapé. |
| Storefront | /account | conta-sem-sessao | M/T/D | Redireciona a /login; conta não navegada. |
| Admin | /login | login | M/T/D | Login sem envio. |
| Admin | /redefinir-senha | reset-sem-token | M/T/D | Sem token oferece solicitar recuperação. |
| Admin | /forbidden | sem-permissao | M/T/D | Fallback público. |
| Admin | /auditoria-inexistente | 404 | M/T/D | Página não encontrada. |
| Admin | / | dashboard-sem-sessao | M/T/D | Redireciona a /login; dashboard não navegado. |
| Picking | / | login | M/T/D | Login; sessão ausente no contexto. |
| Delivery | / | login | M/T/D | Login; sessão ausente no contexto. |

[Exemplo de catálogo desktop](evidencias/fase-4/storefront--mercado--desktop--default.png), [Home mobile carregada](evidencias/fase-4/storefront--home--mobile--carregado-validado.png) e [Adega mobile](evidencias/fase-4/storefront--adega--mobile--default.png).

### Telas inventariadas com acesso limitado

| Superfície | Inventário estático | Limitação |
|---|---|---|
| Aliases storefront | /vinhos, /adega-antenor → WinePage; /busca → redirecionamento legado | Componentes/roteamento identificados; aliases não navegados individualmente. |
| Conta | /account: perfil, pedidos/detalhe e endereços | Sem sessão local de teste comprovada; cobertura visual termina no login. |
| Checkout | Entrega, pagamento, confirmação; endereço/localidade, erro de cotação, divergência de preço | Entrada convidada com item local observada; não se avançou por identidade, criação de sessão remota, cobrança ou confirmação. |
| Admin / | dashboard, products, orders, picking, staff, teamPerformance, businessAccounts, customers, layout, categories, deliveryRoutes, deliveryZones, businessHours, fraudAudit, notifications, coupons, recipes, storeBanners, brandIdentity, intelligence, integrations, payments | **22 seções** de Dashboard.tsx inventariadas. Controles, modais e tabelas internos não tiveram cobertura visual autenticada. |
| Picking / | login → OrderList → OrderPicking; busca, item, substituição/peso e conclusão | State machine interna, sem URL por tela. Somente login navegável com contexto autorizado disponível. |
| Delivery / | login → RouteList → RouteDetail; paradas/pedido, navegação e conclusão | State machine interna; somente login observado. |
| Notificador | renderer/index.html: lista/atualizar; toast.html: alerta; preload/IPC Electron | Não é app web hospedado; sem inicializar processo que consulta ERP. Inventário estático, sem screenshots nem nota visual específica. |
| HTMLs auxiliares | stats.html de build, auditoria_report.html, relatórios históricos de docs/design | Artefatos/documentos, não jornadas do produto; não navegados como apps de produção. |
| API | Superfície REST sob /api, sem frontend GraphQL identificado pela Fase 3 | Não considerada UI de produto; nenhuma exploração de dados privados ou console administrativo. |

Os testes Cypress encontrados usam fixtures/tokens simulados; isso não constitui credencial de uma conta local existente. Credenciais mencionadas na documentação operacional não foram assumidas como exclusivamente de teste. Não se transplantou sessão, forjou token ou acessou cadastro real para aumentar artificialmente a cobertura.

### Estados e navegação complementar

| Lote | Casos | Estados alcançados |
|---|---:|---|
| manifesto-fluxos.json, herdado | 3 PNG | Popup promocional M/T/D. Escape fechou; o runner depois falhou ao tentar clicar Fechar já inexistente. Os fluxos subsequentes desse runner **não ocorreram**. |
| manifesto-complementar.json | 57 PNG | 19 estados × M/T/D: Home carregada; endereço aberto/teclado; PDP carregada; carrinho com item local; checkout inicial; filtros/sugestões/resultado arroz; login focus/hover; cadastro erro/local e fim; recuperação admin; Mercado/Cadastro/Adega em 320px; cadastro com raiz 32px; Adega reduce. |
| verificacao-dirigida.json | 23 PNG | 7 estados × M/T/D: foco da busca, rodapé vazio, produtos Adega, erros visíveis de cadastro, reset disabled, foco picking/delivery; mais loading e falha de rede simulados em M. |

Os 320px são repetidos por contexto M/T/D para rastrear o lote, mas têm o **mesmo viewport final 320×740** no JSON; não são três dispositivos diferentes. Alterar a raiz para 32px testa rem/text scaling: **não é equivalente a zoom nativo de 200%**. O `font-size:16px!important` dos inputs limita a extrapolação dessa prova.

Loading simulado: GETs /api são atrasados 3,5s. Erro simulado: GETs /api abortados no contexto de teste. São experiências de frontend deliberadamente controladas, não incidentes reais da API. Todos os métodos mutáveis continuam abortados.

## Critérios técnicos, medições e falsos positivos descartados

- Contraste: luminância sRGB com composição alpha dos backgrounds até a raiz; limiar 4,5:1 para texto comum e 3:1 somente a partir de 24 CSS px ou 18,667 CSS px em negrito. Placeholder ativo também precisa de contraste. Áreas com background-image/opacidade de ancestral não foram automaticamente aprovadas/reprovadas. [W3C — contraste mínimo](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).
- Foco: inspeção de outline/box-shadow em estado real; Tab e Escape exercitados no modal/login. O padrão modal requer foco interno, contenção e restauração; aria-modal sozinho não implementa isso. [WAI-ARIA — diálogo modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Alvo 44×44 é requisito adicional solicitado. Em WCAG **2.1**, SC 2.5.5 é **AAA**, não AA; os P2 de tamanho não são falsamente apresentados como violações AA. Pseudo-elementos que expandem hit area foram considerados, especialmente nos botões dos vinhos. [W3C — tamanho de alvo](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html).
- Scanner de nome acessível é heurístico. Árvore AX real confirmou fallback de placeholder nos logins operacionais; a ausência absoluta de nome sugerida pelo JSON foi descartada. A4-03 trata rótulo persistente/associação explícita.
- O JSON `controles` inclui elementos renderizados fora da dobra. Retângulo menor que 44 não é sozinho veredito: imagens de vinho têm alvos estendidos por pseudo-elemento. Links de texto corrido não receberam ticket automático de tamanho.
- Landmarks: Mercado/Adega/legais apresentam main/nav; auth/fallbacks frequentemente não têm main. Isso é uma oportunidade de semântica; ausência isolada de main em login pequeno não foi usada como prova automática de falha WCAG.
- Imagens com alt foram enumeradas. NaturalWidth=0 em imagens lazy fora da tela não demonstra imagem quebrada. Os cards de vinho foram rolados para observação. A marca do cadastro foi confirmada carregada (naturalWidth=1080), distinguindo A4-11 de falha de rede.
- Nenhum overflow horizontal **documental** foi medido nos 164 frames, incluindo 320px e escala de rem. Isso não garante ausência de recorte dentro de carrosséis, texto truncado por line-clamp ou cobertura de todos os textos possíveis.
- O scanner registra somatório de layout-shift sem recent input, chamado `cls` no JSON. **Não implementa a janela de sessões completa do CLS oficial** e mede páginas em navegação/carga curta. Um valor de aproximadamente 0,80 na busca vazia herdada é sinal para investigar, não prova de CLS de campo nem novo defeito fechado nesta fase.
- Não houve Lighthouse, axe, leitor de tela humano, Safari/iOS, hardware touch, benchmark de frames ou teste de carga. O resultado é auditoria dirigida com evidência, não certificado WCAG completo.

## Achados confirmados e Linear

| ID | Prioridade | Linear | Defeito |
|---|---|---|---|
| A4-01 | P1 / High | [JON-160](https://linear.app/eojonathan/issue/JON-160) | Placeholders de formularios ficam abaixo do contraste AA |
| A4-02 | P1 / High | [JON-161](https://linear.app/eojonathan/issue/JON-161) | Textos de apoio do catalogo adega e rodape nao atingem contraste AA |
| A4-03 | P1 / High | [JON-162](https://linear.app/eojonathan/issue/JON-162) | Busca e logins operacionais dependem apenas de placeholder como rotulo |
| A4-04 | P1 / High | [JON-163](https://linear.app/eojonathan/issue/JON-163) | Links de icone do carrinho e de retorno nao possuem nome acessivel |
| A4-05 | P1 / High | [JON-164](https://linear.app/eojonathan/issue/JON-164) | Modal de endereco deixa foco no fundo e nao responde a Escape |
| A4-06 | P1 / High | [JON-165](https://linear.app/eojonathan/issue/JON-165) | Mostrar senha fica fora da navegacao por teclado |
| A4-07 | P1 / High | [JON-166](https://linear.app/eojonathan/issue/JON-166) | Erros do cadastro nao se associam corretamente aos campos |
| A4-08 | P1 / High | [JON-167](https://linear.app/eojonathan/issue/JON-167) | Aneis de foco customizados usam contraste inferior a 3 para 1 |
| A4-09 | P2 / Medium | [JON-168](https://linear.app/eojonathan/issue/JON-168) | Controles frequentes no mobile ficam abaixo do alvo de toque de 44 px |
| A4-10 | P2 / Medium | [JON-169](https://linear.app/eojonathan/issue/JON-169) | Animacao de entrada da Adega ignora prefers-reduced-motion |
| A4-11 | P2 / Medium | [JON-170](https://linear.app/eojonathan/issue/JON-170) | Cadastro renderiza logo branco sobre painel branco e cria vazio no cabecalho |

### A4-01 — Placeholders de formularios ficam abaixo do contraste AA

**P1 / High · [JON-160](https://linear.app/eojonathan/issue/JON-160) · accessibility**

**Local:** Storefront /login, /esqueci-minha-senha, /redefinir-senha e modal de endereço; picking :3003/ e delivery :3004/. default e focus; mobile 390x844, tablet 768x1024, desktop 1440x900. Fonte: `sistema/frontend/src/components/ui/input.tsx:17; sistema/picking-app/src/pages/Login.tsx:56; sistema/delivery-app/src/pages/Login.tsx:56`.

**Evidência:** Tabaco rgba(138,106,58,0.6) sobre branco: 2,375:1 em 16px. Nos logins operacionais, branco/40 sobre fundo composto rgb(92.1,30.9,56.1): 3,222:1. Ambos exigem 4,5:1. O mesmo token está prescrito no DESIGN.md, portanto também precisa de correção na documentação ao implementar.

**Impacto:** Pessoas com baixa visão perdem instruções de preenchimento; nos apps operacionais o placeholder é a única indicação visual do campo.

**Critério:** 1.4.3 Contraste mínimo (AA).

**Screenshots:** [storefront--login--mobile--focus.png](evidencias/fase-4/storefront--login--mobile--focus.png), [picking--login--mobile--default.png](evidencias/fase-4/picking--login--mobile--default.png), [delivery--login--mobile--default.png](evidencias/fase-4/delivery--login--mobile--default.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- placeholder:text-[#8A6A3A]/60
+ placeholder:text-[#5D4F33]
- placeholder:text-white/40
+ placeholder:text-white/80
// Recalcular sobre o fundo composto real.
```

**Aceite:** Todo placeholder ativo alcança >=4,5:1 nos três viewports; conferir também erro/hover; preservar contraste após foco.

**Reprodução:** Abrir cada login sem sessão; inspecionar getComputedStyle(input, '::placeholder') e compor alpha sobre os ancestrais; conferir os JSONs homônimos.

**Comando sugerido:** `/impeccable colorize`.


### A4-02 — Textos de apoio do catalogo adega e rodape nao atingem contraste AA

**P1 / High · [JON-161](https://linear.app/eojonathan/issue/JON-161) · accessibility**

**Local:** Storefront /mercado?q=zzqa-auditoria-inexistente, /adega, /privacidade e /termos. vazio, produtos e rodapé; três viewports. Fonte: `sistema/frontend/src/pages/Search.tsx:899; sistema/frontend/src/pages/WinePage.tsx:235; sistema/frontend/src/components/Footer.tsx`.

**Evidência:** Orientação do vazio em #9ca3af sobre branco: 2,539:1 (14px). Contagem de tintos em dourado/50 sobre #1c1917: 3,301:1 (12px/700); contador ativo: 3,419:1. Link WhatsApp 2 do rodapé: 3,738:1. Valores próximos de 4,5 não foram arredondados para aprovação.

**Impacto:** Instruções para recuperar uma busca e metadados de compra perdem legibilidade justamente quando a pessoa precisa de orientação.

**Critério:** 1.4.3 Contraste mínimo (AA).

**Screenshots:** [storefront--busca-vazia--mobile--rodape.png](evidencias/fase-4/storefront--busca-vazia--mobile--rodape.png), [storefront--adega--mobile--produtos.png](evidencias/fase-4/storefront--adega--mobile--produtos.png), [storefront--busca-vazia--desktop--default.png](evidencias/fase-4/storefront--busca-vazia--desktop--default.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- text-gray-400
+ text-[#5D4F33]
- text-[#D2BB8A]/50
+ text-[#D2BB8A]
// Escurecer o verde do link no fundo composto e medir novamente.
```

**Aceite:** Texto de apoio, contagens e links ativos >=4,5:1; auditar também produto e rodapé fora da primeira dobra; não alterar imagens para mascarar contraste.

**Reprodução:** Abrir busca sem resultado; ler a orientação e rolar ao rodapé; abrir Adega e medir contadores dos filtros e metadados dos cards.

**Comando sugerido:** `/impeccable colorize`.


### A4-03 — Busca e logins operacionais dependem apenas de placeholder como rotulo

**P1 / High · [JON-162](https://linear.app/eojonathan/issue/JON-162) · accessibility**

**Local:** Storefront /mercado; picking :3003/; delivery :3004/. default e preenchimento; três viewports. Fonte: `sistema/frontend/src/pages/Search.tsx:535; sistema/picking-app/src/pages/Login.tsx:48; sistema/delivery-app/src/pages/Login.tsx:48`.

**Evidência:** Inputs sem label associado, aria-label ou aria-labelledby. A árvore AX do Chromium encontra textbox Email/Senha usando fallback do placeholder: NÃO se afirma ausência absoluta de nome acessível nesse navegador. Ao digitar, a indicação visual desaparece; não há rótulo persistente.

**Impacto:** Usuário perde a referência visual durante preenchimento e a identificação depende de fallback do agente de usuário.

**Critério:** 3.3.2 Rótulos ou instruções; 1.3.1 Informações e relações — avaliar a associação explícita.

**Screenshots:** [picking--login--mobile--focus.png](evidencias/fase-4/picking--login--mobile--focus.png), [delivery--login--mobile--focus.png](evidencias/fase-4/delivery--login--mobile--focus.png), [storefront--mercado--mobile--focus.png](evidencias/fase-4/storefront--mercado--mobile--focus.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
+ <label htmlFor='email'>E-mail</label>
- <input placeholder='Email' ... />
+ <input id='email' autoComplete='email' ... />
// Idem senha; na busca, label visual compacto ou nome explícito com referência visual persistente.
```

**Aceite:** Campos têm nomes explícitos, rótulos continuam visíveis após digitar, e a árvore AX não depende de placeholder; manter autocomplete e inputs de 16px.

**Reprodução:** Inspecionar labels/ARIA, digitar texto fictício sem enviar e observar que o placeholder some; comparar verificacao-dirigida.json com o markup.

**Comando sugerido:** `/impeccable harden`.


### A4-04 — Links de icone do carrinho e de retorno nao possuem nome acessivel

**P1 / High · [JON-163](https://linear.app/eojonathan/issue/JON-163) · accessibility**

**Local:** Storefront /mercado, /produto/:id, /promocoes, /privacidade e /termos. default, carrinho vazio; três viewports. Fonte: `sistema/frontend/src/pages/Search.tsx:597; sistema/frontend/src/pages/ProductDetail.tsx; sistema/frontend/src/pages/Promocoes.tsx; sistema/frontend/src/pages/PrivacyPolicy.tsx; sistema/frontend/src/pages/TermsOfUse.tsx`.

**Evidência:** Links contêm apenas SVG Lucide sem texto/aria-label/title. Carrinho vazio na busca/PDP resulta em link sem nome; em páginas legais e promoções a seta de retorno também não tem nome. Com item, número isolado não descreve a ação.

**Impacto:** Leitor de tela anuncia links sem finalidade e navegação por lista de links perde utilidade.

**Critério:** 4.1.2 Nome, função e valor; 2.4.4 Finalidade do link.

**Screenshots:** [storefront--mercado--desktop--default.png](evidencias/fase-4/storefront--mercado--desktop--default.png), [storefront--produto--mobile--carregado.png](evidencias/fase-4/storefront--produto--mobile--carregado.png), [storefront--promocoes--mobile--default.png](evidencias/fase-4/storefront--promocoes--mobile--default.png), [storefront--privacidade--mobile--default.png](evidencias/fase-4/storefront--privacidade--mobile--default.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- <Link to='/cart'><ShoppingCart /></Link>
+ <Link to='/cart' aria-label={`Carrinho com ${count} itens`}><ShoppingCart aria-hidden='true'/></Link>
+ // Rotular setas de retorno conforme o destino real.
```

**Aceite:** Todos os links somente ícone possuem nome orientado à ação, com carrinho vazio e preenchido; validar árvore AX e teclado.

**Reprodução:** Abrir rotas sem sessão e sem item; inspecionar links no JSON/árvore AX e o conteúdo do elemento.

**Comando sugerido:** `/impeccable harden`.


### A4-05 — Modal de endereco deixa foco no fundo e nao responde a Escape

**P1 / High · [JON-164](https://linear.app/eojonathan/issue/JON-164) · accessibility**

**Local:** Storefront /, botão Escolher endereço de entrega. modal aberto e teclado; três viewports. Fonte: `sistema/frontend/src/components/DeliveryVerificationModal.tsx:306`.

**Evidência:** Apesar de role=dialog e aria-modal=true, abrir não move o foco. As 14 pressões de Tab seguintes percorrem carrinho, busca e categorias do fundo. Escape mantém o modal aberto nos três viewports. manifesto-complementar.json documenta a sequência; não há inert ou contenção de foco.

**Impacto:** Navegação por teclado ocorre por trás do bloqueio visual; o contexto modal anunciado não coincide com a interação real.

**Critério:** 2.4.3 Ordem do foco; padrão WAI-ARIA APG Dialog (Modal). Escape é recomendação do padrão, não critério AA isolado..

**Screenshots:** [storefront--endereco--mobile--modal-aberto.png](evidencias/fase-4/storefront--endereco--mobile--modal-aberto.png), [storefront--endereco--mobile--teclado.png](evidencias/fase-4/storefront--endereco--mobile--teclado.png), [storefront--endereco--desktop--teclado.png](evidencias/fase-4/storefront--endereco--desktop--teclado.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
+ // Usar dialog.showModal() ou primitive de diálogo acessível.
+ moverFocoParaCampoAoAbrir();
+ tornarFundoInerte();
+ conterTabEFecharComEscape();
+ devolverFocoAoAcionadorAoFechar();
```

**Aceite:** Abertura foca elemento interno; Tab/Shift+Tab ficam no modal; Escape fecha; foco volta ao acionador; fundo não é operável/anunciado como ativo.

**Reprodução:** Abrir Home, fechar popup promocional se houver, clicar Escolher endereço de entrega e pressionar Tab 14 vezes e Escape.

**Comando sugerido:** `/impeccable harden`.


### A4-06 — Mostrar senha fica fora da navegacao por teclado

**P1 / High · [JON-165](https://linear.app/eojonathan/issue/JON-165) · accessibility**

**Local:** Storefront /login, /register e /redefinir-senha. focus; três viewports. Fonte: `sistema/frontend/src/components/ui/password-input.tsx:28`.

**Evidência:** Botão Mostrar/Ocultar senha tem tabIndex=-1 e não oferece atalho alternativo. Sequência real de Tab pula o botão entre Senha e Esqueci minha senha; JSON confirma 18x18 e tabindex -1.

**Impacto:** Usuários que operam por teclado não conseguem revisar a senha digitada pelo mesmo recurso disponível ao mouse/toque.

**Critério:** 2.1.1 Teclado (A).

**Screenshots:** [storefront--login--mobile--focus.png](evidencias/fase-4/storefront--login--mobile--focus.png), [storefront--reset-sem-token--mobile--disabled.png](evidencias/fase-4/storefront--reset-sem-token--mobile--disabled.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- tabIndex={-1}
+ className='... min-h-11 min-w-11 focus-visible:ring-2 ...'
+ aria-pressed={visible}
```

**Aceite:** Tab alcança o botão; Enter/Espaço alternam visibilidade preservando valor e foco; nome e estado acessíveis atualizam; nenhuma submissão involuntária.

**Reprodução:** Focar identificador no login e seguir com Tab: a sequência atual salta diretamente de Senha para recuperação.

**Comando sugerido:** `/impeccable harden`.


### A4-07 — Erros do cadastro nao se associam corretamente aos campos

**P1 / High · [JON-166](https://linear.app/eojonathan/issue/JON-166) · accessibility**

**Local:** Storefront /register. erro local após blur; três viewports. Fonte: `sistema/frontend/src/pages/Register.tsx:26 e :159`.

**Evidência:** Nome usa aria-describedby=name-error, mas FieldError não cria esse id. Email inválido recebe aria-invalid=true e mensagem com role=alert, porém sem aria-describedby. O alerta existente é positivo, mas não reconstitui a relação ao voltar ao campo.

**Impacto:** Ao revisar os erros com leitor de tela, o usuário não recebe de forma confiável a explicação vinculada ao campo.

**Critério:** 1.3.1 Informações e relações; 3.3.1 Identificação de erros (associação a validar).

**Screenshots:** [storefront--cadastro--mobile--erros-visiveis.png](evidencias/fase-4/storefront--cadastro--mobile--erros-visiveis.png), [storefront--cadastro--desktop--erros-visiveis.png](evidencias/fase-4/storefront--cadastro--desktop--erros-visiveis.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- function FieldError({msg})
+ function FieldError({id,msg})
- <p role='alert'>
+ <p id={id} role='alert'>
+ <Input aria-describedby={erroVisivel ? 'email-error' : undefined}/>
+ <FieldError id='email-error' msg={erroVisivel}/>
```

**Aceite:** Cada referência ARIA aponta a elemento existente quando o erro está visível; todos os campos inválidos têm descrição correspondente; alertas continuam presentes sem duplicar anúncio.

**Reprodução:** Deixar Nome vazio, focar e sair; digitar auditoria-invalida no Email e sair; inspecionar referênciasAusentes no JSON e retornar aos campos.

**Comando sugerido:** `/impeccable harden`.


### A4-08 — Aneis de foco customizados usam contraste inferior a 3 para 1

**P1 / High · [JON-167](https://linear.app/eojonathan/issue/JON-167) · accessibility**

**Local:** Storefront /login e componentes Input/Button compartilhados. focus por teclado; três viewports. Fonte: `sistema/frontend/src/components/ui/input.tsx:17; sistema/frontend/src/components/ui/button.tsx:8`.

**Evidência:** Anel de Input em #D2BB8A contra branco mede 1,8724:1. Anel primary em bordo/30 composto sobre branco fica aproximadamente 1,9:1. O outline nativo foi removido; o anel é o indicador autoral, distinto de controles disabled. A presença visual de um anel não comprova contraste AA.

**Impacto:** Usuários com baixa visão têm dificuldade para localizar o foco em campos e ações claras.

**Critério:** 1.4.11 Contraste não textual (AA); 2.4.7 exige foco visível, não é usado isoladamente para a razão de contraste..

**Screenshots:** [storefront--login--mobile--focus.png](evidencias/fase-4/storefront--login--mobile--focus.png), [storefront--login--desktop--focus.png](evidencias/fase-4/storefront--login--desktop--focus.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- focus-visible:ring-[#D2BB8A]
+ focus-visible:ring-[#5D082A]
- focus-visible:ring-[#5D082A]/30
+ focus-visible:ring-[#5D082A]
// Preservar offset e medir variantes em superfícies claras/escuras.
```

**Aceite:** Indicador de foco contrasta >=3:1 com cores adjacentes em todas as variantes; foco perceptível por teclado sem depender de hover.

**Reprodução:** Abrir login, focar identificador com Tab e extrair boxShadow; comparar #D2BB8A com #FFFFFF usando luminância sRGB.

**Comando sugerido:** `/impeccable colorize`.


### A4-09 — Controles frequentes no mobile ficam abaixo do alvo de toque de 44 px

**P2 / Medium · [JON-168](https://linear.app/eojonathan/issue/JON-168) · ui/ux**

**Local:** Storefront /mercado, /adega, /login; admin /login. default e filtros; mobile 390x844, confirmação tablet/desktop. Fonte: `sistema/frontend/src/components/ui/button.tsx:16; sistema/frontend/src/pages/Search.tsx:572; sistema/frontend/src/pages/WinePage.tsx:154; sistema/admin/src/components/ui/button.tsx`.

**Evidência:** Voltar no Mercado 36x36; carrinho 38x38; chips de consulta com altura 28; filtros 36; retorno Adega 24x24; input e CTA do admin 40px de altura. Excluídos controles de vinho com pseudo-elemento before:h-11 before:w-11: bounding box sozinho subestima sua área clicável.

**Impacto:** Aumenta erro de toque nos controles repetidos de compra e operação móvel.

**Critério:** Critério adicional desta auditoria: >=44x44. WCAG 2.1 2.5.5 é AAA, portanto não classificado como violação AA por tamanho isolado..

**Screenshots:** [storefront--mercado--mobile--filtros.png](evidencias/fase-4/storefront--mercado--mobile--filtros.png), [storefront--adega--mobile--default.png](evidencias/fase-4/storefront--adega--mobile--default.png), [admin--login--mobile--default.png](evidencias/fase-4/admin--login--mobile--default.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- icon: 'h-9 w-9'
+ icon: 'h-11 w-11'
+ // Expandir área clicável dos chips e links sem colidir alvos vizinhos.
+ // Inputs/ações mobile com min-height:44px.
```

**Aceite:** Alvos relevantes >=44x44 CSS px, incluindo área efetiva/pseudo-elementos; sem sobreposição entre hit areas e sem overflow a 320px.

**Reprodução:** Abrir as rotas e medir getBoundingClientRect; conferir pseudo-elementos e elemento real atingido antes de considerar um alvo reprovado.

**Comando sugerido:** `/impeccable adapt`.


### A4-10 — Animacao de entrada da Adega ignora prefers-reduced-motion

**P2 / Medium · [JON-169](https://linear.app/eojonathan/issue/JON-169) · accessibility**

**Local:** Storefront /adega (aliases /vinhos e /adega-antenor usam mesmo componente). prefers-reduced-motion=reduce; três viewports. Fonte: `sistema/frontend/src/index.css:92; sistema/frontend/src/pages/WinePage.tsx:202 e :351`.

**Evidência:** Com matchMedia(reduce)=true, .fade-in-section mantém animationName=fadeIn e duration=0.6s. A regra reduce existente só cobre confetti-piece/toast-in-anim. O CSS começa em opacity:0/translateY(20px). É diferente de JON-108, que trata mudança dinâmica da preferência no timer useAutoScroll.

**Impacto:** Preferência de redução é ignorada pela entrada decorativa; pode provocar desconforto vestibular e depende da animação para tornar conteúdo visível.

**Critério:** Requisito impeccable/PRODUCT de movimento reduzido; não se alega violação AA de 2.2.2 por uma animação de apenas 0,6s. 2.3.3 é AAA e não equivale a este teste de carregamento..

**Screenshots:** [storefront--adega--mobile--movimento-reduzido.png](evidencias/fase-4/storefront--adega--mobile--movimento-reduzido.png), [storefront--adega--desktop--movimento-reduzido.png](evidencias/fase-4/storefront--adega--desktop--movimento-reduzido.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
+ @media (prefers-reduced-motion: reduce) {
+   .fade-in-section { animation:none; opacity:1; transform:none; }
+ }
// Preferir conteúdo visível por padrão.
```

**Aceite:** Em reduce não existe translação/entrada decorativa; conteúdo já está visível; normal preserva comportamento aprovado; mudança dinâmica é coberta separadamente por JON-108.

**Reprodução:** DevTools Rendering > Emulate CSS prefers-reduced-motion: reduce; abrir Adega e ler computed animation da primeira .fade-in-section; verificacao-dirigida.json registra matchMedia e estilo.

**Comando sugerido:** `/impeccable animate`.


### A4-11 — Cadastro renderiza logo branco sobre painel branco e cria vazio no cabecalho

**P2 / Medium · [JON-170](https://linear.app/eojonathan/issue/JON-170) · ui/ux**

**Local:** Storefront /register. default e texto ampliado; três viewports. Fonte: `sistema/frontend/src/pages/Register.tsx:14 e :124`.

**Evidência:** HORIZONTAL_LOGO_SRC aponta logo-horizontal-branco.png; imagem completa, naturalWidth=1080, exibida a 292x56 no mobile sobre painel branco. O login usa logo-horizontal-bordo.png e fica legível. Não se trata de falha de carregamento.

**Impacto:** Marca desaparece e o topo parece conter asset faltante; desperdiça espaço antes do formulário e quebra continuidade com login.

**Critério:** Consistência visual/PRODUCT/DESIGN; logotipos têm exceção em 1.4.3, logo não é falha AA de contraste de texto..

**Screenshots:** [storefront--cadastro--mobile--default.png](evidencias/fase-4/storefront--cadastro--mobile--default.png), [storefront--cadastro--desktop--default.png](evidencias/fase-4/storefront--cadastro--desktop--default.png), [storefront--login--mobile--focus.png](evidencias/fase-4/storefront--login--mobile--focus.png). Medições em JSON homônimo; sequências de teclado nos manifestos complementares.

**Correção sugerida, não aplicada:**

```diff
- const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-branco.png'
+ const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'
```

**Aceite:** Logo visível no painel branco em mobile/tablet/desktop, proporção preservada e sem vazio artificial; alinhamento coerente com login.

**Reprodução:** Abrir cadastro e comparar cabeçalho com login; conferir naturalWidth/complete e src no JSON homônimo.

**Comando sugerido:** `/impeccable polish`.

## Padrões sistêmicos e comparação com o design

A dívida prioritária está nos componentes compartilhados: Input/PasswordInput/Button propagam baixo contraste, indicador de foco fraco e alvos pequenos. Há componentes com nomes e labels corretos convivendo com páginas que recriam controles sem o mesmo contrato. O modal está desenhado como modal e anunciado como modal, mas sua lógica continua a de um painel visual; essa diferença explica o foco no fundo.

Alinhamento e espaçamento do catálogo desktop são consistentes: cards em grade, contornos claros, fotografia em área quadrada e preços pesados. Na captura de 1440px, a grade ocupa a faixa central com cinco colunas; no mobile, duas colunas preservam a compra por foto/preço. A Home mobile reserva 16px nas laterais e organiza vitrines sob navegação familiar. Não foi encontrado desalinhamento documental suficiente para gerar um ticket separado.

A marca usa bordo `#5D082A` com contraste aproximado **13,69:1 sobre branco**, um bom primário. A fragilidade vem de diluir tons de texto/foco, não da cor principal. O uso de cinza em feedback/empty state contraria o No-Gray Rule e, nos exemplos de A4-02, também prejudica a leitura de forma mensurável.

A tipografia da vitrine carregou Source Sans 3. A rampa rem existe no Tailwind, mas páginas ainda usam classes literais e tracking mais largo em pequenas legendas; as variações não foram contadas individualmente como falhas sem resultado medido. A Adega pode ser expressiva segundo PRODUCT.md; o fundo escuro não foi penalizado por divergir do fundo claro de Mercado. Ausência de alternador universal de dark mode não é requisito existente e não foi inventada como defeito.

O padding e as camadas do checkout mobile consomem altura, mas separam revisão e entrega com ações persistentes. Sem preencher endereço/sessão de checkout e sem aparelho físico, não se conclui cobertura sobre teclado virtual, rodapé colidindo com campos finais ou etapa de pagamento. O cadastro, em contraste, tem uma causa objetiva de vazio: imagem branca carregada sobre o painel branco.

## Positivos a preservar

- Catálogo público e carrinho funcionam sem exigir login antecipado; item adicionado localmente aparece na revisão inicial do checkout.
- Preço é o elemento tipográfico principal nos cards; fotos têm área reservada e botões de inclusão reconhecíveis.
- Home/Adega mantêm identidade própria e adequam expressão à superfície de desejo; Mercado prioriza a tarefa.
- Skeletons existem no catálogo. Erros de registro possuem texto e role=alert; corrigir associação sem perder esse feedback.
- Inputs de storefront e logins operacionais têm 16px; campos operacionais e muitos CTAs principais têm 48px.
- Login storefront/admin possui labels associados e autocomplete. PasswordInput já oferece nome dinâmico Mostrar/Ocultar; falta torná-lo operável por teclado.
- Modal de endereço já tem título associado, role=dialog e aria-modal; a correção pode preservar a composição.
- Ícones de categorias, navegação inferior e estados de carrinho ajudam reconhecimento. Muitos controles já têm aria-label explícito.
- Há suporte parcial a movimento reduzido e foco customizado; as falhas estão na abrangência/contraste, não na ausência completa de preocupação.
- PNGs originais, JSONs de medidas e recibos Linear permitem contestar/reproduzir as conclusões.

## Deduplicação e confirmação de escritas

Antes das criações, `orca linear list-issues --include-archived --workspace 15caa64f-ef89-40ed-bbb4-d30f347d3b40 --json` retornou **159 registros**, sem filtro de time, estado ou projeto, com `hasMore=false`, `partial=false` e `truncated=false`. Títulos e descrições foram pesquisados. Candidatos relevantes foram lidos:

- JON-108 trata o timer de auto-scroll quando a preferência muda com a página montada; A4-10 trata regra CSS que ignora reduce já ativo. São causas/correções diferentes, portanto o ticket antigo foi preservado e referenciado.
- JON-42 contém auditoria administrativa e outros defeitos específicos; não equivale às falhas públicas desta fase.
- JON-65 trata tamanho/responsabilidade de funções; JON-12 trata evolução de conta/histórico autenticados. Nenhum substitui os defeitos confirmados aqui.
- Os demais matches amplos de “visual”/“modal” nos tickets de segurança/B2B não eram equivalentes de UI.

**Contagens:** 11 criadas, 0 atualizadas, 0 reutilizadas como equivalentes, 11 readbacks concluídos. Nova listagem entre a primeira criação e as seguintes retornou 160, incluindo JON-160 já registrada, e impediu recriação. O primeiro readback por UUID foi rejeitado pela CLI (`linear_issue_required`); ele foi repetido pelo identificador **JON-160**, com sucesso, sem repetir a escrita.

O [registro de readback](evidencias/fase-4/linear-readback.json) preserva recibos de criação e leitura. Conferidos: corpo com ID A4, título, projeto `cbf36eac-35bc-4e05-937a-13b3aee7d61a`, estado Backlog, prioridades numéricas 2 (High) / 3 (Medium) e label Melhoria.

As labels exatas **ui/ux** e **accessibility** continuam inexistentes no catálogo consultado. Foi usado o fallback autorizado: **Melhoria**, prefixo de título e **primeira linha `Etiqueta obrigatoria pendente: <label>`**. A CLI não anexa screenshots binários: os tickets referenciam os caminhos repo-relativos dos PNGs, e isso está declarado no corpo. Não há alegação de upload de imagem ao Linear.

## Arquivos e checagens reproduzíveis

**Entrega final:** este relatório + **342 artefatos** em `evidencias/fase-4/`: **164 PNG, 173 JSON e 5 CJS**. Os 175 artefatos herdados foram mantidos; esta retomada criou **168 arquivos**, incluindo o relatório.

Relação exata dos novos arquivos:

1. `docs/auditoria-360/04-ui-ux-visual.md`.
2. Os **57 PNG e 57 JSON** nomeados literalmente em `capturas[].screenshot` / `capturas[].medicao` de [manifesto-complementar.json](evidencias/fase-4/manifesto-complementar.json).
3. Os **23 PNG e 23 JSON** nomeados literalmente nos mesmos campos de [verificacao-dirigida.json](evidencias/fase-4/verificacao-dirigida.json).
4. `evidencias/fase-4/auditoria-complementar.cjs`, `verificacao-dirigida.cjs`, `registrar-linear.cjs`, `manifesto-complementar.json`, `verificacao-dirigida.json`, `achados.json` e `linear-readback.json`, todos relativos à pasta deste relatório.

Os manifestos são a listagem nominal completa, sem globs ambíguos. Os scripts não fazem parte da aplicação. **registrar-linear.cjs executa escritas externas**; é trilha desta operação autorizada, não uma checagem de rotina para reexecutar. Os runners de browser podem sobrescrever suas próprias evidências caso repetidos; para nova auditoria preservar estes artefatos e escolher outra pasta.

| Checagem | Resultado |
|---|---|
| Skill context com --target sistema | PRODUCT/DESIGN resolvidos; fluxo audit e registro product aplicados. |
| git branch / rev-parse / status e docker ps | Snapshot e stack preexistente registrados; sem mudanças de fonte pela tarefa. |
| Leitura dos 4 manifestos | 81 + 3 + 57 + 23 = 164 capturas; 3 erros históricos de clique após Escape declarados; complementos sem erro de fluxo. |
| Navegação complementar real | Produto → adicionar local → carrinho → checkout inicial, filtros/busca, auth pública, modal e teclado. |
| Medições | DOM, labels/AX, contraste alpha, targets, overflow, rem 200%, reduce e sinais de layout-shift. |
| Estados controlados | GET atrasado/abortado; POST/PUT/PATCH/DELETE bloqueados no transporte do navegador. |
| Amostra visual | Inspeção direta de Home, Mercado, Adega, produto, carrinho, checkout, modal, cadastro, login e apps operacionais; não se alega revisão pixel a pixel de todos os 164 frames. |
| JSON/PNG e sintaxe dos runners | Validação final por parsing, assinaturas PNG/dimensões e node --check; aplicação não alterada e testes de negócio não reexecutados. |
| Linear | 11 criações/readbacks, campos finais conferidos; nenhuma duplicata intencional. |

Na raiz do repositório, leituras seguras:

```powershell
git rev-parse HEAD
git status --short
docker ps --format '{{.Names}} {{.Ports}}'
node --check docs/auditoria-360/evidencias/fase-4/auditoria-complementar.cjs
node --check docs/auditoria-360/evidencias/fase-4/verificacao-dirigida.cjs
orca linear issue JON-164 --full --workspace 15caa64f-ef89-40ed-bbb4-d30f347d3b40 --json
```

No DevTools de uma página de teste, sem submissão:

```javascript
const campo = document.querySelector('input');
getComputedStyle(campo, '::placeholder').color;
getComputedStyle(campo).boxShadow;
campo.getBoundingClientRect();
document.documentElement.scrollWidth > innerWidth;
matchMedia('(prefers-reduced-motion: reduce)').matches;
```

O algoritmo de medição completo está em [auditoria-browser.cjs](evidencias/fase-4/auditoria-browser.cjs). Capturas não contêm valores de credenciais; exemplos digitados são sintéticos. Identificadores de produtos públicos e placeholders demonstrativos não foram tratados como contas reais.

## Limitações e próximos passos

A **Fase 4 está consolidada com cobertura autenticada limitada**, não com navegação integral de todas as telas do sistema. Permanecem sem validação visual: 22 seções administrativas, conta/histórico/endereço de cliente autenticado, operação interna de picking/delivery, Notificador, detalhes reais de receitas/campanhas não disponíveis e etapas finais do checkout. A ausência de sessão/conta local de teste comprovada, somada ao limite de não mutar dados reais, impede ampliar esses fluxos neste recorte.

Não foram testados autenticação real, geolocalização de aparelho, envio de recuperação, pedido/pagamento, Safari/VoiceOver, NVDA, dark mode de sistema, zoom nativo e comportamento de teclado virtual. Inspeção estática complementa o inventário e **não substitui screenshot nem teste interativo**. A retomada não refez leitura semântica integral dos extensos inventários dos relatórios 01/02; o contexto relevante e seus achados/limites foram consultados, com prioridade aos artefatos preservados conforme orientação do coordenador.

Sequência recomendada, sem executar correções nesta fase:

1. **P1 — /impeccable harden:** corrigir modal, teclado, rótulos, links e associação dos erros (A4-03 a A4-07).
2. **P1 — /impeccable colorize:** acertar contraste de texto e foco com as medições desta fase (A4-01, A4-02, A4-08).
3. **P2 — /impeccable adapt / animate:** expandir alvos e respeitar reduce (A4-09, A4-10).
4. **/impeccable audit:** repetir o recorte após correção e acrescentar ambiente autenticado de teste autorizado.
5. **/impeccable polish:** conferir logo do cadastro, consistência e acabamento final (A4-11).

Esses comandos podem ser executados individualmente ou em outra ordem definida pelo responsável. Nenhuma Fase 5 foi iniciada.

