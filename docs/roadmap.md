# Roadmap

Regra que vale para tudo aqui: **nada entra sem ser testado em mobile e desktop.**
O cliente chega por WhatsApp e Facebook Ads — mobile é o caminho principal, não o
secundário. Sem barreira de entrada, sem passo confuso para quem nunca usou um app
de mercado.

O plano original era de lançamento, com prazo de ~1 mês (08/2026) para estar no ar
antes da temporada de fim de ano. **Esse plano foi concluído** — as quatro semanas
estão fechadas e ficaram abaixo, em [Histórico](#histórico--plano-de-lançamento-concluído),
porque o detalhe de cada correção segue valendo como memória do projeto.

Daqui em diante o documento é **lista viva**: o que está aberto fica no topo, e o
que fecha desce para o histórico com a data e o commit.

## Em aberto

- [ ] **Espaços patrocinados: vender banner para fornecedor.** Ideia do
      Jonathan em 28/08/2026. A base já existe: `sponsorName` renderiza o selo
      no banner, e **impressão e clique já são contados** (ligados em
      28/08/2026 — a coleta era a única parte irreversível, porque dado não
      coletado não se recupera depois). Há vigência por data e controle
      criativo (cor, alinhamento, CTA).
      Falta, e **só faz sentido depois de haver tráfego**:
      1. *Anunciante como entidade*, não texto livre. Hoje `sponsorName` é
         string solta e não agrega — não dá para responder "quanto a Ambev teve
         de impressão em agosto". Precisa de cadastro + vínculo banner→anunciante.
      2. *Relatório por campanha/período*, que é o que se entrega ao fornecedor.
      3. *Comercial*: preço do espaço, contrato, faturamento.
      Cuidado de modelagem já identificado: **anunciante não é uma página**.
      `pages` responde "onde aparece" e o caráter comercial é outro eixo — um
      anúncio pode estar na home, na categoria ou no produto, e um banner de
      categoria pode ser editorial ou patrocinado. Misturar os dois foi o que
      deixou o campo `pages` confuso e sem uso até 28/08/2026.
      Pré-requisito natural: **criar espaço de banner na página de produto**.
      Ela não renderiza banner nenhum hoje, e por isso a opção "Páginas de
      produto" saiu do formulário — é inventário novo para vender.

- [x] **`DeliveryArea` removido.** (28/08/2026) Decidido remover em vez de dar
      tela: zero linhas em produção desde sempre, enquanto a checagem morta
      rodava antes das zonas reais em toda requisição de frete e já tinha
      causado um bug (consulta no model errado, que compila e nunca acha nada).
      Saíram o model, as rotas `admin/fulfillment/areas`, `findMatchingArea` e
      o aviso somente-leitura na tela de zonas; `calculateLegacyZone` virou o
      próprio `calculate()`. Migration `20260828000000_drop_delivery_areas`.
      Sobrou documentada a armadilha da coluna `orders."deliveryAreaId"`, que
      apesar do nome guarda id de **zona** — ver [CLAUDE.md](../CLAUDE.md).

- [x] **Admin com framework de teste.** (28/08/2026) `vitest` instalado em
      `sistema/admin` (`npm run test:unit`), ambiente `node` — as regras
      cobertas são puras, jsdom seria peso morto. As regras do formulário de
      banner saíram de dentro do `StoreBannersManager.tsx` para
      `src/utils/bannerRules.ts` e ganharam teste; no caminho apareceu que a
      regra de `pages` estava **escrita duas vezes** (seletor de slot e aplicar
      modelo), agora unificada em `resolvePagesForSlot`.
      O teste de paridade do overlay **continua morando no storefront** de
      propósito: movê-lo para o admin só inverteria qual pacote faz o import
      cruzado, sem eliminar a assimetria.

- [x] **Monitor de produto sumido.** (28/08/2026) Rede de segurança para a
      classe de bug do "Limão kg": cruza o `syncOption` do banco com o do ERP e
      alerta por e-mail quando um produto marcado `SEMPRE` no Solidcom não está
      aparecendo na loja. Roda 03:30, de propósito **antes** do sync completo
      das 04:00 — é o sync completo que corrige o dado, então checar depois dele
      nunca acharia nada. Precisa de `MISSING_PRODUCTS_ALERT_EMAIL` no `.env`;
      sem isso o alerta fica só no log, onde ninguém olha.

## Histórico — plano de lançamento (concluído)

## Semana 1 — a jornada do cliente não pode falhar ✅

- [x] **Testar a jornada do cliente mobile ponta a ponta** — pedido completo
      fechado de verdade (#1FBCEB16), mobile e desktop. Achou e corrigiu:
      zonas de entrega/janelas vazias bloqueando checkout silenciosamente.
- [x] **Testar separação e finalização do pedido sem falhas** — fluxo
      completo com item em falta + substituição + recálculo de preço,
      confirmado até `DELIVERED`. Trilha de auditoria por ator (`PICKER`,
      `DRIVER`) já existe em `order_events`.

## Semana 2 — integração com o ERP

- [x] **Aumentar a frequência do sync do ERP + log de mudanças.** Sync
      incremental de hora em hora + reconciliação de promoções no sync diário.
      Corrigiu um bug real: promoção nunca era removida (`undefined` fazia o
      Prisma ignorar a coluna) — 13 das 31 promoções no ar eram fantasmas.
      Ver [solidcom-api.md](solidcom-api.md).
- [x] **Validar um pedido real na Solidcom via PDV** — pedido de teste
      `cdPedido=2023` (`cdEcomPedido=444447`, 17/08/2026) rastreado do
      storefront até o caixa: separado no app deles, puxado no PDV
      Concentrador, venda fechada e NFC-e real autorizada pela SEFAZ (nº
      201777, série 102, protocolo `233 2619564227 00`). Sinal real de
      "venda fechada" identificado: `EcommerceSolidconStatus` 5→6. Detalhe
      completo no vault: `pipeline/solidcom-dorsal-banco-direto.md`.

## Semana 3 — infraestrutura de produção

HTTPS deixou de ser só polimento: a correção de GPS (posição exata do
aparelho decidindo a zona por polígono, não o centroide do endereço) só
funciona em conexão segura — navegador nenhum entrega geolocalização em HTTP.
Sem isto no ar, todo cliente cai no CEP.

- [x] **Domínio e DNS** — `antenorefilhos.com.br` já existe (compartilhado com
      o sistema da outra loja no domínio raiz). Este sistema usa 5 subdomínios
      próprios: `mercado.`, `admin.`, `api.`, `separacao.`, `entrega.`.
- [x] **Hospedagem escolhida** — Hostinger VPS KVM 2 (2 vCPU/8GB/100GB NVMe),
      contrato curto (preço de renovação sobe bastante depois da promoção).
      Avaliadas Locaweb, KingHost e Magalu Cloud; nenhuma levou vantagem clara
      pro volume de 20 pedidos/dia.
- [x] **Repositório pronto pro deploy** — `docker-compose.prod.yml` (stack
      isolada da de desenvolvimento, sem porta de banco/cache/busca exposta),
      Caddy como proxy com HTTPS automático (Let's Encrypt, sem certbot pra
      manter), backup diário (Postgres + fotos) com envio opcional pra
      armazenamento externo, runbook completo em
      [docs/deploy.md](deploy.md).
- [x] **Achado de segurança corrigido antes de ir pro ar**: o
      `docker-compose.yml` de desenvolvimento publica Postgres (5432) e
      MeiliSearch (7700) direto no host — correto pra testar local, seria uma
      porta de banco de dados aberta na internet em produção. O compose de
      produção não publica nenhuma delas; só o proxy fala com a rede externa.
  Achado relacionado: sem `trust proxy` configurado, todo cliente apareceria
  vindo do mesmo IP assim que o Caddy entrasse — quebraria rate limit e
  qualquer verificação por IP em checkout/pedidos/CRM/LGPD. Corrigido em
  `main.ts` junto com o proxy.
- [x] **Deploy real** — no ar em `179.198.122.67` (Hostinger VPS KVM2), 5
      subdomínios com HTTPS automático via Caddy. Estado completo do que está
      rodando, DNS, segredos (só os nomes, nunca os valores) e os bugs achados
      só neste primeiro deploy real: [docs/infraestrutura.md](infraestrutura.md).
- [x] **Recuperação de senha do admin** — não existia mecanismo nenhum antes
      (só reset direto no banco via SSH). Fluxo por e-mail via Resend
      (`/auth/forgot-password` + `/auth/reset-password`, token com hash + 1h
      de validade). Domínio `antenorefilhos.com.br` sendo verificado no Resend
      (DKIM/SPF em subdomínio dedicado, não conflita com o e-mail real da
      empresa) — ver seção 7 de [docs/infraestrutura.md](infraestrutura.md).

## Semana 4 — fechamento

- [x] **Testar no PDV se o separador consegue puxar o pedido pelo código
      exibido.** Homologação física de ponta a ponta em 19/08/2026: pedido
      DAV 102028 aberto no Picking App, bipado e enviado ao caixa; no PDV
      físico da loja o DAV foi importado com sucesso, produtos e preços
      corretos, venda finalizada. Confirma o DAV como código suficiente —
      a alternativa via `numero`/`cdEcomPedido` (ver [CLAUDE.md](../CLAUDE.md))
      fica só como plano B, não é mais necessária.
- [x] **QA final e checklist de lançamento.** Concluído em 19/08/2026 junto
      com a homologação física de ponta a ponta (storefront → picking → PDV).

## Fila (não bloqueiam o lançamento)

- [x] **Auditoria de segurança multi-agente (23 achados ALTA/MEDIA/BAIXA).**
      Corrigida em 19/08/2026 em duas levas (`8a822d1` e `0e4ad34`). Destaques
      ALTA: promoção `FREE_SHIPPING` descontava o frete duas vezes (cobrando
      pedido a menos); race condition no limite de uso de cupom resolvida com
      `recordPromotionUsage` em transação `SERIALIZABLE`; `admin-categories` sem
      `@Roles('admin')` (qualquer cliente criava/edita/apagava categoria); IDOR
      no `crm.controller` (`upsertConsent`/`getLoyalty`/
      `createShoppingList`/`getReorderPayload`), `business.getCustomerContext`
      e `recommendations.getRebuy` sem checagem de posse; `inventory.
      releaseReservation` e edição de admin por admin abertos; scan de item
      pesável no picking agora decodifica GS1 prefixo-2 da etiqueta de balança
      e usa o peso real (não o pedido). MEDIA/BAIXA incluem resiliência do
      `recordPromotionUsage` (não derruba mais o pedido), mimetype validado
      antes de gravar no disco, transição de parada + observação obrigatória
      no Entregue validados no servidor, `startTask` bloqueando dupla separação,
      e vários ajustes de front (CPF mascarado, confirmações, 3 casas decimais
      no picking, dot de frete grátis, z-index). Sem efeito no fluxo real de
      checkout — todas rotas de self-service do cliente já passam pela sessão.
- [x] **Auditar rotas do admin sem `@Throttle` explícito.** Era pior do que a
      suspeita original: 31 dos 36 controllers tinham zero decorator, incluindo
      a integração com o ERP inteira (50 rotas). `RelaxedThrottle()` corrige
      todos; auditoria automatizada (reproduz a lógica real do guard) confirma
      zero rota esquecida sob o bucket de 20/min. Ver [CLAUDE.md](../CLAUDE.md).
- [x] **Trava de divergência de preço no checkout.** `confirmSession()` agora
      compara o `priceSnapshot()` mostrado ao cliente contra o total recalculado
      antes de confirmar; diferença acima de 1 centavo bloqueia com 400 e loga
      `PRICE_DIVERGED`. Testado ao vivo: subiu o preço de um produto no meio de
      uma sessão real — bloqueou, 0 pedidos criados; sem alteração, confirma
      normal. Ver [CLAUDE.md](../CLAUDE.md).
- [x] **Tela de Desempenho da Equipe.** Nova seção Operações > Desempenho:
      separadores (reusa endpoint existente), entregadores (novo endpoint
      agregando rotas/paradas por motorista) e substituições (novo endpoint
      lendo `order_events` e resolvendo o nome de quem trocou). Testado com
      dados reais e em mobile.
- [x] **Checkout rejeitava endereço já confirmado como entregável na Home.**
      `useAddressAutofill` disparava GPS automático toda vez que o checkout
      entrava na etapa de endereço, sobrescrevendo silenciosamente as
      coordenadas já verificadas no modal da Home por uma leitura nova (às
      vezes menos precisa, principalmente no desktop) — jogando o ponto pra
      fora do polígono da zona. Corrigido: GPS automático não dispara mais
      quando já existe uma verificação válida (dentro da área) salva. Ver
      `Checkout.tsx`.
- [x] **Configurar zonas de entrega e janelas de horário reais.**
      - **Zonas de entrega e localidades resolvidas em 20/08/2026**: sistema
        híbrido no backend com suporte a CEPs multi-localidade (ex: `25750-222`
        cobrindo centro e condomínios com taxas de balcão reais via
        `delivery-points.json` seed), seletor de condomínio/localidade em
        sub-modal dedicado no storefront e checkout, e fallback inteligente.
      - **Janelas de horário resolvidas em 18/08/2026**: o cliente escolhe o
        horário no checkout a partir das janelas de funcionamento do admin
        (que já embutem o fechamento antecipado), com 15 min de antecedência
        mínima e sem limite de capacidade — decisão de negócio, não usa a
        máquina de `FulfillmentSlot`. O horário vira `hrCombinada` no ERP.
- [x] **Retirada na loja no site.** O backend já suportava `PICKUP` inteiro
      (checkout, entrega e o `retiraNaLoja` do Solidcom); faltava a opção na
      tela do cliente. Na retirada pula endereço e validação de zona, frete
      zero, e o cliente é avisado no WhatsApp quando o pedido fica pronto.
- [x] **Integração de pedidos com a Solidcom consertada.** Nenhum pedido
      chegava no ERP desde 17/08 (os atingidos eram todos pedidos de teste da
      equipe, mas qualquer pedido real teria falhado igual). Causa: o
      `GravaPedido` deles faz `.Length` em `obs` e nos campos de
      `cliente.endereco` sem checar nulo, e não enviávamos nenhum dos dois.
      No mesmo arco: retry que reenviava payload já falho, número do pedido
      estourando o int32 do cancelamento, e CEP/telefone que nunca gravavam.
      Armadilhas documentadas em [CLAUDE.md](../CLAUDE.md).
- [x] **Notificador Windows reescrito como app Electron + apontado pra produção.**
      Era script Node solto (`node-notifier` + `systray2`), `.env` ainda
      configurado pro Docker local (`localhost:3005`, domínio inexistente
      `@antenor.com.br`) — nunca tinha acompanhado o deploy em produção.
      Agora: app Electron de verdade (tray + painel com lista de pedidos e
      andamento, ancorado no canto da tela ao clicar), autentica com conta
      `separador@antenorefilhos.com.br` (`role=picker`, menor privilégio) e
      aponta pra `https://api.antenorefilhos.com.br`. Testado ao vivo contra
      produção. Ver `Notificador/README.md`.
- [x] **Alerta escalonado no Notificador** (19/08/2026). Antes avisava uma
      vez só e pronto — pedido podia ficar parado sem ninguém perceber.
      Agora escala pela idade real do pedido (`createdAt`, não por quando o
      app viu): verde até 5 min, amarelo de 5 a 10, vermelho depois dos 10 —
      e o vermelho repete a cada 5 min até a separação começar. Som distinto
      por nível. O toast nativo do Windows foi abandonado (aparecia como
      "electron", preto, sem cor e engolindo avisos em sequência): trocado
      por uma janela própria no canto, com fila pra não se atropelarem.
      Lógica isolada em `Notificador/escalation.js` com testes (`npm test`).
- [x] **Integração da Base IBGE CNEFE (Censo 2022) para Geocodificação Local e Reconhecimento de Servidões/Condomínios.**
      Concluído em 20/08/2026 (commit `e417169`). Ingestão oficial dos 158.493 endereços e coordenadas
      porta a porta de Petrópolis (Censo Demográfico 2022) via `scripts/import-ibge-cnefe.ts`.
      Geocodificação reversa local instantânea (< 3ms) no PostgreSQL via `IbgeAddressService.findNearest`,
      rotas `/delivery/ibge/*` e integração inteligente no storefront (`reverseGeocode` com fallback).
      Deploy ativo e validado em produção na VPS Hostinger.

## Concluído antes deste plano

Auditoria visual e de acessibilidade das 4 telas (storefront, admin, picking,
delivery); migração shadcn/ui; decomposição de Home e Checkout; busca com
MeiliSearch e ranking de relevância; auditoria seção a seção do admin (18 telas);
controle de acesso por módulo e permissão granular; importação em massa das fotos
de produto (cobertura de catálogo de 13% para 27%); mapa de zonas de entrega com
raio/retângulo/polígono, busca de endereço e contexto das zonas já cadastradas;
tela de Desempenho da Equipe.

## Fila (não bloqueiam o lançamento) — concluídos

- [x] **Ferramenta de casamento automático de fotos por nome.** O import em
      massa original foi um script avulso; virou ferramenta reutilizável em
      `sistema/backend/scripts/match-photos.ts` (`npm run photos:match -- <pasta>`).
      Casa por EAN exato no nome do arquivo ou por similaridade de nome
      (Jaccard + razão de sequência, limiar 0.86 com margem de 0.05); roda em
      dry-run por padrão e só grava com `--apply`. Ambíguos caem em
      `photo_match_review.csv` em vez de aplicar errado. Testado com fotos
      reais (match por EAN, match fuzzy abaixo do limiar indo pra revisão,
      e gravação real via `--apply`).
