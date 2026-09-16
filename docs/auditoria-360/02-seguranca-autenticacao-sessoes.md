---
title: Auditoria 360 — segurança, autenticação e sessões
tags: [auditoria, seguranca, autenticacao, sessoes, owasp]
created: 2026-09-13
updated: 2026-09-13
status: consolidado-com-limitacoes
type: relatorio
---

# Fase 2 — Segurança, autenticação e sessões

## Resultado e prioridades

Foram confirmados **35 achados de código e configuração: 2 Urgent, 15 High, 17 Medium e 1 Low**. Foram criadas **26 issues** e reutilizadas **9 issues de defeitos equivalentes**; outras **25 issues existentes** receberam a classificação de segurança para os **27 itens de dependências herdados da Fase 1**. Portanto, são **60 tickets relacionados, 26 criados e 34 atualizados**, todos no projeto **Antenor e Filhos [NOVA REAL]**, estado **Backlog**, confirmados por leitura posterior. Não houve correção de aplicação.

As prioridades imediatas são a emissão de sessão de cliente existente no checkout convidado sem comprovar identidade (S01) e a aceitação de webhook de pagamento sem segredo obrigatório (S03). Também foram confirmados problemas de posse e isolamento, XSS na impressão administrativa, uploads e remoção de arquivos inseguros, falta de revogação de sessões, destinos de rede arbitrários e divulgação de dados por respostas e métricas. As condições de exploração estão individualizadas; **não se afirma exploração nem exposição efetiva em produção**.

A revisão estrutural cobre **398 operações HTTP em 38 arquivos declaradores**, além dos fluxos de sessão nos quatro apps, Notificador, service workers, integrações e configurações de execução. **29 verificações sintéticas passaram**, incluindo dois controles positivos. Essa cobertura não equivale a uma prova semântica integral de cada linha nem a um teste HTTP ponta a ponta de todos os endpoints.

**Etiqueta obrigatória pendente: security.** O catálogo JON foi reconferido e contém Correção, Melhoria, Bug e Recurso. Conforme autorização da tarefa, todos os tickets tratados usam **Melhoria**, prefixo **[security]** e a pendência explícita no corpo. A criação da label depende de recurso administrativo indisponível na CLI utilizada.

## Escopo, método e limites

Foram lidos integralmente AGENTS.md, CLAUDE.md e o relatório da [Fase 1](01-analise-estatica-arquitetura.md). A base solicitada continha 70 itens; durante esta execução a Fase 1 foi ampliada por trabalho concorrente para **86 itens em 84 issues**. Os 16 itens adicionais também foram considerados, inclusive JON-115 a JON-130, preservando a deduplicação.

A inspeção combinou inventário com rg, leitura dos artefatos de segurança, extração AST de todos os handlers HTTP, acompanhamento controller → guard → serviço → persistência/serialização, busca de sinks de execução/HTML/rede/arquivos e provas locais em memória. Foram comparados snapshots SHA-256 para detectar alterações concorrentes; a fotografia final monitorou **589 artefatos** sob os filtros de fonte/configuração descritos no apêndice. Esse número inclui arquivos auxiliares e testes; não representa 589 revisões semânticas integrais independentes.

O levantamento Linear percorreu todas as issues JON, **incluindo arquivadas**. A coleta prévia de 127 registros completos foi complementada por JON-128–130 antes das criações. Na validação final foram lidas **156 issues em 7 páginas**, com hasMore=false e partial=false. Termos, candidatos e decisão de equivalência constam por achado; coincidência de tema ou um relatório geral de auditoria não foi aceita como equivalência de defeito.

Não foram acessados VPS, produção, banco real, serviços ERP, gateways ou provedores push. Não foram instaladas dependências, executados deploys, builds com efeitos persistentes, migrations ou seeds, nem criados commits. As únicas requisições externas desta tarefa foram operações autorizadas do Linear/Orca e consulta de documentação pública oficial. A única escrita de arquivo da tarefa é este relatório; as propostas abaixo não foram aplicadas.

### Limites da evidência

- Os testes carregam trechos reais com imports removidos e dependências substituídas; guardas declarados são conferidos estaticamente. Não substituem inicialização Nest completa, validação real de assinatura JWT, constraints PostgreSQL, navegação real ou testes de aceitação da futura correção.
- O XSS foi demonstrado pela expressão original de HTML preservando marcador inerte no ensaio; não houve execução de script em navegador nem leitura de credenciais. SSRF foi demonstrado até a construção/entrega ao transporte simulado; nenhum endereço interno foi contatado.
- Os arquivos .env efetivos não foram lidos. Defaults versionados foram avaliados sem transcrever valores; a chave privada local foi usada apenas em memória para comparar a chave pública com o certificado, sem exportar ou imprimir a parte privada.
- Histórico Git completo, backups, uploads reais, imagens de contêiner publicadas, SBOM e estado de secrets/ACL da infraestrutura não foram auditados. A varredura de segredos no conteúdo textual rastreado tem limites de formato/tamanho e não comprova ausência de outros segredos.
- Os avisos de dependências são a fotografia de advisories registrada na Fase 1, com versões dos sete lockfiles reconferidas nesta fase. Não houve nova consulta ao registry, instalação, audit fix ou prova de alcance de cada advisory em runtime.
- Não houve ensaio de carga/brute force distribuído, CSRF em navegador, DNS rebinding, redirecionamento em browser, clickjacking real ou teste de intrusão. Onde a análise foi parcial, o resultado é “não confirmado no recorte”, nunca “ausente no sistema”.
- API, consistência geral de banco, performance e UI visual permanecem nas fases seguintes; aqui só foram incluídas suas consequências de segurança.

## Superfícies e fronteiras de confiança

| Origem → destino | Credencial/contexto e fronteira | Evidência e resultado |
|---|---|---|
| Visitante → storefront → API | Catálogo público; checkout convidado/carrinho/sessão não devem adquirir identidade por declaração | S01, S02, S22, S23, S26, S27; guards e DTOs variam por operação |
| Cliente → API privada | JWT Bearer, identidade customer atual, propriedade de endereço/pedido | Bloqueio atual funciona; S09, S10, S13, S14 e S35 comprometem ciclo de vida/contexto |
| Admin/staff → API administrativa | JWT + role, moduleAccess e permissions; cada mecanismo precisa ser aplicado à rota | S13, S24; permissões atuais do banco são positivas, porém não há cobertura uniforme |
| Picker/driver → tarefas/rotas | Identidade da equipe, módulo, tenant/store e responsável do recurso | S29 e S30: autenticação e loja não comprovam posse |
| Cliente → pedido armazenado → janela de impressão admin | Texto não confiável atravessa persistência e vira HTML na origem administrativa | S07; JWT acessível por JavaScript no localStorage aumenta impacto |
| Admin/CMS → filesystem → origem web | MIME/extensão, webroot e caminho de limpeza | S06, S08 e S32; exclusão e upload foram simulados |
| Provedor → webhooks de pagamento/marketplace/ERP | HMAC/segredo, bytes do corpo, canal ativo, vínculo da cobrança e transição | S03–S05, S33; guard AntenorApi exige segredo e compara assinatura |
| API client → API pública autenticada por chave | Chave com escopos e tenant/store; criação administrativa deve limitar emissor | S13 e S28; consultas da API filtram contexto da chave, mas emissor pode escolher contexto indevido |
| API → push/HTTP de saída | URL, DNS/IP, redirects, destinatário e vínculo com sessão | S11, S12 e S19 |
| Internet/LAN → Caddy/nginx → Nest → banco/busca | TLS, headers, confiança em proxies, bind de portas e segredo por ambiente | S15–S17, S20, S21; configuração prod dedicada é mais restrita |
| API → observabilidade | URL/erro cru atravessa logs e métricas públicas | S18, S31 |
| Notificador renderer → preload → main → SQL/API | CSP e contextIsolation, IPC restrito, credenciais fora do renderer, TLS da conexão | Proteções Electron existentes; S25 no transporte SQL |
| Outro tenant/loja → recurso compartilhado | tenantId/storeId devem derivar de vínculo atual, nunca apenas de body/query/token antigo | S13, S14 e S34 |
| Git/workflows → imagem/execução | Dependências, secrets, permissões do job e ambiente CI | Dependências herdadas; defaults CI não foram confundidos com credenciais de produção |

### Autenticação e ciclo de sessão

| Perfil/fluxo | Criação/validação/armazenamento observado | Expiração e encerramento | Avaliação |
|---|---|---|---|
| Cliente com senha | Login aceita identificadores suportados; bcrypt; JWT Bearer; localStorage do storefront | 30 dias; estratégia consulta blocked atual | Duração longa é requisito operacional, não falha isolada; S09 e S14 tratam invalidação/contexto |
| Cliente convidado | guestCheckout reutiliza cliente encontrado por OR de identificadores e emite mesma sessão completa | 30 dias | S01 Urgent |
| Admin | JWT; senha bcrypt; role atual consultada no banco; localStorage do admin | Configuração de 24 horas; logout local | S07 amplia risco de roubo; S09 revogação incompleta |
| Staff/picker/driver | Conta admin/staff com role/moduleAccess; apps usam token em localStorage; módulos consultados pela estratégia | 30 dias; active atual é validado | S24, S29 e S30; retirar módulo deve bloquear todas as rotas relacionadas |
| Reset de senha | Valor aleatório de 32 bytes; hash SHA-256 armazenado; expiração de 1 hora; resposta genérica ao solicitar recuperação | Limpa hash após atualização | S10 consumo não atômico; S09 sessões anteriores persistem |
| Alteração de senha do cliente | Exige senha atual quando há hash cadastrado | Sem versão/jti de sessão ou data de corte | S09; interação com anonimização em S35 |
| Anonimização | Remove dados/password, mas conserva estados relevantes à autenticação | JWT/reset/push não são encerrados integralmente | S35, reutilizado da Fase 1 |
| Logout/push | Remove dados locais de autenticação; subscription pode permanecer | Notificações continuam associadas à identidade anterior | S19 distingue sair explicitamente de manter app fechado durante sessão válida |
| API client | Chave e escopos verificados pelo guard; contexto deriva do cliente cadastrado | Ciclo próprio de chaves; sem cookie | S13 na emissão; S28 na projeção de respostas |
| Notificador | Token fica no processo principal; renderer usa ponte limitada | Reautenticação de integração conforme código | Não se constatou token persistido no localStorage do renderer |

Não foi identificado mecanismo de sessão por cookie na aplicação auditada: os apps enviam Authorization Bearer explicitamente. Por isso, não foi confirmado CSRF clássico por credencial automaticamente anexada; endpoints públicos mutáveis continuam vulneráveis por seus defeitos próprios. CORS de produção exige lista explícita de origens e credentials=true, sem fallback curinga. Migração para cookies exigiria análise CSRF e atributos HttpOnly/Secure/SameSite; não foi proposta como correção automática.

RolesGuard, ModuleAccessGuard, PermissionGuard, TenantAccessGuard, JwtAuthGuard e PublicApiKeyGuard foram inspecionados separadamente. TenantAccessGuard exige contexto, sem verificar membership. PermissionGuard consulta permissões no banco; o atalho para permissions no payload merece cuidado em eventual evolução, porém o fluxo de emissão atual não o usa: **não foi aberto achado especulativo por essa hipótese**. Header de tenant não sobrescreve tenant presente no JWT moderno.

## Matriz OWASP e verificações transversais

A classificação usa explicitamente [OWASP Top 10 2021](https://owasp.org/Top10/2021/) para permitir comparação, sem alegar ser a edição mais recente. Recomendações de controle de acesso foram conferidas com o [guia de autorização OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

| Categoria | Verificação e resultado neste recorte | Achados relacionados |
|---|---|---|
| A01 — Controle de acesso quebrado | Guards, posse, contexto tenant/store, rotas públicas, publicação de receitas e projeção de dados | S01, S02, S13, S14, S24, S27–S30, S34 |
| A02 — Falhas criptográficas | Chave TLS local rastreada, defaults, TLS SQL; bcrypt, reset aleatório e HMAC configurado são positivos | S15, S20, S25 |
| A03 — Injeção | XSS armazenado no template de impressão; HTML via upload; traversal na limpeza; SQL parametrizado observado | S06–S08; não confirmado SQL/comando/NoSQL no recorte examinado |
| A04 — Design inseguro | Identidade declarada em checkout, reserva pública sem vínculo/teto, frete desacoplado do destino e eventos forjáveis | S01, S02, S22, S23, S26 |
| A05 — Configuração insegura | Portas, segredo opcional, headers, health detalhado e logs; configuração efetiva externa não consultada | S03, S05, S15–S18, S21, S31 |
| A06 — Componentes vulneráveis/desatualizados | Sete lockfiles, 94 resoluções dos 27 pacotes; reaproveitados 25 tickets da Fase 1 | D01–D27; alcance depende do advisory e uso |
| A07 — Identificação/autenticação | Login/reset/JWT/blocked/active, revogação, contexto antigo e push após logout | S01, S09, S10, S14, S19, S35 |
| A08 — Integridade de software/dados | Assinatura obrigatória, vínculo cobrança/pedido, estado/canal, origem da conversão, workflows | S03–S05, S26, S33 |
| A09 — Logging/monitoramento | Métricas públicas com URL pessoal e erro cru; não houve leitura de logs reais | S18, S31 |
| A10 — SSRF | Destinos de push e webhooks de saída, redirects, DNS/IP; chamada geográfica de host fixo inspecionada | S11, S12 |

| Vetor solicitado | Cobertura e conclusão delimitada |
|---|---|
| SQL/NoSQL injection | Buscas globais por queryRaw/executeRaw e leitura dos pontos de SQL: tagged templates Prisma parametrizados; não observados queryRawUnsafe/executeRawUnsafe/Prisma.raw nos fontes ativos examinados. SQL do Notificador usa parâmetros; não há backend Mongo identificado. Não equivale a prova formal de toda construção futura. |
| Comando/template/path | Spawn de áudio do Notificador usa comando/caminho fixos; não foi identificado parâmetro HTTP chegando a shell. Sink de caminho confirmado em S06. Templates de impressão confirmam S07; geração de texto por IA não demonstrou execução de comando. |
| XSS armazenado/refletido/DOM | React escapa texto por padrão; foram pesquisados dangerouslySetInnerHTML, innerHTML, document.write, URLs e service workers. Notificador possui escapeHtml baseado em textContent; impressão admin concatena HTML. Não foi confirmado outro XSS refletido/DOM fora de S07/S08. |
| CSRF/CORS | Bearer explícito nos apps, sem cookie de sessão identificado. Allowlist de produção exige configuração; origins efetivas não consultadas. Endpoints públicos mutáveis não recebem proteção por CORS contra clientes diretos. |
| SSRF/redirects | URLs persistidas de webhook/push não limitam destinos (S11/S12). ViaCEP tem host fixo e CEP normalizado. Helper destinoSeguro restringe destinos internos; caso com barra invertida não foi reproduzido em navegador e não foi promovido a vulnerabilidade confirmada. |
| Upload/traversal | MIME declarado e extensão preservada; staging público; limites Multer/pipe divergentes; limpeza fora da raiz (S06/S08/S32). Sharp limita pixels e reencoda no fluxo de produto. |
| Mass assignment/DTO | ValidationPipe global usa whitelist/forbidNonWhitelisted/transform. Ao menos 66 operações têm Body any ou objeto literal no inventário AST; interfaces também perdem metadados. Address aceita campos internos e tenant (S13); analytics/marketplace usam seletores não vinculados. |
| Enumeração/brute force | Login/recuperação, guest e respostas públicas examinados. Recuperação usa resposta genérica e tokens aleatórios; guest permite abuso de identificador (S01). Não houve enumeração de contas reais nem medição de timing. |
| Rate limiting | ThrottlerGuard global; buckets default 600/min, auth 20/min, checkout 30/min, webhook 120/min; handlers de login/reset reduzem limites. SkipThrottle é aplicado por nome: Integrations não remove bucket webhook. Sem teste distribuído/carga; limites não corrigem identidade/posse. |
| Headers e clickjacking | Helmet API presente, CSP desativada; nginx admin tem proteção de framing. Picking/delivery e herança da location de index do storefront têm lacunas (S21), inferidas da configuração. |
| Logging/erros/serialização | Interceptor, registry, health, retorno Prisma e relações customer examinados; S18, S28, S31. Mascarar somente GET /customers não sanitiza outras relações. |
| WebSockets/push | Não encontrados gateways Nest/SubscribeMessage/new WebSocket/socket.io-client ativos nos fontes pesquisados. Dependências ws/socket.io-parser não comprovam exposição WebSocket. Fluxos Web Push, inscrição, envio, remoção e service workers foram inspecionados (S11/S19). |
| Docker/nginx/workflows | Manifests principal/staging/prod, Caddy, nginx de quatro apps, Dockerfile e dois workflows ativos examinados. CI usa serviços de teste; não foram executados jobs ou comandos desses manifests. Defaults/bind e dependências da imagem precisam atenção; não se presume segredo real nos valores de fixture do CI. |

As correções de upload devem combinar validação de conteúdo, nome gerado e publicação controlada, conforme o [guia OWASP de upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Para SSRF, a proposta exige validar destino resolvido e cada redirecionamento, além da política de egress, conforme o [guia OWASP de SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). A conclusão sobre nginx considera a regra de [herança de add_header](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header): no comportamento padrão, a location com seus próprios headers deixa de herdar os headers do nível anterior.

## Achados confirmados por severidade

Todos os tickets desta tabela estão em **Backlog**, projeto **Antenor e Filhos [NOVA REAL]**, label **Melhoria**, com **security pendente**. Urgent indica correção prioritária de caminho capaz de comprometer identidade/pagamento sob a condição descrita; não informa ocorrência de incidente real.

| ID | Prioridade | Defeito | Linear | Ação |
|---|---|---|---|---|
| S01 | Urgent | Checkout convidado emite sessao de conta existente sem comprovar identidade | [JON-131](https://linear.app/eojonathan/issue/JON-131/security-checkout-convidado-emite-sessao-de-conta-existente-sem) | Criada |
| S03 | Urgent | Webhook de pagamento aceita assinatura arbitraria quando falta segredo | [JON-133](https://linear.app/eojonathan/issue/JON-133/security-webhook-de-pagamento-aceita-assinatura-arbitraria-quando) | Criada |
| S02 | High | Carrinho e checkout publicos aceitam titular e recursos sem prova de posse | [JON-132](https://linear.app/eojonathan/issue/JON-132/security-carrinho-e-checkout-publicos-aceitam-titular-e-recursos-sem) | Criada |
| S04 | High | Webhook de pagamento nao vincula cobranca valor e transicao ao pedido | [JON-134](https://linear.app/eojonathan/issue/JON-134/security-webhook-de-pagamento-nao-vincula-cobranca-valor-e-transicao) | Criada |
| S05 | High | Marketplace aceita webhook de pedido sem segredo configurado | [JON-115](https://linear.app/eojonathan/issue/JON-115/security-marketplace-aceita-webhook-de-pedido-sem-segredo-configurado) | Reutilizada/atualizada |
| S06 | High | Limpeza de imagens permite excluir arquivo fora da pasta uploads | [JON-135](https://linear.app/eojonathan/issue/JON-135/security-limpeza-de-imagens-permite-excluir-arquivo-fora-da-pasta) | Criada |
| S07 | High | Impressao de pedidos executa HTML armazenado de clientes no admin | [JON-136](https://linear.app/eojonathan/issue/JON-136/security-impressao-de-pedidos-executa-html-armazenado-de-clientes-no) | Criada |
| S08 | High | Upload generico aceita HTML disfarçado de imagem e publica na mesma origem | [JON-137](https://linear.app/eojonathan/issue/JON-137/security-upload-generico-aceita-html-disfarcado-de-imagem-e-publica-na) | Criada |
| S09 | High | Troca de senha e logout nao revogam JWTs ja emitidos | [JON-138](https://linear.app/eojonathan/issue/JON-138/security-troca-de-senha-e-logout-nao-revogam-jwts-ja-emitidos) | Criada |
| S11 | High | Inscricao de Web Push permite destinos de rede arbitrarios | [JON-140](https://linear.app/eojonathan/issue/JON-140/security-inscricao-de-web-push-permite-destinos-de-rede-arbitrarios) | Criada |
| S13 | High | Endpoints legados e API clients atravessam limites de tenant e loja | [JON-142](https://linear.app/eojonathan/issue/JON-142/security-endpoints-legados-e-api-clients-atravessam-limites-de-tenant) | Criada |
| S15 | High | Compose aceita segredos padrao versionados inclusive para JWT de producao | [JON-144](https://linear.app/eojonathan/issue/JON-144/security-compose-aceita-segredos-padrao-versionados-inclusive-para-jwt) | Criada |
| S18 | High | Metricas publicas e logs propagam URLs com dados pessoais e erros crus | [JON-147](https://linear.app/eojonathan/issue/JON-147/security-metricas-publicas-e-logs-propagam-urls-com-dados-pessoais-e) | Criada |
| S28 | High | Respostas operacionais continuam incluindo hashes de autenticacao de clientes | [JON-71](https://linear.app/eojonathan/issue/JON-71/security-respostas-operacionais-continuam-incluindo-hashes-de) | Reutilizada/atualizada |
| S29 | High | Motorista pode alterar rota de outro motorista da mesma loja | [JON-72](https://linear.app/eojonathan/issue/JON-72/security-motorista-pode-alterar-rota-de-outro-motorista-da-mesma-loja) | Reutilizada/atualizada |
| S34 | High | Gestao de marketplace permite selecionar tenant e canal alheios | [JON-116](https://linear.app/eojonathan/issue/JON-116/security-gestao-de-marketplace-permite-selecionar-tenant-e-canal) | Reutilizada/atualizada |
| S35 | High | Anonimizacao preserva reset e permite reativar acesso pela sessao antiga | [JON-119](https://linear.app/eojonathan/issue/JON-119/security-anonimizacao-preserva-reset-e-permite-reativar-acesso-pela) | Reutilizada/atualizada |
| S10 | Medium | Token de reset pode ser consumido duas vezes em concorrencia | [JON-139](https://linear.app/eojonathan/issue/JON-139/security-token-de-reset-pode-ser-consumido-duas-vezes-em-concorrencia) | Criada |
| S12 | Medium | Webhooks de saida fazem requisicoes a URLs internas sem validacao | [JON-141](https://linear.app/eojonathan/issue/JON-141/security-webhooks-de-saida-fazem-requisicoes-a-urls-internas-sem) | Criada |
| S14 | Medium | JWT mantem tenant antigo e fixa loja padrao sem revalidar vinculo | [JON-143](https://linear.app/eojonathan/issue/JON-143/security-jwt-mantem-tenant-antigo-e-fixa-loja-padrao-sem-revalidar) | Criada |
| S16 | Medium | Compose principal e staging publicam banco busca e API em todas as interfaces | [JON-145](https://linear.app/eojonathan/issue/JON-145/security-compose-principal-e-staging-publicam-banco-busca-e-api-em) | Criada |
| S17 | Medium | Checkout confia no primeiro X-Forwarded-For para antifraude | [JON-146](https://linear.app/eojonathan/issue/JON-146/security-checkout-confia-no-primeiro-x-forwarded-for-para-antifraude) | Criada |
| S19 | Medium | Logout deixa inscricao push vinculada ao usuario anterior no aparelho | [JON-148](https://linear.app/eojonathan/issue/JON-148/security-logout-deixa-inscricao-push-vinculada-ao-usuario-anterior-no) | Criada |
| S20 | Medium | Chave privada TLS do ambiente local esta versionada | [JON-149](https://linear.app/eojonathan/issue/JON-149/security-chave-privada-tls-do-ambiente-local-esta-versionada) | Criada |
| S21 | Medium | Apps de operacao e shell do storefront ficam sem protecao de enquadramento | [JON-150](https://linear.app/eojonathan/issue/JON-150/security-apps-de-operacao-e-shell-do-storefront-ficam-sem-protecao-de) | Criada |
| S22 | Medium | Reserva de estoque publica permite TTL sem limite e sem carrinho | [JON-151](https://linear.app/eojonathan/issue/JON-151/security-reserva-de-estoque-publica-permite-ttl-sem-limite-e-sem) | Criada |
| S23 | Medium | Cotacao usa CEP e coordenadas diferentes do endereco de entrega | [JON-152](https://linear.app/eojonathan/issue/JON-152/security-cotacao-usa-cep-e-coordenadas-diferentes-do-endereco-de) | Criada |
| S24 | Medium | Rotas fiscais de picker ignoram revogacao do modulo de separacao | [JON-153](https://linear.app/eojonathan/issue/JON-153/security-rotas-fiscais-de-picker-ignoram-revogacao-do-modulo-de) | Criada |
| S25 | Medium | Conexao SQL do Notificador desliga criptografia e validacao de certificado | [JON-154](https://linear.app/eojonathan/issue/JON-154/security-conexao-sql-do-notificador-desliga-criptografia-e-validacao) | Criada |
| S26 | Medium | Eventos publicos de analytics e recomendacao aceitam identidade e compra forjadas | [JON-155](https://linear.app/eojonathan/issue/JON-155/security-eventos-publicos-de-analytics-e-recomendacao-aceitam) | Criada |
| S30 | Medium | Exclusividade de tarefa de separacao pode ser contornada | [JON-73](https://linear.app/eojonathan/issue/JON-73/security-exclusividade-de-tarefa-de-separacao-pode-ser-contornada) | Reutilizada/atualizada |
| S31 | Medium | Health detalhado publico amplifica consultas de integracao e divulga diagnosticos | [JON-111](https://linear.app/eojonathan/issue/JON-111/security-health-detalhado-publico-amplifica-consultas-de-integracao-e) | Reutilizada/atualizada |
| S32 | Medium | Uploads rejeitados antes do handler deixam arquivos persistidos | [JON-113](https://linear.app/eojonathan/issue/JON-113/security-uploads-rejeitados-antes-do-handler-deixam-arquivos) | Reutilizada/atualizada |
| S33 | Medium | Marketplace recebe novos pedidos mesmo com canal desativado | [JON-117](https://linear.app/eojonathan/issue/JON-117/security-marketplace-recebe-novos-pedidos-mesmo-com-canal-desativado) | Reutilizada/atualizada |
| S27 | Low | API publica de receitas permite consultar conteudo desativado | [JON-156](https://linear.app/eojonathan/issue/JON-156/security-api-publica-de-receitas-permite-consultar-conteudo-desativado) | Criada |

### S01 — Checkout convidado emite sessao de conta existente sem comprovar identidade

**Prioridade:** Urgent · **OWASP:** A07 · **Linear:** [JON-131](https://linear.app/eojonathan/issue/JON-131/security-checkout-convidado-emite-sessao-de-conta-existente-sem) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/auth/auth.controller.ts:177](../../sistema/backend/src/modules/auth/auth.controller.ts#L177); [sistema/backend/src/modules/auth/auth.service.ts:433](../../sistema/backend/src/modules/auth/auth.service.ts#L433).

**Falha e impacto:** guestCheckout consulta OR de WhatsApp, CPF e e-mail e emite o JWT completo do cliente encontrado, inclusive quando já existe senha. A suíte sintética confirmou que somente o e-mail da vítima basta; os demais identificadores podem ser diferentes. O token permite as operações privadas da vítima.

**Condição de exploração:** ALLOW_GUEST_CHECKOUT habilitado (padrão), conta existente não bloqueada e conhecimento de um identificador. Não depende de descobrir senha nem de conhecer ID interno.

**Correção sugerida, não aplicada:**

```text
const guest = await createIsolatedGuestCart();
// Nunca reutilizar Customer autenticado somente por identificador.
if (existingCustomer) return requireVerifiedOwnership('OTP ou senha');
return issueCartScopedCapability(guest);
```

**Aceitação da futura correção:** Com conta fictícia protegida por senha, coincidência isolada de e-mail, telefone ou CPF não deve emitir JWT de customer nem expor cadastro; fluxo convidado novo continua funcionando e união de histórico exige prova de posse.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'async guestCheckout|findFirst|OR:|buildCustomerTokenResponse' sistema/backend/src/modules/auth/auth.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: guest, convidado, autentic, conta; 43 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:48:49.903Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S03 — Webhook de pagamento aceita assinatura arbitraria quando falta segredo

**Prioridade:** Urgent · **OWASP:** A07/A08 · **Linear:** [JON-133](https://linear.app/eojonathan/issue/JON-133/security-webhook-de-pagamento-aceita-assinatura-arbitraria-quando) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/integrations/webhook.guard.ts:10](../../sistema/backend/src/modules/integrations/webhook.guard.ts#L10); [sistema/backend/src/modules/integrations/payments-webhook.service.ts:139](../../sistema/backend/src/modules/integrations/payments-webhook.service.ts#L139); [sistema/backend/src/modules/integrations/integrations.controller.ts:755](../../sistema/backend/src/modules/integrations/integrations.controller.ts#L755); [sistema/backend/src/modules/integrations/integrations.service.ts:389](../../sistema/backend/src/modules/integrations/integrations.service.ts#L389).

**Falha e impacto:** verifySignature retorna true quando PAYMENTS_WEBHOOK_SECRET está ausente e os flags de gateway estão desligados. Esse estado não impede processEvent; o guard exige apenas header não vazio. Os três manifests Compose não repassam esse segredo/flags. Fixture marcou pedido como PAID sem prova de gateway.

**Condição de exploração:** API iniciada com segredo ausente e gatewayActive=false (padrão); conhecimento de orderId e evento mapeado. Estado/configuração de produção não foi consultado.

**Correção sugerida, não aplicada:**

```text
if (!gatewayEnabled || !webhookSecret) throw new UnauthorizedException();
verifyHmac(req.rawBody, signature, webhookSecret);
// Habilitar rawBody no bootstrap; configurar segredo fora do repo.
// Desabilitar integração também deve desabilitar ingestão.
```

**Aceitação da futura correção:** Flags desligados, segredo vazio e assinatura ausente/incorreta produzem 401/403 e zero escritas; assinatura válida dos bytes exatos funciona apenas com integração habilitada; testar todos os manifests.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'verifySignature|gatewayActive|return true|processPaymentWebhook' sistema/backend/src/modules/integrations/payments-webhook.service.ts sistema/backend/src/modules/integrations/webhook.guard.ts sistema/backend/src/modules/integrations/integrations.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: webhook, pagamento, assinatura, segredo; 25 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:49:33.097Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S02 — Carrinho e checkout publicos aceitam titular e recursos sem prova de posse

**Prioridade:** High · **OWASP:** A01 · **Linear:** [JON-132](https://linear.app/eojonathan/issue/JON-132/security-carrinho-e-checkout-publicos-aceitam-titular-e-recursos-sem) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/checkout/cart.controller.ts:12](../../sistema/backend/src/modules/checkout/cart.controller.ts#L12); [sistema/backend/src/modules/checkout/cart.service.ts:19](../../sistema/backend/src/modules/checkout/cart.service.ts#L19); [sistema/backend/src/modules/checkout/checkout.controller.ts:17](../../sistema/backend/src/modules/checkout/checkout.controller.ts#L17); [sistema/backend/src/modules/checkout/checkout.service.ts:69](../../sistema/backend/src/modules/checkout/checkout.service.ts#L69); [sistema/backend/src/modules/checkout/checkout.service.ts:168](../../sistema/backend/src/modules/checkout/checkout.service.ts#L168).

**Falha e impacto:** As nove operações de cart/checkout não exigem autenticação ou capacidade vinculada ao carrinho. customerId vem do corpo; as consultas de carrinho/sessão verificam tenant/store, mas não o ator. Confirmação chama OrdersService.create com esse titular e replay de sessão concluída retorna o pedido.

**Condição de exploração:** Chamador anônimo conhece customerId para personificação, ou ID de carrinho/sessão alheio para leitura/mutação. UUID imprevisível reduz descoberta, mas não comprova posse; o próprio chamador pode criar carrinho com customerId da vítima.

**Correção sugerida, não aplicada:**

```text
const owner = await authenticateCustomerOrGuestCapability(req);
const cart = await findOwnedCart({ id, tenantId, storeId, owner });
assertSessionOwner(session, owner);
const customerId = owner.verifiedCustomerId; // ignorar titular no body
```

**Aceitação da futura correção:** A não lê/altera/confirma/cancela carrinho ou sessão de B, nem cria pedido para B informando customerId; cliente bloqueado não contorna guard por checkout público; convidado legítimo opera apenas seu carrinho.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'UseGuards|customerId|findCart|confirmSession' sistema/backend/src/modules/checkout
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: cart, checkout, customerId, posse; 26 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:49:23.212Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S04 — Webhook de pagamento nao vincula cobranca valor e transicao ao pedido

**Prioridade:** High · **OWASP:** A04/A08 · **Linear:** [JON-134](https://linear.app/eojonathan/issue/JON-134/security-webhook-de-pagamento-nao-vincula-cobranca-valor-e-transicao) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/integrations/payments-webhook.service.ts:133](../../sistema/backend/src/modules/integrations/payments-webhook.service.ts#L133); [sistema/backend/src/modules/integrations/payments-webhook.service.ts:197](../../sistema/backend/src/modules/integrations/payments-webhook.service.ts#L197); [sistema/backend/src/modules/integrations/payments-webhook.service.ts:243](../../sistema/backend/src/modules/integrations/payments-webhook.service.ts#L243); [sistema/backend/src/modules/integrations/payments-ledger.service.ts:83](../../sistema/backend/src/modules/integrations/payments-ledger.service.ts#L83).

**Falha e impacto:** Evento indica orderId e chargeId sem exigir cobrança previamente vinculada. Valor ausente/inválido assume total; valor divergente positivo é aceito. Atualização de status é incondicional: fixture de 0,01 para pedido de 100 já DELIVERED marcou PAID e regrediu a CONFIRMED. Deduplicação por eventId não resolve eventos distintos fora de ordem.

**Condição de exploração:** Evento com assinatura aceita, inclusive integração legítima enviando ordem/valor incorretos ou fora de ordem. Independente do bypass de assinatura S03; nenhum gateway real foi chamado.

**Correção sugerida, não aplicada:**

```text
const charge = await findExistingCharge({ provider, providerRef, tenantId });
assert(charge.orderId === order.id && charge.currency === expectedCurrency);
assert(amountMinorUnits === charge.expectedAmountMinorUnits);
await atomicTransition(order, allowedPreviousStates, nextState, eventId);
```

**Aceitação da futura correção:** Valor insuficiente, moeda divergente, cobrança de outro pedido e evento atrasado não liberam/regridem pedido; replay é idempotente; pagamento e estado permanecem consistentes em concorrência.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'normalizeGatewayAmount|findUnique|createTransaction|order.update|targetStatus' sistema/backend/src/modules/integrations/payments-webhook.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. JON-125/JON-126 tratam geração de cobrança B2B, não validação de webhook recebido. Termos utilizados: webhook, charge, cobranca, pagamento; 21 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:49:41.077Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S05 — Marketplace aceita webhook de pedido sem segredo configurado

**Prioridade:** High · **OWASP:** A07 · **Linear:** [JON-115](https://linear.app/eojonathan/issue/JON-115/security-marketplace-aceita-webhook-de-pedido-sem-segredo-configurado) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/marketplace/marketplace.controller.ts:60](../../sistema/backend/src/modules/marketplace/marketplace.controller.ts#L60); [sistema/backend/src/modules/marketplace/marketplace.service.ts:174](../../sistema/backend/src/modules/marketplace/marketplace.service.ts#L174); [sistema/backend/src/modules/marketplace/marketplace.service.ts:291](../../sistema/backend/src/modules/marketplace/marketplace.service.ts#L291).

**Falha e impacto:** assertWebhookSecret retorna normalmente quando config.webhookSecret está vazio; cadastro aceita config vazio. A ingestão pública segue para criação/consolidação. Revalidação sintética confirmou a ausência de exigência de credencial.

**Condição de exploração:** Existência de canal com segredo vazio e conhecimento de channelId. Não se afirma que essa configuração esteja ativa em produção.

**Correção sugerida, não aplicada:**

```text
if (!expectedSecret) throw new ForbiddenException('Canal sem autenticacao');
verifyChannelSignatureBeforeAnyWrite(rawBody, headers);
// Segredo obrigatório ao ativar canal; comparação em tempo constante.
```

**Aceitação da futura correção:** Canal sem segredo e assinatura ausente/incorreta geram 403 e zero escritas; canal configurado aceita apenas eventos autênticos e idempotentes.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'assertWebhookSecret|if \(!expected\)|ingestMarketplaceOrder' sistema/backend/src/modules/marketplace
```

**Deduplicação:** Equivalência confirmada com JON-115; atualizar o mesmo defeito e preservar histórico. Termos utilizados: marketplace, segredo, webhook; 23 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:50:07.336Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S06 — Limpeza de imagens permite excluir arquivo fora da pasta uploads

**Prioridade:** High · **OWASP:** A01 · **Linear:** [JON-135](https://linear.app/eojonathan/issue/JON-135/security-limpeza-de-imagens-permite-excluir-arquivo-fora-da-pasta) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/common/services/uploads.service.ts:19](../../sistema/backend/src/common/services/uploads.service.ts#L19); [sistema/backend/src/common/services/uploads.service.ts:55](../../sistema/backend/src/common/services/uploads.service.ts#L55); [sistema/backend/src/modules/cms/store-banners/store-banners.service.ts:87](../../sistema/backend/src/modules/cms/store-banners/store-banners.service.ts#L87); [sistema/backend/src/modules/cms/store-banners/store-banners.service.ts:219](../../sistema/backend/src/modules/cms/store-banners/store-banners.service.ts#L219).

**Falha e impacto:** Extração de filename preserva segmentos .. após /uploads/; join com uploadsDir normaliza para fora da raiz, e unlink é executado. Store banners repete a lógica. URLs persistidas no CMS são usadas ao substituir/excluir imagens. Fixture com unlink simulado resolveu arquivo na pasta pai.

**Condição de exploração:** Usuário com escrita de CMS (admin, ou sessão comprometida) persiste URL manipulada e aciona substituição/exclusão; alvo precisa ser gravável pelo usuário do processo. Não houve exclusão real.

**Correção sugerida, não aplicada:**

```text
const candidate = resolve(uploadsRoot, relativeFilename);
const rel = relative(uploadsRoot, candidate);
if (!rel || rel.startsWith('..') || isAbsolute(rel)) reject();
assertOwnedManagedImage(candidate); // incluir symlinks e origem da URL
await unlink(candidate);
```

**Aceitação da futura correção:** URLs com ../, codificações, separadores Windows, caminho absoluto e symlink externo não excluem nada fora da raiz; remoção de imagem gerenciada válida funciona; cobrir helper e cópia em banners.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'extractFilenameFromUrl|unlink|join\(' sistema/backend/src/common/services/uploads.service.ts sistema/backend/src/modules/cms/store-banners/store-banners.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: upload, path, arquivo, traversal; 37 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:50:29.021Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S07 — Impressao de pedidos executa HTML armazenado de clientes no admin

**Prioridade:** High · **OWASP:** A03 · **Linear:** [JON-136](https://linear.app/eojonathan/issue/JON-136/security-impressao-de-pedidos-executa-html-armazenado-de-clientes-no) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/admin/src/pages/sections/OrdersSection.tsx:1246](../../sistema/admin/src/pages/sections/OrdersSection.tsx#L1246); [sistema/admin/src/pages/sections/OrdersSection.tsx:1248](../../sistema/admin/src/pages/sections/OrdersSection.tsx#L1248); [sistema/admin/src/hooks/useAuth.ts:29](../../sistema/admin/src/hooks/useAuth.ts#L29).

**Falha e impacto:** Template de impressão concatena nome, endereço, observações e nomes de produto sem escape e passa a document.write em janela about:blank aberta pelo admin. Dados do cliente tornam-se HTML executável na origem administrativa; JWT está em localStorage. A expressão original preservou um script marcador sintético em três campos.

**Condição de exploração:** Cliente cria pedido/cadastro com HTML e operador clica Imprimir. Prova local avaliou template, sem navegador, execução de script, leitura de token ou conexão externa.

**Correção sugerida, não aplicada:**

```text
const receipt = document.createElement('div');
receipt.textContent = untrustedCustomerText;
// Renderizar campos com React/textContent; se HTML for necessário, sanitização contextual.
// Aplicar CSP e abrir impressão sem acesso ao opener como defesa adicional.
```

**Aceitação da futura correção:** Nome, rua, observações e produto contendo tags/atributos aparecem como texto e não executam código; janela não obtém credenciais/opener; impressão mantém dados e totais.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'const html|document.write|window.open' sistema/admin/src/pages/sections/OrdersSection.tsx
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: XSS, impress, document.write, HTML; 1 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:50:36.407Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S08 — Upload generico aceita HTML disfarçado de imagem e publica na mesma origem

**Prioridade:** High · **OWASP:** A03/A05 · **Linear:** [JON-137](https://linear.app/eojonathan/issue/JON-137/security-upload-generico-aceita-html-disfarcado-de-imagem-e-publica-na) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/uploads/uploads.controller.ts:73](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L73); [sistema/backend/src/modules/uploads/uploads.controller.ts:85](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L85); [sistema/backend/src/modules/uploads/uploads.controller.ts:93](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L93); [sistema/backend/src/app.module.ts:101](../../sistema/backend/src/app.module.ts#L101); [sistema/admin/nginx.conf:28](../../sistema/admin/nginx.conf#L28).

**Falha e impacto:** Filtro genérico confia em file.mimetype enviado pelo cliente e mantém extname(originalname), sem decodificar/reencodar bytes. Fixture aceitou MIME image/png com extensão .html. ServeStatic e proxies publicam o arquivo como HTML sob origem dos apps; resposta com nosniff não torna HTML seguro. Staging do upload de produto também fica sob webroot.

**Condição de exploração:** Upload exige admin; conta comprometida/importação não confiável consegue hospedar conteúdo ativo e induzir acesso de outra sessão. Não foi feito multipart nem gravação de arquivo.

**Correção sugerida, não aplicada:**

```text
const decoded = await decodeBoundedImage(file.buffer);
const name = randomUUID() + '.webp';
await encodeWebp(decoded, outsideWebrootStaging);
await publishValidatedImage(name);
// Extensão e Content-Type derivam do formato real, nunca do cabeçalho do cliente.
```

**Aceitação da futura correção:** HTML/SVG/JS com MIME declarado image/png é recusado sem persistência; imagens reais são reencodadas com extensão segura; arquivos temporários não são públicos. JON-113 cobre separadamente cleanup após rejeição.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'mimetype|extname|fileFilter|ServeStaticModule' sistema/backend/src/modules/uploads/uploads.controller.ts sistema/backend/src/app.module.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: upload, mime, HTML, imagem; 11 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:50:35.776Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S09 — Troca de senha e logout nao revogam JWTs ja emitidos

**Prioridade:** High · **OWASP:** A07 · **Linear:** [JON-138](https://linear.app/eojonathan/issue/JON-138/security-troca-de-senha-e-logout-nao-revogam-jwts-ja-emitidos) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/auth/auth.service.ts:73](../../sistema/backend/src/modules/auth/auth.service.ts#L73); [sistema/backend/src/modules/auth/auth.service.ts:110](../../sistema/backend/src/modules/auth/auth.service.ts#L110); [sistema/backend/src/modules/auth/auth.service.ts:140](../../sistema/backend/src/modules/auth/auth.service.ts#L140); [sistema/backend/src/common/strategies/jwt.strategy.ts:45](../../sistema/backend/src/common/strategies/jwt.strategy.ts#L45); [sistema/frontend/src/contexts/AuthContext.tsx:99](../../sistema/frontend/src/contexts/AuthContext.tsx#L99); [sistema/admin/src/hooks/useAuth.ts:28](../../sistema/admin/src/hooks/useAuth.ts#L28); [sistema/picking-app/src/App.tsx:33](../../sistema/picking-app/src/App.tsx#L33); [sistema/delivery-app/src/App.tsx:33](../../sistema/delivery-app/src/App.tsx#L33).

**Falha e impacto:** Redefinição/troca de senha grava hash e limpa reset, mas não incrementa versão de sessão nem revoga jti. JwtStrategy consulta existência/blocked/active e permissões atuais, sem comparar emissão ao evento de credencial. Logout só limpa localStorage. Token copiado continua útil até 24h (admin) ou 30d (cliente/equipe).

**Condição de exploração:** Posse de JWT emitido antes de troca/reset/logout. Bloqueio/desativação atual funciona, mas não substitui revogação por incidente ou por sessão. Anonimização é tratada separadamente em JON-119.

**Correção sugerida, não aplicada:**

```text
await transaction(async tx => { await updatePassword(tx); await revokeAllSessions(tx, accountId); });
assertSessionActive(jwt.jti, jwt.sessionVersion);
POST /auth/logout => revokeCurrentSession();
// Sessões longas podem continuar via refresh rotativo e revogável.
```

**Aceitação da futura correção:** Após reset/troca, JWT antigo de cada papel recebe 401; logout revoga apenas a sessão escolhida conforme política; reativação da conta não restaura tokens revogados; preservar login prolongado legítimo.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'resetPassword|customerResetPassword|customerSetPassword|resetTokenHash|async validate' sistema/backend/src/modules/auth/auth.service.ts sistema/backend/src/common/strategies/jwt.strategy.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. JON-119 cobre anonimização; esta issue cobre reset/troca/logout ordinários. Termos utilizados: sess, JWT, revoga, senha; 15 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:50:51.609Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S11 — Inscricao de Web Push permite destinos de rede arbitrarios

**Prioridade:** High · **OWASP:** A10 · **Linear:** [JON-140](https://linear.app/eojonathan/issue/JON-140/security-inscricao-de-web-push-permite-destinos-de-rede-arbitrarios) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/notifications/notifications.controller.ts:53](../../sistema/backend/src/modules/notifications/notifications.controller.ts#L53); [sistema/backend/src/modules/notifications/notifications.service.ts:289](../../sistema/backend/src/modules/notifications/notifications.service.ts#L289); [sistema/backend/src/modules/notifications/push-notification.service.ts:208](../../sistema/backend/src/modules/notifications/push-notification.service.ts#L208).

**Falha e impacto:** Endpoint de inscrição autenticada aceita endpoint/keys sem DTO de URL, allowlist de provedores ou bloqueio de IP privado. Envio passa diretamente a web-push. A biblioteca instalada preparou solicitação para loopback com chaves efêmeras válidas, sem realizar rede.

**Condição de exploração:** Cliente pode se cadastrar, registrar endpoint com chaves Web Push válidas e provocar evento destinado à própria conta; envio requer push/VAPID habilitado. Alcance depende de rede/TLS do processo; não se afirma leitura de resposta interna ou execução remota.

**Correção sugerida, não aplicada:**

```text
const target = await validatePushProviderEndpoint(dto.endpoint);
assertHttpsAllowedProvider(target);
assertAllResolvedAddressesPublic(target.hostname);
validatePushKeys(dto.keys);
await saveBoundedSubscription(accountId, target);
```

**Aceitação da futura correção:** Rejeitar loopback, RFC1918, link-local, IPv6 privado, credenciais na URL, DNS privado e host parecido com provedor; provedores autorizados válidos funcionam; nenhuma chamada de transporte para destinos recusados.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'endpoint: subscription|sendNotification|savePushSubscription' sistema/backend/src/modules/notifications
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: push, SSRF, endpoint, subscription; 21 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:50:40.926Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S13 — Endpoints legados e API clients atravessam limites de tenant e loja

**Prioridade:** High · **OWASP:** A01 · **Linear:** [JON-142](https://linear.app/eojonathan/issue/JON-142/security-endpoints-legados-e-api-clients-atravessam-limites-de-tenant) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/common/guards/tenant-access.guard.ts:7](../../sistema/backend/src/common/guards/tenant-access.guard.ts#L7); [sistema/backend/src/modules/customers/customers.service.ts:30](../../sistema/backend/src/modules/customers/customers.service.ts#L30); [sistema/backend/src/modules/auth/auth.service.ts:524](../../sistema/backend/src/modules/auth/auth.service.ts#L524); [sistema/backend/src/modules/public-api/public-api.service.ts:24](../../sistema/backend/src/modules/public-api/public-api.service.ts#L24); [sistema/backend/src/modules/products/products.service.ts:823](../../sistema/backend/src/modules/products/products.service.ts#L823); [sistema/backend/src/modules/addresses/addresses.service.ts:87](../../sistema/backend/src/modules/addresses/addresses.service.ts#L87); [sistema/backend/src/modules/notifications/notifications.service.ts:326](../../sistema/backend/src/modules/notifications/notifications.service.ts#L326).

**Falha e impacto:** Vários controllers administrativos não propagam contexto; serviços consultam/mutam por id global. createClient aceita tenant/store no body e cria credencial para eles; buscas SQL de produtos ignoram contexto; criação de Address espalha body incluindo tenantId; broadcasts e agendamentos não delimitam destinatários/tenant. TenantAccessGuard só exige contexto, sem validar membership. Header não sobrepõe tenant de JWT moderno: o defeito está nas consultas e seletores não vinculados.

**Condição de exploração:** Dois tenants/lojas no mesmo banco e ator com acesso a um deles, ou catálogo público usando busca sem filtro. Não se presume múltiplos tenants ativos em produção. Marketplace administrativo tem equivalente próprio JON-116 e está excluído desta issue.

**Correção sugerida, não aplicada:**

```text
const ctx = await authorizeLiveTenantStoreMembership(req.user);
rejectClientSuppliedTenantSelectors(dto);
findFirst({ where: { id, ...ctx } });
updateMany({ where: { id, ...ctx }, data: pickAllowedFields(dto) });
// Aplicar também a jobs, SQL parametrizado, relações e destinatários push.
```

**Aceitação da futura correção:** Fixtures A/B não permitem a A listar/mutar clientes/staff/canais de API/agendamentos de B ou gerar chave para B; busca pública respeita loja; Address ignora tenantId/id/createdAt do corpo; relações inconsistentes são recusadas. Testar todos os endpoints do inventário.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'createClient|tenantId: input|updateStaff|scheduledNotification|\$queryRaw|\.\.\.data' sistema/backend/src/modules/public-api/public-api.service.ts sistema/backend/src/modules/auth/auth.service.ts sistema/backend/src/modules/notifications/notifications.service.ts sistema/backend/src/modules/products/products.service.ts sistema/backend/src/modules/addresses/addresses.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. JON-116 fica exclusivo de marketplace; esta issue cobre os demais módulos enumerados. Termos utilizados: tenant, store, isolamento, cliente, broadcast; 36 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:52:20.453Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S15 — Compose aceita segredos padrao versionados inclusive para JWT de producao

**Prioridade:** High · **OWASP:** A02/A05 · **Linear:** [JON-144](https://linear.app/eojonathan/issue/JON-144/security-compose-aceita-segredos-padrao-versionados-inclusive-para-jwt) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/docker-compose.yml:52](../../sistema/docker-compose.yml#L52); [sistema/docker-compose.staging.yml:68](../../sistema/docker-compose.staging.yml#L68); [sistema/backend/src/common/security/jwt-secret.ts:12](../../sistema/backend/src/common/security/jwt-secret.ts#L12).

**Falha e impacto:** Manifests principal/staging incluem fallbacks literais para credenciais de banco/Meilisearch/JWT. O valor padrão JWT conhecido no repositório passa pelo teste de comprimento do helper em production, comprovado sem imprimi-lo. Não foi lido .env nem produzido token assinado.

**Condição de exploração:** Ambiente iniciado com esses manifests e variáveis ausentes. Segredo conhecido possibilita forjar JWT se atacante também identificar conta válida, ou autenticar em serviços expostos. Manifest prod dedicado exige variáveis e não tem o mesmo fallback.

**Correção sugerida, não aplicada:**

```text
JWT_SECRET: ${JWT_SECRET:?configure segredo exclusivo}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?configure segredo exclusivo}
MEILI_MASTER_KEY: ${MEILI_MASTER_KEY:?configure segredo exclusivo}
// Gerar valores por ambiente; rejeitar placeholders conhecidos no boot.
```

**Aceitação da futura correção:** Compose falha cedo quando faltam segredos; valor padrão do repo é rejeitado em ambientes não locais; fixtures de CI usam configuração explícita própria; nenhum segredo é impresso em logs/comandos.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
git ls-files -- sistema/docker-compose.yml sistema/docker-compose.staging.yml sistema/backend/src/common/security/jwt-secret.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: segredo, JWT_SECRET, compose, senha; 16 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:52:38.133Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S18 — Metricas publicas e logs propagam URLs com dados pessoais e erros crus

**Prioridade:** High · **OWASP:** A09/A01 · **Linear:** [JON-147](https://linear.app/eojonathan/issue/JON-147/security-metricas-publicas-e-logs-propagam-urls-com-dados-pessoais-e) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/common/interceptors/http-logging.interceptor.ts:20](../../sistema/backend/src/common/interceptors/http-logging.interceptor.ts#L20); [sistema/backend/src/common/interceptors/http-logging.interceptor.ts:57](../../sistema/backend/src/common/interceptors/http-logging.interceptor.ts#L57); [sistema/backend/src/common/observability/metrics-registry.ts:26](../../sistema/backend/src/common/observability/metrics-registry.ts#L26); [sistema/backend/src/common/observability/metrics-registry.ts:69](../../sistema/backend/src/common/observability/metrics-registry.ts#L69); [sistema/backend/src/modules/observability/observability.controller.ts:24](../../sistema/backend/src/modules/observability/observability.controller.ts#L24).

**Falha e impacto:** Interceptor armazena url integral e error.message. Registry usa URL/query como label; endpoint Prometheus não tem guard. Qualquer leitor pode obter rotas observadas, inclusive identificadores em path (há fidelidade por CPF) e parâmetros de busca pessoais. Fixture confirmou query sensível no texto Prometheus. Erros de integrações/Prisma podem incorporar entradas sem redação central.

**Condição de exploração:** Uma requisição contendo PII em path/query é observada antes da coleta pública; logs também ficam disponíveis aos leitores operacionais. Prova usa apenas example.invalid, sem dados de clientes.

**Correção sugerida, não aplicada:**

```text
observeHttp({ route: req.route?.path || 'unmatched', ...boundedMetrics });
requireMonitoringCredential('/observability/metrics/prometheus');
logger.warn('http_error', { requestId, errorCode: classify(error) });
// Redação central de query, identificadores, credenciais e respostas externas.
```

**Aceitação da futura correção:** CPF/e-mail/token sintéticos em URL e erro não aparecem em métricas/logs; scrape anônimo é negado ou contém apenas métricas deliberadamente públicas sem dados de requisição; cardinalidade permanece limitada.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'route: url|url,|error: err|endpoint.endpoint|metrics/prometheus|UseGuards' sistema/backend/src/common/interceptors/http-logging.interceptor.ts sistema/backend/src/common/observability/metrics-registry.ts sistema/backend/src/modules/observability/observability.controller.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. JON-69 trata tipo de counter, não divulgação de dados em scrape público. Termos utilizados: Prometheus, metric, log, CPF; 73 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:53:18.367Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S28 — Respostas operacionais continuam incluindo hashes de autenticacao de clientes

**Prioridade:** High · **OWASP:** A01 · **Linear:** [JON-71](https://linear.app/eojonathan/issue/JON-71/security-respostas-operacionais-continuam-incluindo-hashes-de) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/orders/orders.service.ts:256](../../sistema/backend/src/modules/orders/orders.service.ts#L256); [sistema/backend/src/modules/picking/picking.service.ts:81](../../sistema/backend/src/modules/picking/picking.service.ts#L81); [sistema/backend/src/modules/delivery/driver.controller.ts:89](../../sistema/backend/src/modules/delivery/driver.controller.ts#L89); [sistema/backend/src/modules/public-api/public-api.service.ts:122](../../sistema/backend/src/modules/public-api/public-api.service.ts#L122); [sistema/backend/src/modules/data-privacy/data-privacy.service.ts:70](../../sistema/backend/src/modules/data-privacy/data-privacy.service.ts#L70); [sistema/backend/prisma/schema.prisma:137](../../sistema/backend/prisma/schema.prisma#L137).

**Falha e impacto:** F27 da Fase 1 permanece: customer:true retorna password/resetTokenHash/resetTokenExpiresAt. Ampliação de alcance confirmada em listOrders/getOrder da API por chave e exportação LGPD sem projeção; mutações de customers também precisam serialização uniforme. stripSecrets do GET /customers não se aplica recursivamente a outros módulos.

**Condição de exploração:** Acesso autorizado ao recurso por picker/driver/admin/API client ou cliente à exportação; hashes e metadados de recuperação excedem necessidade operacional. Não foram lidos registros reais.

**Correção sugerida, não aplicada:**

```text
const customerOperationalSelect = { id: true, name: true, whatsapp: true };
include: { customer: { select: customerOperationalSelect } };
// DTOs explícitos também em exportação e retornos de mutação; omitir segredos recursivamente.
```

**Aceitação da futura correção:** Fixture com password/resetTokenHash/resetTokenExpiresAt nunca devolve esses campos em orders/picking/driver/public-api/data-privacy/customers; manter só dados necessários por papel; regressão de GET customers coberta.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'customer: true|stripSecrets|exportCustomerData' sistema/backend/src/modules
```

**Deduplicação:** Equivalência confirmada com JON-71; atualizar o mesmo defeito e preservar histórico. Termos utilizados: hash, customer, senha, projec; 14 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:51:11.784Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S29 — Motorista pode alterar rota de outro motorista da mesma loja

**Prioridade:** High · **OWASP:** A01 · **Linear:** [JON-72](https://linear.app/eojonathan/issue/JON-72/security-motorista-pode-alterar-rota-de-outro-motorista-da-mesma-loja) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/delivery/driver.controller.ts:81](../../sistema/backend/src/modules/delivery/driver.controller.ts#L81); [sistema/backend/src/modules/delivery/driver.controller.ts:104](../../sistema/backend/src/modules/delivery/driver.controller.ts#L104); [sistema/backend/src/modules/delivery/driver.controller.ts:116](../../sistema/backend/src/modules/delivery/driver.controller.ts#L116); [sistema/backend/src/modules/delivery/driver.controller.ts:123](../../sistema/backend/src/modules/delivery/driver.controller.ts#L123); [sistema/backend/src/modules/delivery/delivery.service.ts:877](../../sistema/backend/src/modules/delivery/delivery.service.ts#L877).

**Falha e impacto:** F28 revalidado: GET filtra driverId, mas três POSTs só verificam perfil e descartam driver.id. Service limita tenant/store, não posse; actor serve para auditoria.

**Condição de exploração:** Motorista autenticado conhece routeId/stopId alheio na mesma loja e estado permite transição.

**Correção sugerida, não aplicada:**

```text
const driver = await findDriverByAdmin(req);
await requireOwnedRoute({ id, driverId: driver.id, ...context });
await mutateWithOwnerPredicate(...);
```

**Aceitação da futura correção:** Driver A não inicia, modifica parada nem conclui rota B; nenhum evento/escrita em negativas; rota própria e gestão administrativa autorizada continuam funcionando.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'driverId|startRoute|updateStopStatus|completeRoute' sistema/backend/src/modules/delivery/driver.controller.ts
```

**Deduplicação:** Equivalência confirmada com JON-72; atualizar o mesmo defeito e preservar histórico. Termos utilizados: driver, motorista, rota, posse; 14 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:54:59.258Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S34 — Gestao de marketplace permite selecionar tenant e canal alheios

**Prioridade:** High · **OWASP:** A01 · **Linear:** [JON-116](https://linear.app/eojonathan/issue/JON-116/security-gestao-de-marketplace-permite-selecionar-tenant-e-canal) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/marketplace/marketplace.controller.ts:20](../../sistema/backend/src/modules/marketplace/marketplace.controller.ts#L20); [sistema/backend/src/modules/marketplace/marketplace.controller.ts:29](../../sistema/backend/src/modules/marketplace/marketplace.controller.ts#L29); [sistema/backend/src/modules/marketplace/marketplace.service.ts:40](../../sistema/backend/src/modules/marketplace/marketplace.service.ts#L40); [sistema/backend/src/modules/marketplace/marketplace.service.ts:285](../../sistema/backend/src/modules/marketplace/marketplace.service.ts#L285).

**Falha e impacto:** Admin endpoints passam seletores de body/query/id sem contexto autenticado; requireChannel consulta id global. Permite ler configurações e alterar políticas/produtos de canais alheios. Equivalente exato F45, separado dos outros módulos em S13.

**Condição de exploração:** Admin de A com tenantId/storeId/channelId de B em instalação compartilhada. Não se presume operação multi-tenant de produção.

**Correção sugerida, não aplicada:**

```text
const ctx = await authorizedTenantStore(req);
const channel = await findFirst({where:{id:channelId,...ctx}});
rejectDivergentBodyContext(body, ctx);
```

**Aceitação da futura correção:** A não lista/cria/muta canais e políticas de B; mesma proteção cobre config com segredo; B opera próprios canais.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'tenantId|storeId|requireChannel|Req\(' sistema/backend/src/modules/marketplace
```

**Deduplicação:** Equivalência confirmada com JON-116; atualizar o mesmo defeito e preservar histórico. Termos utilizados: marketplace, tenant, canal; 18 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:34:09.863Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S35 — Anonimizacao preserva reset e permite reativar acesso pela sessao antiga

**Prioridade:** High · **OWASP:** A07 · **Linear:** [JON-119](https://linear.app/eojonathan/issue/JON-119/security-anonimizacao-preserva-reset-e-permite-reativar-acesso-pela) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/data-privacy/data-privacy.service.ts:146](../../sistema/backend/src/modules/data-privacy/data-privacy.service.ts#L146); [sistema/backend/src/modules/auth/auth.service.ts:110](../../sistema/backend/src/modules/auth/auth.service.ts#L110); [sistema/backend/src/modules/auth/auth.service.ts:140](../../sistema/backend/src/modules/auth/auth.service.ts#L140); [sistema/backend/src/common/strategies/jwt.strategy.ts:49](../../sistema/backend/src/common/strategies/jwt.strategy.ts#L49).

**Falha e impacto:** Anonimização zera password, mas mantém blocked=false e campos reset. JWT anterior continua aceito; SetPassword deixa de exigir senha atual porque password é null. Links antigos continuam válidos. Push subscriptions também precisam ser encerradas no estado anonimizado. Reutiliza F48/JON-119; S09 cobre troca/logout ordinários.

**Condição de exploração:** Conta anonimizada possui JWT ou reset ainda válidos e atacante/antigo titular os conserva.

**Correção sugerida, não aplicada:**

```text
data: { password:null, resetTokenHash:null, resetTokenExpiresAt:null, blocked:true, accountState:'ANONYMIZED' };
revokeAllSessionsAndPushSubscriptions(customerId);
// Bloquear reset/set-password nesse estado de forma permanente explícita.
```

**Aceitação da futura correção:** Depois de anonimizar, sessão e reset anteriores são recusados; set-password não recria acesso; nenhum push privado continua para a conta; dados operacionais retidos permanecem consistentes.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'password: null|resetTokenHash|blocked|customerSetPassword' sistema/backend/src/modules/data-privacy/data-privacy.service.ts sistema/backend/src/modules/auth/auth.service.ts sistema/backend/src/common/strategies/jwt.strategy.ts
```

**Deduplicação:** Equivalência confirmada com JON-119; atualizar o mesmo defeito e preservar histórico. Termos utilizados: anonimiz, sess, reset; 12 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:34:17.822Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S10 — Token de reset pode ser consumido duas vezes em concorrencia

**Prioridade:** Medium · **OWASP:** A07 · **Linear:** [JON-139](https://linear.app/eojonathan/issue/JON-139/security-token-de-reset-pode-ser-consumido-duas-vezes-em-concorrencia) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/auth/auth.service.ts:73](../../sistema/backend/src/modules/auth/auth.service.ts#L73); [sistema/backend/src/modules/auth/auth.service.ts:110](../../sistema/backend/src/modules/auth/auth.service.ts#L110).

**Falha e impacto:** Reset lê token válido, calcula bcrypt assíncrono e atualiza apenas por id. Duas requisições que lerem antes do consumo passam e a última troca de senha vence. Suíte com promises e Prisma falso confirmou duas escritas tanto para admin quanto customer.

**Condição de exploração:** Conhecimento do mesmo link de recuperação e duas chamadas concorrentes durante sua validade. Token aleatório/hash/TTL atuais são adequados, mas consumo não é atômico.

**Correção sugerida, não aplicada:**

```text
const changed = await tx.customer.updateMany({
 where: { id, resetTokenHash: hash, resetTokenExpiresAt: { gt: now } },
 data: { password: newHash, resetTokenHash: null, resetTokenExpiresAt: null }
});
if (changed.count !== 1) throw new BadRequestException();
```

**Aceitação da futura correção:** Duas tentativas concorrentes com o mesmo token resultam em uma troca e uma rejeição; token expirado/consumido não altera senha; aplicar a admin e customer com revogação de sessões.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'resetPassword|customerResetPassword|resetTokenHash|bcrypt.hash' sistema/backend/src/modules/auth/auth.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: reset, token, concorr, senha; 20 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:50:59.925Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S12 — Webhooks de saida fazem requisicoes a URLs internas sem validacao

**Prioridade:** Medium · **OWASP:** A10 · **Linear:** [JON-141](https://linear.app/eojonathan/issue/JON-141/security-webhooks-de-saida-fazem-requisicoes-a-urls-internas-sem) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/public-api/public-api.service.ts:174](../../sistema/backend/src/modules/public-api/public-api.service.ts#L174); [sistema/backend/src/modules/public-api/public-api.service.ts:280](../../sistema/backend/src/modules/public-api/public-api.service.ts#L280).

**Falha e impacto:** Cadastro persiste URL arbitrária; worker usa axios.post com timeout, mas sem allowlist, validação DNS/IP, bloqueio de rede interna ou maxRedirects=0. Fixture entregou URL loopback ao transporte simulado. Payloads de pedidos também podem sair para redirecionamento não previsto.

**Condição de exploração:** Administrador autorizado a configurar webhook, inclusive sessão comprometida; worker precisa processar entrega. Privilégio de admin do aplicativo não equivale a acesso irrestrito à rede do servidor.

**Correção sugerida, não aplicada:**

```text
const target = await validateConfiguredWebhookTarget(endpoint.url);
await axios.post(target.href, payload, {
 timeout: 5000, maxRedirects: 0,
 httpsAgent: agentWithValidatedDnsAndEgressPolicy
});
```

**Aceitação da futura correção:** Cadastro/processamento recusam destinos privados e redirects para eles; DNS rebinding não troca o IP validado; parceiro permitido recebe envelope assinado; transportes ficam simulados nos testes.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'createWebhookEndpoint|url: input.url|axios.post|maxRedirects' sistema/backend/src/modules/public-api/public-api.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: webhook, SSRF, url, axios; 32 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:50:45.179Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S14 — JWT mantem tenant antigo e fixa loja padrao sem revalidar vinculo

**Prioridade:** Medium · **OWASP:** A01/A07 · **Linear:** [JON-143](https://linear.app/eojonathan/issue/JON-143/security-jwt-mantem-tenant-antigo-e-fixa-loja-padrao-sem-revalidar) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/common/strategies/jwt.strategy.ts:49](../../sistema/backend/src/common/strategies/jwt.strategy.ts#L49); [sistema/backend/src/common/strategies/jwt.strategy.ts:73](../../sistema/backend/src/common/strategies/jwt.strategy.ts#L73); [sistema/backend/src/modules/auth/auth.service.ts:173](../../sistema/backend/src/modules/auth/auth.service.ts#L173); [sistema/backend/src/modules/auth/auth.service.ts:589](../../sistema/backend/src/modules/auth/auth.service.ts#L589); [sistema/backend/src/common/tenant/tenant-context.ts:46](../../sistema/backend/src/common/tenant/tenant-context.ts#L46).

**Falha e impacto:** JwtStrategy atualiza role/moduleAccess pelo banco, porém preserva tenantId/storeId do payload e não consulta vínculo de loja. Auth emite store padrão para as contas. Fixture com cadastro movido para B manteve contexto A do token antigo.

**Condição de exploração:** Conta transferida entre tenants/lojas ou acesso removido durante validade do JWT; recursos antigos continuam existindo. S13 trata consultas sem filtro; aqui até consulta corretamente filtrada recebe contexto obsoleto.

**Correção sugerida, não aplicada:**

```text
const account = await loadCurrentAccountWithMemberships(jwt.id);
const context = selectAuthorizedStore(account, requestedStore);
if (!context) throw new UnauthorizedException();
return { ...safeIdentity, ...context, permissions: await livePermissions(context) };
```

**Aceitação da futura correção:** Mover conta/revogar vínculo invalida acesso à loja antiga imediatamente; token não autoriza loja de outro tenant; login de conta B não emite store_default de A; papel e módulos mantêm validação atual.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'tenantId: payload|storeId: payload|DEFAULT_STORE_ID|select:' sistema/backend/src/common/strategies/jwt.strategy.ts sistema/backend/src/modules/auth/auth.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: JWT, tenant, store, sess; 22 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:50:49.314Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S16 — Compose principal e staging publicam banco busca e API em todas as interfaces

**Prioridade:** Medium · **OWASP:** A05 · **Linear:** [JON-145](https://linear.app/eojonathan/issue/JON-145/security-compose-principal-e-staging-publicam-banco-busca-e-api-em) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/docker-compose.yml:16](../../sistema/docker-compose.yml#L16); [sistema/docker-compose.yml:39](../../sistema/docker-compose.yml#L39); [sistema/docker-compose.yml:119](../../sistema/docker-compose.yml#L119); [sistema/docker-compose.staging.yml:31](../../sistema/docker-compose.staging.yml#L31); [sistema/docker-compose.staging.yml:52](../../sistema/docker-compose.staging.yml#L52); [sistema/docker-compose.staging.yml:86](../../sistema/docker-compose.staging.yml#L86).

**Falha e impacto:** Publicações de portas sem endereço de bind disponibilizam Postgres, Meilisearch e API também na interface LAN, não só localhost. Combinadas com defaults conhecidos S15, ampliam acesso e permitem contornar proxy. Manifest prod dedicado limita exposição externa ao Caddy.

**Condição de exploração:** Execução desses manifests em host alcançável por rede não confiável e firewall permitindo as portas. Não foi feito scan de portas nem se afirma exposição atual da VPS.

**Correção sugerida, não aplicada:**

```text
ports:
  - '127.0.0.1:5432:5432'
// Aplicar bind local a serviços de desenvolvimento;
// ambiente compartilhado: somente rede Docker privada e entrada pelo proxy.
```

**Aceitação da futura correção:** Inspeção de docker compose config com fixtures não mostra host_ip 0.0.0.0 para serviços internos; em stack descartável acesso LAN é recusado e localhost/proxy autorizado funciona.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'ports:|5432:5432|5433:5432|7700:7700|7701:7700|3001:3001|4001:3001' sistema/docker-compose.yml sistema/docker-compose.staging.yml
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: porta, compose, expos, Postgres; 51 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:52:47.297Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S17 — Checkout confia no primeiro X-Forwarded-For para antifraude

**Prioridade:** Medium · **OWASP:** A04/A05 · **Linear:** [JON-146](https://linear.app/eojonathan/issue/JON-146/security-checkout-confia-no-primeiro-x-forwarded-for-para-antifraude) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/checkout/checkout.controller.ts:29](../../sistema/backend/src/modules/checkout/checkout.controller.ts#L29); [sistema/backend/src/main.ts:59](../../sistema/backend/src/main.ts#L59); [sistema/backend/src/modules/orders/orders.service.ts:352](../../sistema/backend/src/modules/orders/orders.service.ts#L352); [sistema/backend/src/modules/orders/orders.service.ts:461](../../sistema/backend/src/modules/orders/orders.service.ts#L461).

**Falha e impacto:** confirm escolhe o primeiro elemento do header recebido antes de req.ip validado pelo proxy. Esse valor alimenta histórico e antifraude por IP. A API publicada diretamente pelos manifests principal/staging permite declarar qualquer IP. Caminho Caddy→nginx→API também exige política de proxies coerente, pois trust proxy=1 não representa ambos os saltos.

**Condição de exploração:** Acesso direto à API ou proxy que preserve header de origem não confiável. Não foi demonstrada falsificação pela entrada Caddy configurada, que possui saneamento próprio.

**Correção sugerida, não aplicada:**

```text
const clientIp = req.ip;
// Definir trust proxy por redes/proxies conhecidos e topology verificada.
// Bloquear acesso externo direto à API; ingress descarta XFF não confiável.
```

**Aceitação da futura correção:** Header fornecido pelo cliente não muda IP atribuído em nenhum ingresso suportado; testar API direta, Caddy→API e Caddy→nginx→API com fixtures; manter separação de buckets entre clientes reais.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'x-forwarded-for|clientIp|trust proxy' sistema/backend/src/modules/checkout/checkout.controller.ts sistema/backend/src/main.ts sistema/backend/src/modules/orders/orders.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: forwarded, IP, fraude, proxy; 94 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:50:53.780Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S19 — Logout deixa inscricao push vinculada ao usuario anterior no aparelho

**Prioridade:** Medium · **OWASP:** A07 · **Linear:** [JON-148](https://linear.app/eojonathan/issue/JON-148/security-logout-deixa-inscricao-push-vinculada-ao-usuario-anterior-no) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/frontend/src/contexts/AuthContext.tsx:99](../../sistema/frontend/src/contexts/AuthContext.tsx#L99); [sistema/picking-app/src/App.tsx:33](../../sistema/picking-app/src/App.tsx#L33); [sistema/delivery-app/src/App.tsx:33](../../sistema/delivery-app/src/App.tsx#L33); [sistema/picking-app/src/hooks/usePushEquipe.ts:79](../../sistema/picking-app/src/hooks/usePushEquipe.ts#L79); [sistema/backend/src/modules/notifications/notifications.service.ts:289](../../sistema/backend/src/modules/notifications/notifications.service.ts#L289).

**Falha e impacto:** Logout remove apenas JWT/dados locais, sem remover subscription no navegador/servidor. Hook da equipe considera subscription existente como ativa sem religá-la automaticamente à identidade atual. Em aparelho compartilhado, notificações da sessão anterior podem continuar aparecendo após sair; ao entrar outra conta, indicador ativo pode representar o destinatário anterior.

**Condição de exploração:** Usuário sai explicitamente e entrega o mesmo perfil de navegador/aparelho a outra pessoa; push já estava autorizado. Não confundir com requisito legítimo de notificar com app fechado durante sessão válida.

**Correção sugerida, não aplicada:**

```text
await api.delete('/notifications/push-subscriptions/current-device');
await subscription?.unsubscribe();
await revokeCurrentSession();
// Na troca de identidade, revalidar/reassociar inscrição sob autorização e consentimento.
```

**Aceitação da futura correção:** A sai, B entra no mesmo aparelho: nenhum push privado de A chega; estado ativo identifica vínculo atual; logout em um dispositivo não remove os demais; cobrir storefront/picking/delivery.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'logout|removeItem|getSubscription|unsubscribe' sistema/frontend/src/contexts/AuthContext.tsx sistema/picking-app/src/App.tsx sistema/delivery-app/src/App.tsx sistema/picking-app/src/hooks/usePushEquipe.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: push, logout, aparelho, sess; 15 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:50:58.149Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S20 — Chave privada TLS do ambiente local esta versionada

**Prioridade:** Medium · **OWASP:** A02 · **Linear:** [JON-149](https://linear.app/eojonathan/issue/JON-149/security-chave-privada-tls-do-ambiente-local-esta-versionada) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/certs/key.pem:1](../../sistema/certs/key.pem#L1); [sistema/frontend/nginx.conf:120](../../sistema/frontend/nginx.conf#L120); [sistema/admin/nginx.conf:85](../../sistema/admin/nginx.conf#L85).

**Falha e impacto:** git ls-files inclui uma chave privada PEM usada por nginx local. Teste criptográfico em memória confirmou correspondência com o certificado local, sem exportar/imprimir chave. Quem obtiver o repositório possui esse material de autenticação.

**Condição de exploração:** Dispositivo confia nesse certificado/CA e acessa ambiente local usando a chave distribuída; atacante precisa também controlar/interceptar conexão aplicável. Não há evidência de uso dessa chave no TLS público de produção.

**Correção sugerida, não aplicada:**

```text
// Gerar certificado/chave exclusivos por ambiente fora do controle de versão.
// Montar chave como segredo somente leitura e adicionar regra de ignore.
// Substituir certificado comprometido e revisar confiança dos dispositivos.
// Remoção histórica é ação separada coordenada; não reescrever history nesta auditoria.
```

**Aceitação da futura correção:** git ls-files não lista chave privada ativa; novo ambiente gera chave exclusiva; certificado anterior deixa de ser aceito conforme plano de rotação; nenhum valor é impresso em CI/documentação.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
git ls-files -- sistema/certs/key.pem sistema/certs/cert.pem
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: chave, cert, TLS, segredo; 26 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:45:55.509Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S21 — Apps de operacao e shell do storefront ficam sem protecao de enquadramento

**Prioridade:** Medium · **OWASP:** A05 · **Linear:** [JON-150](https://linear.app/eojonathan/issue/JON-150/security-apps-de-operacao-e-shell-do-storefront-ficam-sem-protecao-de) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/picking-app/nginx.conf:1](../../sistema/picking-app/nginx.conf#L1); [sistema/delivery-app/nginx.conf:1](../../sistema/delivery-app/nginx.conf#L1); [sistema/frontend/nginx.conf:79](../../sistema/frontend/nginx.conf#L79); [sistema/frontend/nginx.conf:171](../../sistema/frontend/nginx.conf#L171); [sistema/Caddyfile:10](../../sistema/Caddyfile#L10).

**Falha e impacto:** Picking/delivery não definem X-Frame-Options nem CSP frame-ancestors. No storefront, add_header Cache-Control em location=/index.html substitui a herança de headers de server no padrão nginx; a SPA perde X-Frame-Options/nosniff. Caddy não repõe esses headers. Resultado inferido da configuração e documentação oficial, não medido no servidor.

**Condição de exploração:** Usuário autenticado abre página atacante que enquadra o app e induz cliques. Ausência de CSP também reduz contenção do XSS S07, mas não é considerada prova isolada de XSS.

**Correção sugerida, não aplicada:**

```text
// Em todas as respostas HTML, inclusive locations específicas:
add_header X-Frame-Options 'DENY' always;
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header X-Content-Type-Options 'nosniff' always;
// Preservar política de cache e testar herança por versão nginx.
```

**Aceitação da futura correção:** HTML inicial/rotas SPA e erros relevantes enviam proteção contra framing nos quatro apps; página de origem distinta não enquadra operações; headers continuam presentes após Cache-Control específico.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'add_header|index.html|frame-ancestors|X-Frame-Options' sistema/frontend/nginx.conf sistema/admin/nginx.conf sistema/picking-app/nginx.conf sistema/delivery-app/nginx.conf sistema/Caddyfile
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: header, nginx, frame, CSP; 6 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:53:39.439Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S22 — Reserva de estoque publica permite TTL sem limite e sem carrinho

**Prioridade:** Medium · **OWASP:** A01/A04 · **Linear:** [JON-151](https://linear.app/eojonathan/issue/JON-151/security-reserva-de-estoque-publica-permite-ttl-sem-limite-e-sem) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/inventory/inventory.controller.ts:39](../../sistema/backend/src/modules/inventory/inventory.controller.ts#L39); [sistema/backend/src/modules/inventory/inventory.service.ts:66](../../sistema/backend/src/modules/inventory/inventory.service.ts#L66); [sistema/backend/src/modules/inventory/inventory.service.ts:99](../../sistema/backend/src/modules/inventory/inventory.service.ts#L99).

**Falha e impacto:** POST stock/reservations é público e recebe objeto sem DTO; cartId é opcional e ttlMinutes não tem teto. Serviço altera reserved/available e cria ledger/reservas órfãs. Fixture reservou por um ano sem carrinho. Venda acima do estoque para produto vendável é decisão explícita e não é o defeito.

**Condição de exploração:** Chamador anônimo conhece produto público vendável; bucket geral limita chamadas, mas não duração, tamanho de lote ou vínculo de negócio. Não foi realizado teste de carga.

**Correção sugerida, não aplicada:**

```text
const cart = await requireOwnedActiveCart(req, dto.cartId);
const items = boundedItemsFromCart(cart);
const ttl = clampValidatedInteger(dto.ttlMinutes, 1, MAX_RESERVATION_TTL);
return reserveIdempotently(cart.id, items, ttl);
```

**Aceitação da futura correção:** Sem carrinho/capacidade válido não há mutação; TTL excessivo/negativo e lote excessivo são rejeitados; repetição não acumula reservas; disponibilidade de produtos vendáveis segue regra existente.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'UseGuards|ttlMinutes|cartId|reserved:' sistema/backend/src/modules/inventory/inventory.controller.ts sistema/backend/src/modules/inventory/inventory.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: reserva, stock, TTL, public; 53 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:53:49.910Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S23 — Cotacao usa CEP e coordenadas diferentes do endereco de entrega

**Prioridade:** Medium · **OWASP:** A04 · **Linear:** [JON-152](https://linear.app/eojonathan/issue/JON-152/security-cotacao-usa-cep-e-coordenadas-diferentes-do-endereco-de) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/checkout/checkout.service.ts:519](../../sistema/backend/src/modules/checkout/checkout.service.ts#L519); [sistema/backend/src/modules/checkout/checkout.service.ts:529](../../sistema/backend/src/modules/checkout/checkout.service.ts#L529); [sistema/backend/src/modules/checkout/checkout.service.ts:184](../../sistema/backend/src/modules/checkout/checkout.service.ts#L184); [sistema/backend/src/modules/orders/orders.service.ts:363](../../sistema/backend/src/modules/orders/orders.service.ts#L363); [sistema/backend/src/modules/orders/orders.service.ts:432](../../sistema/backend/src/modules/orders/orders.service.ts#L432).

**Falha e impacto:** resolveDelivery carrega endereço do cliente, mas prioriza delivery.cep/zipCode e lat/lng arbitrários para preço/área. Pedido conserva addressId e endereço cadastrado; frete não zero segue a cotação desse outro destino. Fixture mostrou CEP enviado substituindo o CEP do endereço que será entregue.

**Condição de exploração:** Cliente escolhe endereço próprio em zona diferente e informa dados de uma zona mais barata ou atendida. Diferença depende da tabela de zonas; não foi chamada API geográfica real.

**Correção sugerida, não aplicada:**

```text
const destination = await resolveVerifiedSavedAddress(owner, addressId);
assertCoordinatesAndLocalityMatchAddress(destination, dto.delivery);
const quote = await calculateShipping(destination);
// Persistir e validar o mesmo snapshot de destino na confirmação.
```

**Aceitação da futura correção:** Endereço caro/fora da área com CEP/coordenadas de área barata é recusado ou cotado pelo endereço real; troca de endereço invalida cotação; zona, mínimo e frete usam uma fonte consistente. Distinto da recotação de produtos JON-47.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'delivery.cep|delivery.lat|delivery.lng|addressId|quotedDeliveryAmount' sistema/backend/src/modules/checkout/checkout.service.ts sistema/backend/src/modules/orders/orders.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. JON-47 trata corrida de recotação de produtos, não vínculo do destino de frete. Termos utilizados: frete, CEP, checkout, fraude; 19 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:54:01.051Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S24 — Rotas fiscais de picker ignoram revogacao do modulo de separacao

**Prioridade:** Medium · **OWASP:** A01 · **Linear:** [JON-153](https://linear.app/eojonathan/issue/JON-153/security-rotas-fiscais-de-picker-ignoram-revogacao-do-modulo-de) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/integrations/integrations.controller.ts:73](../../sistema/backend/src/modules/integrations/integrations.controller.ts#L73); [sistema/backend/src/modules/integrations/integrations.controller.ts:82](../../sistema/backend/src/modules/integrations/integrations.controller.ts#L82); [sistema/backend/src/modules/integrations/integrations.controller.ts:96](../../sistema/backend/src/modules/integrations/integrations.controller.ts#L96); [sistema/backend/src/common/guards/roles.guard.ts:30](../../sistema/backend/src/common/guards/roles.guard.ts#L30); [sistema/backend/src/common/strategies/jwt.strategy.ts:80](../../sistema/backend/src/common/strategies/jwt.strategy.ts#L80).

**Falha e impacto:** pending-invoice, invoiced e cancelled-in-erp autorizam role admin/picker sem ModuleAccessGuard. Remover picking de moduleAccess é respeitado no app picker, mas essas operações continuam aceitando conta cujo papel legado permanece picker.

**Condição de exploração:** Conta ativa com role picker, módulo picking removido e JWT ainda válido. Possibilita continuar listando fila e sinalizando faturamento/cancelamento fora da política de revogação do módulo.

**Correção sugerida, não aplicada:**

```text
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule('picking')
// Separar credencial técnica do Notificador com scopes fiscais mínimos.
// Propagar tenant/loja e permissões específicas para cada mutação.
```

**Aceitação da futura correção:** Picker sem módulo recebe 403 nas três rotas e zero escritas; picker autorizado e credencial técnica com scope explícito seguem funcionando; admin mantém permissão prevista.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'Roles|RequireModule|pending-invoice|invoiced|cancelled-in-erp' sistema/backend/src/modules/integrations/integrations.controller.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: picker, moduleAccess, permiss, invoiced; 4 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:54:08.309Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S25 — Conexao SQL do Notificador desliga criptografia e validacao de certificado

**Prioridade:** Medium · **OWASP:** A02 · **Linear:** [JON-154](https://linear.app/eojonathan/issue/JON-154/security-conexao-sql-do-notificador-desliga-criptografia-e-validacao) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [Notificador/dorsal.js:37](../../Notificador/dorsal.js#L37); [Notificador/main.js:233](../../Notificador/main.js#L233).

**Falha e impacto:** lerConfig define encrypt=false e trustServerCertificate=true para SQL Server da loja. Queries parametrizadas e somente leitura são positivas, mas transporte não exige confidencialidade nem autenticação criptográfica do servidor. Health de identity usa esse caminho quando faturamento está ligado, mesmo com polling fiscal desligado.

**Condição de exploração:** Notificador com integração DORSAL habilitada e atacante capaz de observar/alterar tráfego na rede local. Rede interna não prova ausência de adversário; nenhum banco foi acessado.

**Correção sugerida, não aplicada:**

```text
options: { encrypt: true, trustServerCertificate: false }
// Configurar certificado/CA válidos no SQL Server.
// Se legado impedir TLS: túnel autenticado/criptografado e ACL mínima,
// com migração documentada; não apenas ignorar validação.
```

**Aceitação da futura correção:** Conexão simulada/config inspecionada exige TLS e rejeita certificado inválido; conta conserva permissão somente leitura; alternativa de túnel comprova confidencialidade sem alterar consultas.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'encrypt:|trustServerCertificate:|FATURAMENTO_LIGADO|POLLING_FATURAMENTO_DESLIGADO' Notificador/dorsal.js Notificador/main.js
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: DORSAL, TLS, criptograf, Notificador; 13 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:51:02.771Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S26 — Eventos publicos de analytics e recomendacao aceitam identidade e compra forjadas

**Prioridade:** Medium · **OWASP:** A01/A04 · **Linear:** [JON-155](https://linear.app/eojonathan/issue/JON-155/security-eventos-publicos-de-analytics-e-recomendacao-aceitam) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/analytics/analytics.controller.ts:22](../../sistema/backend/src/modules/analytics/analytics.controller.ts#L22); [sistema/backend/src/modules/analytics/analytics.service.ts:147](../../sistema/backend/src/modules/analytics/analytics.service.ts#L147); [sistema/backend/src/modules/recommendations/recommendations.controller.ts:53](../../sistema/backend/src/modules/recommendations/recommendations.controller.ts#L53); [sistema/backend/src/modules/recommendations/recommendations.service.ts:184](../../sistema/backend/src/modules/recommendations/recommendations.service.ts#L184).

**Falha e impacto:** Rotas públicas gravam customerId/sessionId/orderId e tipo de evento informados pelo cliente sem prova de vínculo. Analytics aceita tenant/store no body; recomendações aceita PURCHASE e convertedAt. Dados de conversão e perfil podem ser atribuídos a outra pessoa/loja; a whitelist global não valida body:any.

**Condição de exploração:** Chamador anônimo conhece identificador ou envia eventos de conversão fabricados. Impacto confirmado é integridade de telemetria/perfil; não se afirma que isso marque pedido como pago.

**Correção sugerida, não aplicada:**

```text
const dto = validatePublicEventDto(body);
const identity = resolveVerifiedSessionOrAnonymousDevice(req);
assertPublicEventType(dto.type); // PURCHASE/ORDER_CREATED somente servidor
store({ ...allowedEventFields(dto), ...identity, ...authorizedContext });
```

**Aceitação da futura correção:** Evento anônimo não define customerId de terceiro nem PURCHASE/ORDER_CREATED; eventos de servidor derivam pedido real; limites de tamanho/lote e rate por dispositivo impedem gravação desproporcional.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'trackEvent|customerId:|tenantId:|PURCHASE|convertedAt' sistema/backend/src/modules/analytics/analytics.service.ts sistema/backend/src/modules/recommendations/recommendations.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: analytics, event, recomend, customerId; 16 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:51:07.173Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S30 — Exclusividade de tarefa de separacao pode ser contornada

**Prioridade:** Medium · **OWASP:** A01 · **Linear:** [JON-73](https://linear.app/eojonathan/issue/JON-73/security-exclusividade-de-tarefa-de-separacao-pode-ser-contornada) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/picking/picker.controller.ts:95](../../sistema/backend/src/modules/picking/picker.controller.ts#L95); [sistema/backend/src/modules/picking/picking.service.ts:312](../../sistema/backend/src/modules/picking/picking.service.ts#L312); [sistema/backend/src/modules/picking/picking.service.ts:338](../../sistema/backend/src/modules/picking/picking.service.ts#L338); [sistema/backend/src/modules/picking/picking.service.ts:1127](../../sistema/backend/src/modules/picking/picking.service.ts#L1127).

**Falha e impacto:** F29 revalidado: assignTask sobrescreve assignedToId sem condição, start faz leitura antes de claim e ensureTaskCanReceiveItems não confere responsável de tarefa IN_PROGRESS. Diferentes mutações não compartilham política de posse.

**Condição de exploração:** Dois separadores autorizados na mesma loja, conhecimento da tarefa ou corrida ao iniciar; não depende de papel admin.

**Correção sugerida, não aplicada:**

```text
claim = await updateMany({where:{id,status:'PENDING',assignedToId:null},data:{assignedToId:actor.id,status:'IN_PROGRESS'}});
if (claim.count !== 1) throw ConflictException();
assertAssignedPicker(task, actor); // toda mutação
```

**Aceitação da futura correção:** Duas partidas concorrentes têm um vencedor; B não atribui a si/edita itens de tarefa A; reatribuição administrativa explícita e auditada permanece possível.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'assignTask|assignedToId|ensureTaskCanReceiveItems' sistema/backend/src/modules/picking/picking.service.ts
```

**Deduplicação:** Equivalência confirmada com JON-73; atualizar o mesmo defeito e preservar histórico. Termos utilizados: picker, picking, tarefa, posse; 17 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:55:06.931Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S31 — Health detalhado publico amplifica consultas de integracao e divulga diagnosticos

**Prioridade:** Medium · **OWASP:** A04/A05 · **Linear:** [JON-111](https://linear.app/eojonathan/issue/JON-111/security-health-detalhado-publico-amplifica-consultas-de-integracao-e) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/integrations/health.controller.ts:31](../../sistema/backend/src/modules/integrations/health.controller.ts#L31); [sistema/backend/src/modules/integrations/health.controller.ts:38](../../sistema/backend/src/modules/integrations/health.controller.ts#L38); [sistema/backend/src/modules/integrations/health.controller.ts:134](../../sistema/backend/src/modules/integrations/health.controller.ts#L134); [sistema/backend/src/common/decorators/relaxed-throttle.decorator.ts:19](../../sistema/backend/src/common/decorators/relaxed-throttle.decorator.ts#L19).

**Falha e impacto:** F40 revalidado: endpoint sem auth dispara probes de banco/rede/ERP por chamada, sem cache ou coalescência, sob bucket default 600/min. Resposta também incorpora detail de erros/diagnósticos internos. Não houve carga ou acesso a integrações.

**Condição de exploração:** Visitante alcança /health/detail enquanto adaptadores estão configurados; custo e detalhes dependem de cada falha/provedor.

**Correção sugerida, não aplicada:**

```text
GET /health => localLivenessOnly();
GET /health/detail => requireOpsPermission();
return sanitizedCachedProbeWithSingleFlightAndDeadline();
```

**Aceitação da futura correção:** Chamadas públicas não consultam catálogo ERP nem expõem erros internos; chamadas autorizadas concorrentes compartilham probe leve limitado; detalhes com credenciais/PII são redigidos.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'UseGuards|RelaxedThrottle|Promise.allSettled|GetProdutos|detail:' sistema/backend/src/modules/integrations/health.controller.ts
```

**Deduplicação:** Equivalência confirmada com JON-111; atualizar o mesmo defeito e preservar histórico. Termos utilizados: health, saude, GetProdutos; 6 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:51:16.711Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S32 — Uploads rejeitados antes do handler deixam arquivos persistidos

**Prioridade:** Medium · **OWASP:** A04/A05 · **Linear:** [JON-113](https://linear.app/eojonathan/issue/JON-113/security-uploads-rejeitados-antes-do-handler-deixam-arquivos) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/uploads/uploads.controller.ts:80](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L80); [sistema/backend/src/modules/uploads/uploads.controller.ts:104](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L104); [sistema/backend/src/modules/uploads/uploads.controller.ts:124](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L124); [sistema/backend/src/modules/uploads/uploads.controller.ts:154](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L154); [sistema/backend/src/modules/uploads/uploads.controller.ts:206](../../sistema/backend/src/modules/uploads/uploads.controller.ts#L206).

**Falha e impacto:** F42 revalidado: Multer grava até 25MB, ParseFilePipe recusa acima de 5MB antes do handler/finally; upload de produto também rejeita MIME antes do try/finally. Arquivos rejeitados permanecem, inclusive em área pública. S08 cobre aceitação de formato ativo; este item cobre descarte de requisição rejeitada.

**Condição de exploração:** Usuário com upload/admin envia corpo entre 5 e 25MB ou MIME recusado. Risco de acúmulo/exposição de temporários; nenhum arquivo real foi enviado ou apagado.

**Correção sugerida, não aplicada:**

```text
limits: { fileSize: FINAL_UPLOAD_LIMIT, files: 1 };
// Staging fora do webroot; interceptor de cleanup cobre pipe e handler.
try { validateAndPublish(file); } finally { discardTemporaryFile(file); }
```

**Aceitação da futura correção:** Casos acima do limite, MIME inválido, erro no pipe/decoder e abort deixam zero temporários; não danificam imagem anterior; aceitos mantêm comportamento esperado.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'MAX_UPLOAD_BYTES|maxSize|mimetype|finally|diskStorage' sistema/backend/src/modules/uploads/uploads.controller.ts
```

**Deduplicação:** Equivalência confirmada com JON-113; atualizar o mesmo defeito e preservar histórico. Termos utilizados: upload, orfa, tempor, limite; 18 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:33:55.343Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S33 — Marketplace recebe novos pedidos mesmo com canal desativado

**Prioridade:** Medium · **OWASP:** A01 · **Linear:** [JON-117](https://linear.app/eojonathan/issue/JON-117/security-marketplace-recebe-novos-pedidos-mesmo-com-canal-desativado) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/marketplace/marketplace.service.ts:175](../../sistema/backend/src/modules/marketplace/marketplace.service.ts#L175); [sistema/backend/src/modules/marketplace/marketplace.service.ts:285](../../sistema/backend/src/modules/marketplace/marketplace.service.ts#L285).

**Falha e impacto:** requireChannel exige existência, mas ingestão não testa status ACTIVE. Revogar canal operacionalmente não interrompe criação de pedidos mesmo com segredo válido. Equivalente da continuação F46 da Fase 1.

**Condição de exploração:** Canal INACTIVE e credencial conhecida/válida; não depende de segredo vazio de S05.

**Correção sugerida, não aplicada:**

```text
if (channel.status !== 'ACTIVE') throw new ForbiddenException('Canal inativo');
// Revalidar antes de qualquer efeito de criação.
```

**Aceitação da futura correção:** Canal inativo com assinatura correta produz 403 e zero pedidos/clientes/reservas; ativo autenticado funciona.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'requireChannel|ingestMarketplaceOrder|channel.status' sistema/backend/src/modules/marketplace/marketplace.service.ts
```

**Deduplicação:** Equivalência confirmada com JON-117; atualizar o mesmo defeito e preservar histórico. Termos utilizados: marketplace, inativo, canal; 17 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. O corpo anterior da Fase 1 foi preservado no histórico da issue.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T14:34:02.220Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

### S27 — API publica de receitas permite consultar conteudo desativado

**Prioridade:** Low · **OWASP:** A01 · **Linear:** [JON-156](https://linear.app/eojonathan/issue/JON-156/security-api-publica-de-receitas-permite-consultar-conteudo-desativado) · **Estado:** Backlog · **Label:** Melhoria; security pendente.

**Componente/rota e evidência:** [sistema/backend/src/modules/recipes/recipes.controller.ts:58](../../sistema/backend/src/modules/recipes/recipes.controller.ts#L58); [sistema/backend/src/modules/recipes/recipes.controller.ts:69](../../sistema/backend/src/modules/recipes/recipes.controller.ts#L69); [sistema/backend/src/modules/recipes/recipes.service.ts:51](../../sistema/backend/src/modules/recipes/recipes.service.ts#L51); [sistema/backend/src/modules/recipes/recipes.service.ts:72](../../sistema/backend/src/modules/recipes/recipes.service.ts#L72).

**Falha e impacto:** Listagem pública aceita active=false; consulta pública por slug usa findUnique sem exigir active. Conteúdo removido da publicação continua recuperável sem autenticação. O conteúdo observado é CMS de receitas, por isso prioridade Low.

**Condição de exploração:** Receita desativada existe e visitante usa filtro público ou conhece slug. Não se afirma presença de dados pessoais ou segredos nesse conteúdo.

**Correção sugerida, não aplicada:**

```text
// Rotas públicas:
where: { active: true, ...safePublicFilters };
findFirst({ where: { slug, active: true } });
// Preview/listagem de inativos: rota administrativa protegida.
```

**Aceitação da futura correção:** Receita inativa não aparece em filtros públicos nem por slug (404); ativa continua visível; preview de inativos requer admin.

**Inspeção reproduzível, na raiz do repositório:**

```powershell
rg -n 'activeFilter|findBySlug|async list|where:' sistema/backend/src/modules/recipes/recipes.controller.ts sistema/backend/src/modules/recipes/recipes.service.ts
```

**Deduplicação:** Sem equivalente específico entre as 127 issues JON completas (incluindo arquivadas, hasMore=false, partial=false) e os achados da Fase 1. Coincidências temáticas não foram tratadas como equivalência. Termos utilizados: receita, recipe, active, public; 45 candidatos textuais triados. A conferência suplementar incluiu JON-128–130. Não havia issue específica equivalente; foi criada uma nova.

**Confirmação:** conteúdo, título, prioridade, projeto, estado e label conferidos por leitura posterior; último read-back registrado em 2026-09-13T05:54:31.428Z. A suíte do apêndice cobre os casos explicitamente enumerados, não todos os testes de aceitação acima.

## Dependências herdadas da Fase 1, sem duplicar defeitos

Os **27 itens D01–D27** permanecem em **25 tickets existentes**. D15/D22 compartilham JON-94 e D16/D26 compartilham JON-98. Foram preservadas prioridades, faixas de advisories, pseudocorreções e critérios de aceite da Fase 1; esta fase acrescentou classificação security e confirmação das resoluções locais. As prioridades dos 25 tickets são 2 High, 19 Medium e 4 Low.

As versões abaixo foram lidas de sete package-lock.json, sem executar código dos pacotes. Uma dependência marcada dev no lock não é automaticamente alcançável por HTTP; o Dockerfile backend conserva dependências de desenvolvimento na imagem final, o que exige separar presença, execução e exploração. Tampouco se deve tratar toda resolução listada como vulnerável sem comparar a faixa do advisory correspondente.

| Fase 1 | Pacote | Versões resolvidas nesta fotografia | Ticket / prioridade | Label / estado |
|---|---|---|---|---|
| D01 | `@babel/core` | 7.29.0, 7.29.7 | [JON-75](https://linear.app/eojonathan/issue/JON-75/security-tech-debt-atualizar-babelcore-nas-arvores-com-alertas-npm) / Low | Melhoria (security pendente) / Backlog |
| D02 | `axios` | 1.16.1, 1.19.0 | [JON-76](https://linear.app/eojonathan/issue/JON-76/security-tech-debt-atualizar-axios-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D03 | `baseline-browser-mapping` | 2.10.19, 2.11.7 | [JON-77](https://linear.app/eojonathan/issue/JON-77/security-tech-debt-atualizar-baseline-browser-mapping-nas-arvores-com) / Low | Melhoria (security pendente) / Backlog |
| D04 | `body-parser` | 2.2.2 | [JON-78](https://linear.app/eojonathan/issue/JON-78/security-tech-debt-atualizar-body-parser-nas-arvores-com-alertas-npm) / Medium | Melhoria (security pendente) / Backlog |
| D05 | `brace-expansion` | 1.1.14, 2.1.0, 1.1.15, 5.0.6, 2.1.1 | [JON-79](https://linear.app/eojonathan/issue/JON-79/security-tech-debt-atualizar-brace-expansion-nas-arvores-com-alertas) / Medium | Melhoria (security pendente) / Backlog |
| D06 | `browserslist` | 4.28.2, 4.28.7 | [JON-80](https://linear.app/eojonathan/issue/JON-80/security-tech-debt-atualizar-browserslist-nas-arvores-com-alertas-npm) / Medium | Melhoria (security pendente) / Backlog |
| D07 | `fast-uri` | 3.1.2 | [JON-81](https://linear.app/eojonathan/issue/JON-81/security-tech-debt-atualizar-fast-uri-nas-arvores-com-alertas-npm) / Medium | Melhoria (security pendente) / Backlog |
| D08 | `form-data` | 4.0.5, 4.0.6 | [JON-82](https://linear.app/eojonathan/issue/JON-82/security-tech-debt-atualizar-form-data-nas-arvores-com-alertas-npm) / Medium | Melhoria (security pendente) / Backlog |
| D09 | `js-yaml` | 3.14.2, 4.1.1 | [JON-83](https://linear.app/eojonathan/issue/JON-83/security-tech-debt-atualizar-js-yaml-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D10 | `multer` | 2.1.1 | [JON-84](https://linear.app/eojonathan/issue/JON-84/security-tech-debt-atualizar-multer-nas-arvores-com-alertas-npm-audit) / High | Melhoria (security pendente) / Backlog |
| D11 | `qs` | 6.15.2 | [JON-85](https://linear.app/eojonathan/issue/JON-85/security-tech-debt-atualizar-qs-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D12 | `sharp` | 0.34.5 | [JON-86](https://linear.app/eojonathan/issue/JON-86/security-tech-debt-atualizar-sharp-nas-arvores-com-alertas-npm-audit) / High | Melhoria (security pendente) / Backlog |
| D13 | `socket.io-parser` | 4.2.6 | [JON-87](https://linear.app/eojonathan/issue/JON-87/security-tech-debt-atualizar-socketio-parser-nas-arvores-com-alertas) / Medium | Melhoria (security pendente) / Backlog |
| D14 | `ws` | 8.20.1 | [JON-88](https://linear.app/eojonathan/issue/JON-88/security-tech-debt-atualizar-ws-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D15 | `@remix-run/router` | 1.23.2 | [JON-94](https://linear.app/eojonathan/issue/JON-94/security-tech-debt-atualizar-familia-react-router-e-dependencias) / Medium | Melhoria (security pendente) / Backlog |
| D16 | `@vitest/mocker` | 4.1.5, 4.1.11 | [JON-98](https://linear.app/eojonathan/issue/JON-98/security-tech-debt-atualizar-vitest-e-mocker-afetados-pelo-mesmo) / Medium | Melhoria (security pendente) / Backlog |
| D17 | `esbuild` | 0.27.7, 0.28.1 | [JON-89](https://linear.app/eojonathan/issue/JON-89/security-tech-debt-atualizar-esbuild-nas-arvores-com-alertas-npm-audit) / Low | Melhoria (security pendente) / Backlog |
| D18 | `joi` | 18.1.2 | [JON-90](https://linear.app/eojonathan/issue/JON-90/security-tech-debt-atualizar-joi-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D19 | `nanoid` | 3.3.11, 3.3.16 | [JON-91](https://linear.app/eojonathan/issue/JON-91/security-tech-debt-atualizar-nanoid-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D20 | `postcss` | 8.5.10, 8.5.25 | [JON-92](https://linear.app/eojonathan/issue/JON-92/security-tech-debt-atualizar-postcss-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D21 | `postcss-selector-parser` | 6.1.2, 6.1.4 | [JON-93](https://linear.app/eojonathan/issue/JON-93/security-tech-debt-atualizar-postcss-selector-parser-nas-arvores-com) / Low | Melhoria (security pendente) / Backlog |
| D22 | `react-router` | 6.30.3 | [JON-94](https://linear.app/eojonathan/issue/JON-94/security-tech-debt-atualizar-familia-react-router-e-dependencias) / Medium | Melhoria (security pendente) / Backlog |
| D23 | `react-router-dom` | 6.30.3 | [JON-95](https://linear.app/eojonathan/issue/JON-95/security-tech-debt-atualizar-react-router-dom-nas-arvores-com-alertas) / Medium | Melhoria (security pendente) / Backlog |
| D24 | `undici` | 7.25.0, 7.29.0 | [JON-96](https://linear.app/eojonathan/issue/JON-96/security-tech-debt-atualizar-undici-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D25 | `vite` | 7.3.3, 7.3.6 | [JON-97](https://linear.app/eojonathan/issue/JON-97/security-tech-debt-atualizar-vite-nas-arvores-com-alertas-npm-audit) / Medium | Melhoria (security pendente) / Backlog |
| D26 | `vitest` | 4.1.5, 4.1.11 | [JON-98](https://linear.app/eojonathan/issue/JON-98/security-tech-debt-atualizar-vitest-e-mocker-afetados-pelo-mesmo) / Medium | Melhoria (security pendente) / Backlog |
| D27 | `shell-quote` | 1.8.3 | [JON-99](https://linear.app/eojonathan/issue/JON-99/security-tech-debt-atualizar-shell-quote-nas-arvores-com-alertas-npm) / Medium | Melhoria (security pendente) / Backlog |

### Resoluções nos sete lockfiles

| Lockfile | Pacote | Caminho na árvore | Versão | dev no lock |
|---|---|---|---|---|
| `sistema/backend/package-lock.json` | `@babel/core` | `node_modules/@babel/core` | 7.29.0 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/@eslint/eslintrc/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/@humanwhocodes/config-array/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `js-yaml` | `node_modules/@istanbuljs/load-nyc-config/node_modules/js-yaml` | 3.14.2 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/@jest/reporters/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `axios` | `node_modules/axios` | 1.16.1 | não |
| `sistema/backend/package-lock.json` | `baseline-browser-mapping` | `node_modules/baseline-browser-mapping` | 2.10.19 | sim |
| `sistema/backend/package-lock.json` | `body-parser` | `node_modules/body-parser` | 2.2.2 | não |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/brace-expansion` | 2.1.0 | sim |
| `sistema/backend/package-lock.json` | `browserslist` | `node_modules/browserslist` | 4.28.2 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/eslint/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `fast-uri` | `node_modules/fast-uri` | 3.1.2 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/fork-ts-checker-webpack-plugin/node_modules/brace-expansion` | 1.1.15 | sim |
| `sistema/backend/package-lock.json` | `form-data` | `node_modules/form-data` | 4.0.5 | não |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/glob/node_modules/brace-expansion` | 5.0.6 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/jest-config/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/jest-runtime/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `js-yaml` | `node_modules/js-yaml` | 4.1.1 | não |
| `sistema/backend/package-lock.json` | `multer` | `node_modules/multer` | 2.1.1 | não |
| `sistema/backend/package-lock.json` | `qs` | `node_modules/qs` | 6.15.2 | não |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/rimraf/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `sharp` | `node_modules/sharp` | 0.34.5 | não |
| `sistema/backend/package-lock.json` | `socket.io-parser` | `node_modules/socket.io-parser` | 4.2.6 | não |
| `sistema/backend/package-lock.json` | `brace-expansion` | `node_modules/test-exclude/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/backend/package-lock.json` | `ws` | `node_modules/ws` | 8.20.1 | não |
| `sistema/frontend/package-lock.json` | `@babel/core` | `node_modules/@babel/core` | 7.29.0 | sim |
| `sistema/frontend/package-lock.json` | `brace-expansion` | `node_modules/@eslint/eslintrc/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/frontend/package-lock.json` | `brace-expansion` | `node_modules/@humanwhocodes/config-array/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/frontend/package-lock.json` | `@remix-run/router` | `node_modules/@remix-run/router` | 1.23.2 | não |
| `sistema/frontend/package-lock.json` | `axios` | `node_modules/axios` | 1.16.1 | não |
| `sistema/frontend/package-lock.json` | `baseline-browser-mapping` | `node_modules/baseline-browser-mapping` | 2.10.19 | sim |
| `sistema/frontend/package-lock.json` | `brace-expansion` | `node_modules/brace-expansion` | 2.1.1 | sim |
| `sistema/frontend/package-lock.json` | `browserslist` | `node_modules/browserslist` | 4.28.2 | sim |
| `sistema/frontend/package-lock.json` | `esbuild` | `node_modules/esbuild` | 0.27.7 | sim |
| `sistema/frontend/package-lock.json` | `brace-expansion` | `node_modules/eslint/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/frontend/package-lock.json` | `form-data` | `node_modules/form-data` | 4.0.5 | não |
| `sistema/frontend/package-lock.json` | `brace-expansion` | `node_modules/glob/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/frontend/package-lock.json` | `joi` | `node_modules/joi` | 18.1.2 | sim |
| `sistema/frontend/package-lock.json` | `js-yaml` | `node_modules/js-yaml` | 4.1.1 | sim |
| `sistema/frontend/package-lock.json` | `nanoid` | `node_modules/nanoid` | 3.3.11 | sim |
| `sistema/frontend/package-lock.json` | `postcss` | `node_modules/postcss` | 8.5.10 | sim |
| `sistema/frontend/package-lock.json` | `postcss-selector-parser` | `node_modules/postcss-selector-parser` | 6.1.2 | sim |
| `sistema/frontend/package-lock.json` | `qs` | `node_modules/qs` | 6.15.2 | sim |
| `sistema/frontend/package-lock.json` | `react-router` | `node_modules/react-router` | 6.30.3 | não |
| `sistema/frontend/package-lock.json` | `react-router-dom` | `node_modules/react-router-dom` | 6.30.3 | não |
| `sistema/frontend/package-lock.json` | `undici` | `node_modules/undici` | 7.25.0 | sim |
| `sistema/frontend/package-lock.json` | `vite` | `node_modules/vite` | 7.3.3 | sim |
| `sistema/frontend/package-lock.json` | `vitest` | `node_modules/vitest` | 4.1.5 | sim |
| `sistema/frontend/package-lock.json` | `@vitest/mocker` | `node_modules/vitest/node_modules/@vitest/mocker` | 4.1.5 | sim |
| `sistema/admin/package-lock.json` | `@babel/core` | `node_modules/@babel/core` | 7.29.0 | sim |
| `sistema/admin/package-lock.json` | `brace-expansion` | `node_modules/@eslint/eslintrc/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/admin/package-lock.json` | `brace-expansion` | `node_modules/@humanwhocodes/config-array/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/admin/package-lock.json` | `@remix-run/router` | `node_modules/@remix-run/router` | 1.23.2 | não |
| `sistema/admin/package-lock.json` | `@vitest/mocker` | `node_modules/@vitest/mocker` | 4.1.11 | sim |
| `sistema/admin/package-lock.json` | `axios` | `node_modules/axios` | 1.16.1 | não |
| `sistema/admin/package-lock.json` | `baseline-browser-mapping` | `node_modules/baseline-browser-mapping` | 2.10.19 | sim |
| `sistema/admin/package-lock.json` | `brace-expansion` | `node_modules/brace-expansion` | 2.1.1 | sim |
| `sistema/admin/package-lock.json` | `browserslist` | `node_modules/browserslist` | 4.28.2 | sim |
| `sistema/admin/package-lock.json` | `esbuild` | `node_modules/esbuild` | 0.27.7 | sim |
| `sistema/admin/package-lock.json` | `brace-expansion` | `node_modules/eslint/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/admin/package-lock.json` | `form-data` | `node_modules/form-data` | 4.0.5 | não |
| `sistema/admin/package-lock.json` | `brace-expansion` | `node_modules/glob/node_modules/brace-expansion` | 1.1.14 | sim |
| `sistema/admin/package-lock.json` | `joi` | `node_modules/joi` | 18.1.2 | sim |
| `sistema/admin/package-lock.json` | `js-yaml` | `node_modules/js-yaml` | 4.1.1 | sim |
| `sistema/admin/package-lock.json` | `nanoid` | `node_modules/nanoid` | 3.3.11 | sim |
| `sistema/admin/package-lock.json` | `postcss` | `node_modules/postcss` | 8.5.10 | sim |
| `sistema/admin/package-lock.json` | `postcss-selector-parser` | `node_modules/postcss-selector-parser` | 6.1.2 | sim |
| `sistema/admin/package-lock.json` | `qs` | `node_modules/qs` | 6.15.2 | sim |
| `sistema/admin/package-lock.json` | `react-router` | `node_modules/react-router` | 6.30.3 | não |
| `sistema/admin/package-lock.json` | `react-router-dom` | `node_modules/react-router-dom` | 6.30.3 | não |
| `sistema/admin/package-lock.json` | `vite` | `node_modules/vite` | 7.3.3 | sim |
| `sistema/admin/package-lock.json` | `vitest` | `node_modules/vitest` | 4.1.11 | sim |
| `sistema/picking-app/package-lock.json` | `@babel/core` | `node_modules/@babel/core` | 7.29.7 | sim |
| `sistema/picking-app/package-lock.json` | `axios` | `node_modules/axios` | 1.19.0 | não |
| `sistema/picking-app/package-lock.json` | `baseline-browser-mapping` | `node_modules/baseline-browser-mapping` | 2.11.7 | sim |
| `sistema/picking-app/package-lock.json` | `browserslist` | `node_modules/browserslist` | 4.28.7 | sim |
| `sistema/picking-app/package-lock.json` | `esbuild` | `node_modules/esbuild` | 0.28.1 | sim |
| `sistema/picking-app/package-lock.json` | `form-data` | `node_modules/form-data` | 4.0.6 | não |
| `sistema/picking-app/package-lock.json` | `nanoid` | `node_modules/nanoid` | 3.3.16 | sim |
| `sistema/picking-app/package-lock.json` | `postcss` | `node_modules/postcss` | 8.5.25 | sim |
| `sistema/picking-app/package-lock.json` | `postcss-selector-parser` | `node_modules/postcss-selector-parser` | 6.1.4 | sim |
| `sistema/picking-app/package-lock.json` | `vite` | `node_modules/vite` | 7.3.6 | sim |
| `sistema/delivery-app/package-lock.json` | `@babel/core` | `node_modules/@babel/core` | 7.29.7 | sim |
| `sistema/delivery-app/package-lock.json` | `axios` | `node_modules/axios` | 1.19.0 | não |
| `sistema/delivery-app/package-lock.json` | `baseline-browser-mapping` | `node_modules/baseline-browser-mapping` | 2.11.7 | sim |
| `sistema/delivery-app/package-lock.json` | `browserslist` | `node_modules/browserslist` | 4.28.7 | sim |
| `sistema/delivery-app/package-lock.json` | `esbuild` | `node_modules/esbuild` | 0.28.1 | sim |
| `sistema/delivery-app/package-lock.json` | `form-data` | `node_modules/form-data` | 4.0.6 | não |
| `sistema/delivery-app/package-lock.json` | `nanoid` | `node_modules/nanoid` | 3.3.16 | sim |
| `sistema/delivery-app/package-lock.json` | `postcss` | `node_modules/postcss` | 8.5.25 | sim |
| `sistema/delivery-app/package-lock.json` | `postcss-selector-parser` | `node_modules/postcss-selector-parser` | 6.1.4 | sim |
| `sistema/delivery-app/package-lock.json` | `vite` | `node_modules/vite` | 7.3.6 | sim |
| `sistema/package-lock.json` | `shell-quote` | `node_modules/shell-quote` | 1.8.3 | sim |
| `Notificador/package-lock.json` | `undici` | `node_modules/undici` | 7.29.0 | não |

## Controles de segurança existentes e hipóteses não promovidas a falha

- Senhas usam bcrypt; recuperação usa entropia criptográfica, hash do token e TTL de uma hora. A correção deve preservar essas propriedades e tornar o consumo atômico, conforme o [guia OWASP de recuperação de senha](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
- A estratégia JWT recusa cliente bloqueado e conta de equipe desativada; roles/moduleAccess são consultados no cadastro atual. Teste positivo confirmou bloqueio do cliente. A duração de 30 dias é requisito conhecido; o defeito é não encerrar sessões em eventos de segurança, conforme os eventos discutidos no [guia OWASP de sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- HMAC de pagamentos com segredo presente aceitou mensagem correta e rejeitou adulteração na prova sintética. Guard de AntenorApi falha fechado na ausência de segredo e usa comparação constante. Falta de rawBody no bootstrap merece ajuste para preservar os bytes assinados, incluído na correção S03; isso não foi contado como novo defeito separado de segurança.
- ValidationPipe global ativa whitelist, forbidNonWhitelisted e transform. DTOs concretos de autenticação/checkout são úteis; objetos sem metadados não recebem automaticamente a mesma proteção.
- Consultas SQL inspecionadas usam parâmetros. A ausência de queries unsafe no resultado da busca não substitui revisão de todas as construções de SQL em futuras mudanças.
- Fluxo de produto reencoda imagem com Sharp, limita dimensões/pixels e valida identificadores usados no nome; precisa corrigir os fluxos genérico e de rejeição descritos.
- Manifest prod dedicado não publica banco/busca diretamente, exige variáveis sensíveis, usa rede interna e expõe Caddy. O backend executa com usuário dedicado; dockerignore exclui arquivos de ambiente. Não foi verificada imagem implantada.
- Notificador mantém contextIsolation, CSP restritiva e ponte preload delimitada; renderer escapa conteúdo inserido em HTML. AntenorApi exige validação TLS/CA na configuração HTTPS. O SQL legado tem a exceção confirmada em S25.
- Integrações não ignoram indiscriminadamente todos os buckets do Throttler; foram conferidos SkipThrottle por nome e comportamento da biblioteca instalada. Não foi criado ticket por uma suposta ausência geral de rate limit.
- JON-39 (sanitização de GET /customers) e JON-43 (proteção de /pricing/quote) não foram reabertas: os trechos corrigidos permanecem protegidos. JON-71 cobre vazamentos em outras projeções. Relatórios gerais JON-31/JON-42 não substituíram defeitos específicos.

### Dados sensíveis versionados

A varredura inicial de padrões de segredo avaliou 776 arquivos textuais entre 868 rastreados e encontrou a chave privada local S20. A conferência posterior de formatos/checksum avaliou 782 arquivos textuais entre 872 rastreados: 15 ocorrências candidatas a CPF/CNPJ em fixtures/documentação/configuração pública. A validade de formato/checksum não comprova titular real; ocorrências de teste não foram classificadas como vazamento pessoal confirmado. Três referências de CNPJ institucional aparecem em brand.service.ts e páginas de termos/privacidade; dados empresariais públicos não foram tratados automaticamente como segredo. **Nenhum valor foi copiado para este relatório ou tickets.**

Arquivos .env reais não foram exportados nem listados em conteúdo. Exemplos versionados, caminhos e nomes de variáveis foram suficientes para avaliar defaults; valores conhecidos do Compose foram processados em memória apenas no ensaio S15. Não foi feito saneamento de histórico nem rotação de material.

## Inventário estrutural dos endpoints

Fotografia: **2026-09-13T14:48:53.353Z**, HEAD **1ad50ea31862dc0fb1ba35b2de95d54bee1b2bbf**. O backend não define prefixo global Nest; os caminhos abaixo são os declarados pelos controllers. Proxies dos apps podem acrescentar /api e removê-lo antes do upstream. Não são URLs para testar produção.

Classificação por decoração: **324 operações com JwtAuthGuard, 4 com PublicApiKeyGuard, 2 com guard HMAC e 68 sem guard de autenticação reconhecido pelo extrator**. Estas 68 incluem rotas intencionalmente públicas e marketplace, que verifica segredo no serviço; o número não significa 68 vulnerabilidades. Há **101 ocorrências de TenantAccessGuard, 23 de PermissionGuard e 25 de ModuleAccessGuard** aplicadas a operações. Guard presente não prova posse, projeção segura ou contexto correto.

### Contagem por arquivo declarador

| Código | Arquivo | HTTP | Sem guard reconhecido | JWT | API key | HMAC | Tenant | Permission | Module |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| C01 | `sistema/backend/src/modules/uploads/uploads.controller.ts` | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| C02 | `sistema/backend/src/modules/data-privacy/data-privacy.controller.ts` | 5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| C03 | `sistema/backend/src/modules/recommendations/recommendations.controller.ts` | 6 | 4 | 2 | 0 | 0 | 0 | 0 | 0 |
| C04 | `sistema/backend/src/modules/recipes/recipes.controller.ts` | 9 | 3 | 6 | 0 | 0 | 0 | 0 | 0 |
| C05 | `sistema/backend/src/modules/customers/customers.controller.ts` | 8 | 0 | 8 | 0 | 0 | 0 | 0 | 0 |
| C06 | `sistema/backend/src/modules/public-api/public-api.controller.ts` | 12 | 0 | 8 | 4 | 0 | 0 | 0 | 0 |
| C07 | `sistema/backend/src/modules/crm/crm.controller.ts` | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| C08 | `sistema/backend/src/modules/coupons/coupons.controller.ts` | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| C09 | `sistema/backend/src/modules/promotions/promotions.controller.ts` | 7 | 2 | 5 | 0 | 0 | 0 | 0 | 0 |
| C10 | `sistema/backend/src/modules/brand/brand.controller.ts` | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| C11 | `sistema/backend/src/modules/cms/store-banners/store-banners.controller.ts` | 8 | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| C12 | `sistema/backend/src/modules/cms/promo-banners/promo-banners.controller.ts` | 5 | 1 | 4 | 0 | 0 | 0 | 0 | 0 |
| C13 | `sistema/backend/src/modules/cms/hero-slides/hero-slides.controller.ts` | 4 | 1 | 3 | 0 | 0 | 0 | 0 | 0 |
| C14 | `sistema/backend/src/modules/notifications/notifications.controller.ts` | 17 | 0 | 17 | 0 | 0 | 0 | 0 | 0 |
| C15 | `sistema/backend/src/modules/cms/categories/categories.controller.ts` | 8 | 2 | 6 | 0 | 0 | 0 | 0 | 0 |
| C16 | `sistema/backend/src/modules/analytics/analytics.controller.ts` | 22 | 2 | 20 | 0 | 0 | 0 | 0 | 0 |
| C17 | `sistema/backend/src/modules/auth/auth.controller.ts` | 14 | 8 | 6 | 0 | 0 | 0 | 0 | 0 |
| C18 | `sistema/backend/src/modules/products/products.controller.ts` | 25 | 7 | 18 | 0 | 0 | 1 | 1 | 0 |
| C19 | `sistema/backend/src/modules/categories/categories.controller.ts` | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| C20 | `sistema/backend/src/modules/categories/admin-categories.controller.ts` | 16 | 0 | 16 | 0 | 0 | 0 | 0 | 0 |
| C21 | `sistema/backend/src/modules/integrations/integrations.controller.ts` | 48 | 0 | 46 | 0 | 2 | 0 | 0 | 0 |
| C22 | `sistema/backend/src/modules/integrations/health.controller.ts` | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| C23 | `sistema/backend/src/modules/products/admin-products.controller.ts` | 5 | 0 | 5 | 0 | 0 | 5 | 4 | 0 |
| C24 | `sistema/backend/src/modules/delivery/delivery.controller.ts` | 25 | 5 | 20 | 0 | 0 | 13 | 0 | 0 |
| C25 | `sistema/backend/src/modules/catalog/catalog.controller.ts` | 5 | 0 | 5 | 0 | 0 | 5 | 5 | 0 |
| C26 | `sistema/backend/src/modules/delivery/driver.controller.ts` | 8 | 0 | 8 | 0 | 0 | 8 | 0 | 8 |
| C27 | `sistema/backend/src/modules/picking/picking.controller.ts` | 15 | 0 | 15 | 0 | 0 | 15 | 0 | 0 |
| C28 | `sistema/backend/src/modules/picking/picker.controller.ts` | 17 | 0 | 17 | 0 | 0 | 17 | 0 | 17 |
| C29 | `sistema/backend/src/modules/marketplace/marketplace.controller.ts` | 7 | 1 | 6 | 0 | 0 | 0 | 0 | 0 |
| C30 | `sistema/backend/src/modules/observability/observability.controller.ts` | 5 | 1 | 4 | 0 | 0 | 0 | 0 | 0 |
| C31 | `sistema/backend/src/modules/checkout/cart.controller.ts` | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| C32 | `sistema/backend/src/modules/checkout/checkout.controller.ts` | 5 | 4 | 1 | 0 | 0 | 1 | 0 | 0 |
| C33 | `sistema/backend/src/modules/inventory/inventory.controller.ts` | 10 | 2 | 8 | 0 | 0 | 7 | 7 | 0 |
| C34 | `sistema/backend/src/modules/addresses/addresses.controller.ts` | 6 | 1 | 5 | 0 | 0 | 0 | 0 | 0 |
| C35 | `sistema/backend/src/modules/orders/orders.controller.ts` | 20 | 0 | 20 | 0 | 0 | 11 | 0 | 0 |
| C36 | `sistema/backend/src/modules/pricing/pricing.controller.ts` | 7 | 0 | 7 | 0 | 0 | 6 | 6 | 0 |
| C37 | `sistema/backend/src/modules/business/business.controller.ts` | 13 | 0 | 13 | 0 | 0 | 12 | 0 | 0 |
| C38 | `sistema/backend/src/app.module.ts` | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

### Relação completa de operações

Códigos Cxx remetem aos arquivos acima. Cada linha mantém caminho, handler e declarações de segurança da classe/handler; resolução dinâmica ou validação dentro do serviço exige a leitura semântica descrita nos achados. SkipThrottle/Throttle abaixo são metadados por bucket, não uma afirmação de ausência total de limites.

| Nº | Arquivo:linha | Operação / handler | Guards e política declarada |
|---:|---|---|---|
| 1 | C01:73 | `POST /uploads` — `uploadFile` | `SkipThrottle({ auth: true, checkout: true, webhook: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 2 | C01:117 | `POST /uploads` — `uploadProductImage` | `SkipThrottle({ auth: true, checkout: true, webhook: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 3 | C01:217 | `DELETE /uploads` — `deleteProductImage` | `SkipThrottle({ auth: true, checkout: true, webhook: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 4 | C03:17 | `GET /recommendations/rebuy` — `getRebuy` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 5 | C03:27 | `GET /recommendations/complementary/:productId` — `getComplementary` | `RelaxedThrottle()` |
| 6 | C03:34 | `GET /recommendations/substitutes/:productId` — `getSubstitutes` | `RelaxedThrottle()` |
| 7 | C03:41 | `GET /recommendations/showcase` — `getShowcase` | `RelaxedThrottle()` |
| 8 | C03:53 | `POST /recommendations/events` — `recordEvent` | `RelaxedThrottle()` |
| 9 | C03:62 | `GET /recommendations/operational-insights` — `getOperationalInsights` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 10 | C04:30 | `GET /recipes/categories` — `listCategories` | `RelaxedThrottle()` |
| 11 | C04:35 | `POST /recipes/categories` — `createCategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 12 | C04:42 | `PUT /recipes/categories/:id` — `updateCategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 13 | C04:49 | `DELETE /recipes/categories/:id` — `deleteCategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 14 | C04:58 | `GET /recipes` — `list` | `RelaxedThrottle()` |
| 15 | C04:69 | `GET /recipes/:slug` — `findBySlug` | `RelaxedThrottle()` |
| 16 | C04:74 | `POST /recipes` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 17 | C04:81 | `PUT /recipes/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 18 | C04:88 | `DELETE /recipes/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 19 | C05:20 | `GET /customers` — `findAll` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 20 | C05:45 | `GET /customers/analytics/origin` — `getOriginAnalytics` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 21 | C05:56 | `GET /customers/:id` — `findOne` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()` |
| 22 | C05:81 | `POST /customers` — `create` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 23 | C05:99 | `PUT /customers/:id` — `update` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 24 | C05:118 | `PATCH /customers/:id/block` — `setBlocked` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 25 | C05:129 | `POST /customers/:id/reset-link` — `generateResetLink` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 26 | C05:140 | `DELETE /customers/:id` — `remove` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 27 | C08:16 | `GET /coupons/:code/availability` — `availability` | `RelaxedThrottle()` |
| 28 | C08:25 | `GET /coupons/validate` — `validate` | `RelaxedThrottle()` |
| 29 | C08:37 | `POST /coupons/validate` — `validatePost` | `RelaxedThrottle()` |
| 30 | C36:17 | `POST /pricing/quote` — `quote` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 31 | C36:43 | `GET /admin/price-lists` — `list` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('pricing.read')`; `UseGuards(PermissionGuard)` |
| 32 | C36:50 | `POST /admin/price-lists` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('pricing.write')`; `UseGuards(PermissionGuard)` |
| 33 | C36:57 | `POST /admin/price-lists/:id/items/bulk` — `bulkItems` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('pricing.write')`; `UseGuards(PermissionGuard)` |
| 34 | C36:72 | `GET /admin/promotions` — `list` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('promotions.read')`; `UseGuards(PermissionGuard)` |
| 35 | C36:79 | `POST /admin/promotions` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('promotions.write')`; `UseGuards(PermissionGuard)` |
| 36 | C36:86 | `POST /admin/promotions/:id/simulate` — `simulate` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('promotions.read')`; `UseGuards(PermissionGuard)` |
| 37 | C37:17 | `GET /business/customers/:customerId/context` — `getCustomerContext` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 38 | C37:31 | `GET /admin/business-accounts` — `list` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 39 | C37:36 | `POST /admin/business-accounts` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 40 | C37:41 | `GET /admin/business-accounts/approvals/pending` — `approvals` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 41 | C37:46 | `POST /admin/business-accounts/orders/:orderId/approve` — `approveOrder` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 42 | C37:51 | `POST /admin/business-accounts/orders/:orderId/billing` — `billOrder` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 43 | C37:56 | `POST /admin/business-accounts/:id/users` — `addUser` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 44 | C37:61 | `GET /admin/business-accounts/:id/shopping-lists` — `shoppingLists` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 45 | C37:66 | `POST /admin/business-accounts/:id/shopping-lists` — `createShoppingList` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 46 | C37:71 | `POST /admin/business-accounts/:id/recurring-orders` — `createRecurringOrder` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 47 | C37:76 | `POST /admin/business-accounts/:id/billing/run` — `runBilling` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 48 | C37:81 | `GET /admin/business-accounts/:id/financial` — `financial` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 49 | C37:86 | `POST /admin/business-accounts/:id/price-list` — `createPriceList` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 50 | C30:15 | `GET /observability/metrics` — `metrics` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 51 | C30:24 | `GET /observability/metrics/prometheus` — `prometheus` | `RelaxedThrottle()` |
| 52 | C30:31 | `POST /observability/alerts/check` — `checkAlerts` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 53 | C30:40 | `GET /observability/status-page` — `statusPage` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 54 | C30:49 | `GET /observability/runbooks` — `runbooks` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 55 | C06:20 | `GET /v1/orders` — `listOrders` | `RelaxedThrottle()`; `UseGuards(PublicApiKeyGuard)`; `RequireApiScope('orders.read')` |
| 56 | C06:29 | `GET /v1/orders/:id` — `getOrder` | `RelaxedThrottle()`; `UseGuards(PublicApiKeyGuard)`; `RequireApiScope('orders.read')` |
| 57 | C06:36 | `GET /v1/products` — `listProducts` | `RelaxedThrottle()`; `UseGuards(PublicApiKeyGuard)`; `RequireApiScope('products.read')` |
| 58 | C06:44 | `GET /v1/stock` — `listStock` | `RelaxedThrottle()`; `UseGuards(PublicApiKeyGuard)`; `RequireApiScope('stock.read')` |
| 59 | C06:63 | `GET /integrations/public-api/clients` — `listClients` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 60 | C06:69 | `POST /integrations/public-api/clients` — `createClient` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 61 | C06:75 | `GET /integrations/public-api/webhook-endpoints` — `listWebhookEndpoints` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 62 | C06:81 | `POST /integrations/public-api/webhook-endpoints` — `createWebhookEndpoint` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 63 | C06:87 | `POST /integrations/public-api/webhook-events` — `emitWebhookEvent` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 64 | C06:93 | `GET /integrations/public-api/webhook-deliveries` — `listWebhookDeliveries` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 65 | C06:106 | `POST /integrations/public-api/webhook-deliveries/run` — `runWebhookDeliveries` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 66 | C06:112 | `POST /integrations/public-api/webhook-deliveries/:deliveryId/replay` — `replayWebhookDelivery` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 67 | C09:13 | `GET /promotions/campaigns/active` — `findActive` | `RelaxedThrottle()` |
| 68 | C09:23 | `GET /promotions/campaigns/by-erp/:erpCampaignId` — `findOneByErpId` | `RelaxedThrottle()` |
| 69 | C09:28 | `GET /promotions/campaigns` — `findAllAdmin` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 70 | C09:35 | `POST /promotions/campaigns/sync` — `syncFromERP` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 71 | C09:42 | `POST /promotions/campaigns/expire` — `expireCampaigns` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 72 | C09:49 | `PATCH /promotions/campaigns/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 73 | C09:58 | `DELETE /promotions/campaigns/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 74 | C25:19 | `GET /admin/catalog/quality` — `getQuality` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.read')`; `UseGuards(PermissionGuard)` |
| 75 | C25:26 | `GET /admin/catalog/issues` — `getIssues` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.read')`; `UseGuards(PermissionGuard)` |
| 76 | C25:42 | `POST /admin/catalog/issues/:id/resolve` — `resolveIssue` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write')`; `UseGuards(PermissionGuard)` |
| 77 | C25:61 | `POST /admin/categories/rebuild-tree` — `rebuildTree` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write')`; `UseGuards(PermissionGuard)` |
| 78 | C25:76 | `POST /admin/search/reindex` — `reindex` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write')`; `UseGuards(PermissionGuard)` |
| 79 | C31:12 | `POST /cart` — `create` | `RelaxedThrottle()` |
| 80 | C31:17 | `GET /cart/:id` — `findOne` | `RelaxedThrottle()` |
| 81 | C31:22 | `POST /cart/:id/items` — `addItem` | `RelaxedThrottle()` |
| 82 | C31:27 | `PATCH /cart/:id/items/:itemId` — `updateItem` | `RelaxedThrottle()` |
| 83 | C31:37 | `DELETE /cart/:id/items/:itemId` — `deleteItem` | `RelaxedThrottle()` |
| 84 | C32:17 | `POST /checkout/sessions` — `create` | `Throttle({ checkout: { limit: 30, ttl: 60000 } })` |
| 85 | C32:23 | `POST /checkout/sessions/:id/quote` — `quote` | `Throttle({ checkout: { limit: 60, ttl: 60000 } })` |
| 86 | C32:29 | `POST /checkout/sessions/:id/confirm` — `confirm` | `Throttle({ checkout: { limit: 20, ttl: 60000 } })` |
| 87 | C32:39 | `POST /checkout/sessions/:id/cancel` — `cancel` | `Throttle({ checkout: { limit: 30, ttl: 60000 } })` |
| 88 | C32:53 | `POST /admin/checkout/jobs/abandon-carts` — `abandonCarts` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 89 | C10:19 | `GET /brand` — `get` | `RelaxedThrottle()` |
| 90 | C10:24 | `PUT /brand` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 91 | C07:19 | `GET /crm/customers/:customerId/relationship` — `getRelationship` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 92 | C07:26 | `POST /crm/customers/:customerId/profile` — `upsertProfile` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 93 | C07:33 | `POST /crm/customers/:customerId/consents` — `upsertConsent` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()` |
| 94 | C07:43 | `POST /crm/segments/refresh` — `refreshSegments` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 95 | C07:50 | `POST /crm/customers/:customerId/loyalty/credit` — `creditLoyalty` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 96 | C07:57 | `POST /crm/customers/:customerId/loyalty/redeem` — `redeemLoyalty` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 97 | C07:68 | `GET /crm/customers/:customerId/loyalty` — `getLoyalty` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()` |
| 98 | C07:75 | `POST /crm/campaigns` — `createCampaign` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 99 | C07:82 | `POST /crm/campaigns/:campaignId/dispatch` — `dispatchCampaign` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()`; `Roles('admin')` |
| 100 | C07:89 | `POST /crm/customers/:customerId/shopping-lists` — `createShoppingList` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()` |
| 101 | C07:96 | `POST /crm/customers/:customerId/shopping-lists/from-order` — `createShoppingListFromOrder` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()` |
| 102 | C07:103 | `GET /crm/customers/:customerId/reorder/:orderId` — `getReorderPayload` | `UseGuards(JwtAuthGuard, RolesGuard)`; `RelaxedThrottle()` |
| 103 | C21:38 | `GET /integrations/antenorapi/clientes/:cpf/fidelidade` — `getFidelidade` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 104 | C21:47 | `GET /integrations/antenorapi/pedidos/:identificador/nfe` — `getNfe` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 105 | C21:72 | `GET /integrations/solidcom/pending-invoice` — `listPendingInvoice` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin', 'picker')` |
| 106 | C21:81 | `POST /integrations/solidcom/orders/:id/invoiced` — `markInvoiced` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin', 'picker')` |
| 107 | C21:95 | `POST /integrations/solidcom/orders/:id/cancelled-in-erp` — `markCancelledInErp` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin', 'picker')` |
| 108 | C21:110 | `POST /integrations/antenorapi/webhook` — `handleAntenorApiWebhook` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(AntenorApiWebhookGuard)`; `Throttle({ webhook: { limit: 120, ttl: 60000 } })` |
| 109 | C21:127 | `GET /integrations/modules` — `listModules` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 110 | C21:140 | `PATCH /integrations/modules/:key` — `setModuleEnabled` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 111 | C21:156 | `GET /integrations/operations/panel` — `getIntegrationPanel` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 112 | C21:169 | `GET /integrations/connectors` — `listConnectors` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 113 | C21:189 | `POST /integrations/connectors` — `createConnector` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 114 | C21:202 | `GET /integrations/outbox/events` — `listOutboxEvents` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 115 | C21:232 | `POST /integrations/outbox/events` — `enqueueOutboxEvent` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 116 | C21:245 | `POST /integrations/outbox/events/:eventId/replay` — `replayOutboxEvent` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 117 | C21:258 | `POST /integrations/outbox/worker/run` — `runOutboxWorker` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 118 | C21:271 | `GET /integrations/jobs` — `listIntegrationJobs` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 119 | C21:295 | `GET /integrations/dead-letters` — `listDeadLetters` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 120 | C21:319 | `POST /integrations/dead-letters/:deadLetterId/replay` — `replayDeadLetter` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 121 | C21:332 | `GET /integrations/solidcom/status` — `getSolidcomStatus` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 122 | C21:366 | `GET /integrations/solidcom/orders/failures` — `listSolidcomOrderSyncFailures` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 123 | C21:394 | `GET /integrations/solidcom/orders/period` — `reconcileSolidcomOrdersByPeriod` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 124 | C21:409 | `GET /integrations/solidcom/orders/:orderId/contract` — `getSolidcomOrderContract` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 125 | C21:422 | `GET /integrations/solidcom/orders/:orderId/contracts` — `listSolidcomOrderContracts` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 126 | C21:437 | `GET /integrations/solidcom/orders/:orderId/remote` — `getSolidcomRemoteOrder` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 127 | C21:450 | `GET /integrations/solidcom/orders/:orderId/failure` — `getSolidcomOrderSyncFailure` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 128 | C21:463 | `POST /integrations/solidcom/orders/:orderId/retry` — `retrySolidcomOrderSync` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 129 | C21:476 | `GET /integrations/payments/health` — `getPaymentsHealth` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 130 | C21:489 | `GET /integrations/payments/transactions` — `listPaymentTransactions` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 131 | C21:512 | `GET /integrations/crm/health` — `getCrmHealth` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 132 | C21:525 | `GET /integrations/fiscal/health` — `getFiscalHealth` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 133 | C21:538 | `GET /integrations/crm/contact-preview/:customerId` — `getCrmContactPreview` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 134 | C21:551 | `GET /integrations/crm/contact-preview/:customerId/history` — `listCrmContactSnapshots` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 135 | C21:566 | `GET /integrations/fiscal/document-preview/:orderId` — `getFiscalDocumentPreview` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 136 | C21:579 | `GET /integrations/fiscal/document-preview/:orderId/history` — `listFiscalDocumentSnapshots` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 137 | C21:594 | `GET /integrations/payments/charge-preview/:orderId` — `getChargePreview` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 138 | C21:607 | `POST /integrations/payments/orders/:orderId/transaction` — `createPaymentTransaction` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 139 | C21:623 | `POST /integrations/payments/refunds` — `createPaymentRefund` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 140 | C21:636 | `POST /integrations/payments/chargebacks` — `registerPaymentChargeback` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 141 | C21:649 | `POST /integrations/payments/reconciliation` — `reconcilePayments` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 142 | C21:662 | `GET /integrations/payments/charge-preview/:orderId/history` — `listChargeSnapshots` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 143 | C21:677 | `POST /integrations/crm/contact-sync/:customerId` — `syncCrmContact` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 144 | C21:690 | `POST /integrations/crm/contact-replay/:snapshotId` — `replayCrmContact` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 145 | C21:703 | `POST /integrations/fiscal/document-emit/:orderId` — `emitFiscalDocument` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 146 | C21:716 | `POST /integrations/fiscal/document-replay/:snapshotId` — `replayFiscalDocument` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 147 | C21:729 | `POST /integrations/payments/charge/:orderId` — `chargePayment` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 148 | C21:742 | `POST /integrations/payments/charge-replay/:snapshotId` — `replayCharge` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 149 | C21:755 | `POST /integrations/payments/webhook` — `receiveWebhook` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(WebhookGuard)`; `Throttle({ webhook: { limit: 120, ttl: 60000 } })` |
| 150 | C21:768 | `GET /integrations/payments/webhook/events` — `listWebhookEvents` | `SkipThrottle({ auth: true, checkout: true })`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 151 | C22:36 | `GET /health/detail` — `check` | `RelaxedThrottle()` |
| 152 | C27:30 | `GET /admin/picking/eligible-orders` — `listEligibleOrders` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 153 | C27:36 | `GET /admin/picking/tasks` — `listTasks` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 154 | C27:51 | `POST /admin/picking/tasks` — `createTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 155 | C27:57 | `POST /admin/picking/tasks/from-order/:orderId` — `createTaskFromOrder` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 156 | C27:63 | `GET /admin/picking/tasks/:id` — `findTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 157 | C27:69 | `POST /admin/picking/tasks/:id/assign` — `assignTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 158 | C27:75 | `POST /admin/picking/tasks/:id/cancel` — `cancelTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 159 | C27:81 | `POST /admin/picking/tasks/:id/start` — `startTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 160 | C27:87 | `POST /admin/picking/tasks/:id/items/:itemId/pick` — `pickItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 161 | C27:98 | `POST /admin/picking/tasks/:id/items/:itemId/missing` — `markItemMissing` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 162 | C27:109 | `POST /admin/picking/tasks/:id/items/:itemId/substitute` — `substituteItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 163 | C27:120 | `POST /admin/picking/tasks/:id/finish` — `finishTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 164 | C27:126 | `POST /admin/picking/tasks/:id/conference` — `conferenceTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 165 | C27:132 | `POST /admin/picking/tasks/:id/packing-checklist` — `completePackingChecklist` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 166 | C27:138 | `GET /admin/picking/performance` — `getPerformance` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 167 | C28:28 | `GET /picker/orders` — `searchOrders` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 168 | C28:40 | `POST /picker/orders/:orderId/start` — `startOrderPicking` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 169 | C28:55 | `POST /picker/orders/:orderId/send-to-cashier` — `sendToCashier` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 170 | C28:65 | `GET /picker/tasks` — `listMyTasks` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 171 | C28:78 | `GET /picker/tasks/available` — `listAvailableTasks` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 172 | C28:85 | `GET /picker/tasks/:id` — `findTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 173 | C28:91 | `POST /picker/tasks/:id/claim` — `claimTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 174 | C28:98 | `POST /picker/tasks/:id/start` — `startTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 175 | C28:104 | `POST /picker/tasks/:id/items/:itemId/pick` — `pickItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 176 | C28:115 | `POST /picker/tasks/:id/items/:itemId/missing` — `markItemMissing` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 177 | C28:126 | `POST /picker/tasks/:id/items/:itemId/substitute` — `substituteItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 178 | C28:137 | `POST /picker/tasks/:id/items/:itemId/reset` — `resetPickedItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 179 | C28:148 | `POST /picker/tasks/:id/items/:itemId/remove` — `removeAddedItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 180 | C28:158 | `POST /picker/orders/:orderId/add-item` — `addItemToOrder` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 181 | C28:168 | `GET /picker/products/search` — `searchProducts` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 182 | C28:223 | `POST /picker/tasks/:id/finish` — `finishTask` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 183 | C28:229 | `GET /picker/me` — `getMe` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('picking')`; `RelaxedThrottle()` |
| 184 | C35:27 | `GET /orders` — `findAll` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard)` |
| 185 | C35:73 | `GET /orders/analytics/sales` — `getSalesAnalytics` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 186 | C35:101 | `GET /orders/analytics/status` — `getStatusAnalytics` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 187 | C35:131 | `GET /orders/analytics/revenue` — `getRevenueAnalytics` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 188 | C35:159 | `GET /orders/analytics/category-revenue` — `getCategoryRevenue` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 189 | C35:170 | `GET /orders/analytics/heatmap` — `getRevenueHeatmap` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 190 | C35:182 | `GET /orders/:id` — `findOne` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard)` |
| 191 | C35:219 | `POST /orders` — `create` | `SkipThrottle({ auth: true, webhook: true })`; `UseGuards(JwtAuthGuard, RolesGuard, TenantAccessGuard)`; `Roles('admin')`; `Throttle({ checkout: { limit: 30, ttl: 60000 } })` |
| 192 | C35:275 | `PUT /orders/:id` — `update` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 193 | C35:297 | `PUT /orders/:id/status` — `updateStatus` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 194 | C35:319 | `DELETE /orders/:id` — `remove` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 195 | C35:341 | `GET /orders/admin/fraud-logs` — `listFraudLogs` | `SkipThrottle({ auth: true, webhook: true })`; `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 196 | C35:367 | `GET /admin/orders` — `findAll` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 197 | C35:384 | `GET /admin/orders/audit/substitutions` — `listSubstitutions` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 198 | C35:399 | `GET /admin/orders/:id` — `findOne` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 199 | C35:405 | `POST /admin/orders/:id/events` — `addEvent` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 200 | C35:415 | `POST /admin/orders/:id/cancel` — `cancel` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 201 | C35:425 | `POST /admin/orders/:id/items/:itemId/cancel` — `cancelItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 202 | C35:436 | `POST /admin/orders/:id/items/:itemId/substitute` — `substituteItem` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 203 | C35:447 | `POST /admin/orders/:id/recalculate` — `recalculate` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 204 | C34:18 | `GET /addresses/search/:cep` — `searchCEP` | `RelaxedThrottle()` |
| 205 | C34:45 | `GET /addresses/:customerId` — `listAddresses` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 206 | C34:61 | `POST /addresses/:customerId` — `addAddress` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 207 | C34:90 | `PUT /addresses/:customerId/:addressId` — `updateAddress` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 208 | C34:109 | `DELETE /addresses/:customerId/:addressId` — `deleteAddress` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 209 | C34:127 | `PATCH /addresses/:customerId/:addressId/default` — `setDefaultAddress` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 210 | C23:21 | `GET /admin/products` — `findAll` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')` |
| 211 | C23:50 | `POST /admin/products` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write')`; `UseGuards(PermissionGuard)` |
| 212 | C23:57 | `PATCH /admin/products/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write', 'pricing.write')`; `UseGuards(PermissionGuard)` |
| 213 | C23:64 | `POST /admin/products/:id/media` — `addMedia` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write')`; `UseGuards(PermissionGuard)` |
| 214 | C23:85 | `POST /admin/products/:id/substitutes` — `createSubstitute` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('catalog.write')`; `UseGuards(PermissionGuard)` |
| 215 | C14:23 | `GET /notifications` — `findByCustomer` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 216 | C14:33 | `GET /notifications/unread-count` — `countUnread` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 217 | C14:43 | `PATCH /notifications/:id/read` — `markAsRead` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 218 | C14:53 | `POST /notifications/push-subscribe` — `savePushSubscription` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 219 | C14:81 | `POST /notifications/push-subscribe/staff` — `saveStaffPushSubscription` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard)` |
| 220 | C14:112 | `POST /notifications/admin/broadcast` — `broadcastNotification` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 221 | C14:169 | `GET /notifications/admin/broadcast/scheduled` — `listScheduledBroadcasts` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 222 | C14:178 | `POST /notifications/admin/broadcast/scheduled/:id/cancel` — `cancelScheduledBroadcast` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 223 | C14:187 | `GET /notifications/admin/broadcast/segment-count` — `broadcastSegmentCount` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 224 | C14:203 | `GET /notifications/admin/history` — `listDispatches` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 225 | C14:226 | `GET /notifications/admin/history/counts` — `countDispatches` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 226 | C14:235 | `GET /notifications/admin/ai-cycle/status` — `getAiNotificationStatus` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 227 | C14:244 | `POST /notifications/admin/ai-cycle/toggle` — `toggleAiNotification` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 228 | C14:253 | `POST /notifications/admin/ai-cycle/run` — `runAiNotificationCycle` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 229 | C14:262 | `POST /notifications/admin/pending-mappings/notify` — `notifyPendingMappings` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 230 | C14:272 | `GET /notifications/admin/pending-mappings` — `listPendingMappingNotifications` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 231 | C14:288 | `PATCH /notifications/admin/pending-mappings/:id/read` — `markPendingMappingNotificationAsRead` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 232 | C18:21 | `GET /products/admin` — `findAllAdmin` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 233 | C18:85 | `PATCH /products/admin/bulk-status` — `bulkUpdateStatus` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 234 | C18:97 | `POST /products/admin/bulk-delete` — `bulkDelete` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 235 | C18:109 | `GET /products/admin/mercadological-tree` — `getMercadologicalTree` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 236 | C18:125 | `POST /products/admin/taxonomy/sync` — `syncTaxonomy` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 237 | C18:141 | `GET /products/admin/availability-metrics` — `getAvailabilityMetrics` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 238 | C18:157 | `GET /products` — `findAll` | `RelaxedThrottle()` |
| 239 | C18:205 | `GET /products/mercadological-tree` — `getMercadologicalTreePublic` | `RelaxedThrottle()` |
| 240 | C18:215 | `GET /products/promotions` — `findPromotions` | `RelaxedThrottle()` |
| 241 | C18:225 | `GET /products/suggest` — `suggest` | `RelaxedThrottle()` |
| 242 | C18:241 | `POST /products/admin/reindex-search` — `reindexSearch` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 243 | C18:257 | `GET /products/sync` — `syncERPGet` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 244 | C18:282 | `GET /products/analytics/top` — `getTopProducts` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 245 | C18:310 | `GET /products/:id/substitutes` — `getSubstitutes` | `RelaxedThrottle()` |
| 246 | C18:319 | `GET /products/:id/recommendations` — `getRecommendations` | `RelaxedThrottle()` |
| 247 | C18:331 | `GET /products/:id` — `findOne` | `RelaxedThrottle()` |
| 248 | C18:354 | `POST /products/admin` — `createAdmin` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 249 | C18:375 | `POST /products` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 250 | C18:392 | `PUT /products/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionGuard)`; `Roles('admin')`; `RequirePermission('pricing.write')` |
| 251 | C18:412 | `DELETE /products/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 252 | C18:431 | `POST /products/sync` — `syncERP` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 253 | C18:448 | `POST /products/admin/sync` — `syncERPBackground` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 254 | C18:464 | `GET /products/admin/sync/status` — `syncERPBackgroundStatus` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 255 | C18:473 | `POST /products/sync/incremental` — `syncERPIncremental` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 256 | C18:492 | `POST /products/sync/promotions` — `reconcilePromotions` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 257 | C11:27 | `GET /cms/store-banners` — `findActive` | `RelaxedThrottle()` |
| 258 | C11:33 | `GET /cms/store-banners/active` — `findActiveExplicit` | `RelaxedThrottle()` |
| 259 | C11:39 | `GET /cms/store-banners/all` — `findAll` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 260 | C11:46 | `POST /cms/store-banners` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 261 | C11:53 | `PATCH /cms/store-banners/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 262 | C11:60 | `POST /cms/store-banners/:id/click` — `registerClick` | `RelaxedThrottle()` |
| 263 | C11:66 | `POST /cms/store-banners/:id/impression` — `registerImpression` | `RelaxedThrottle()` |
| 264 | C11:72 | `DELETE /cms/store-banners/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 265 | C02:19 | `POST /data-privacy/customers/:customerId/consents` — `upsertConsentBundle` | `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 266 | C02:25 | `GET /data-privacy/customers/:customerId/export` — `exportCustomerData` | `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 267 | C02:31 | `POST /data-privacy/customers/:customerId/anonymize` — `anonymizeCustomer` | `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 268 | C02:37 | `GET /data-privacy/retention-policy` — `getRetentionPolicy` | `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 269 | C02:43 | `GET /data-privacy/requests` — `listRequests` | `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 270 | C16:22 | `POST /analytics/track` — `track` | `RelaxedThrottle()` |
| 271 | C16:31 | `GET /analytics/top-products` — `getTopProducts` | `RelaxedThrottle()` |
| 272 | C16:37 | `GET /analytics/admin/insights` — `getInsights` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 273 | C16:46 | `GET /analytics/funnel` — `getFunnel` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 274 | C16:55 | `GET /analytics/events` — `listEvents` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 275 | C16:64 | `GET /analytics/admin/search-insights` — `getSearchInsights` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 276 | C16:73 | `GET /analytics/funnel-compare` — `getFunnelWithComparison` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 277 | C16:82 | `GET /analytics/insights-compare` — `getBiInsightsWithComparison` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 278 | C16:91 | `POST /analytics/admin/metric-snapshots/generate` — `generateMetricSnapshots` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 279 | C16:106 | `GET /analytics/admin/operational-dashboard` — `getOperationalDashboard` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 280 | C16:120 | `GET /analytics/admin/drilldown` — `drillDownMetric` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 281 | C16:152 | `POST /analytics/alert-rules` — `createAlertRule` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 282 | C16:161 | `GET /analytics/alert-rules` — `getAlertRules` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 283 | C16:170 | `GET /analytics/alert-rules/:ruleId` — `getAlertRule` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 284 | C16:179 | `PATCH /analytics/alert-rules/:ruleId` — `updateAlertRule` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 285 | C16:188 | `DELETE /analytics/alert-rules/:ruleId` — `deleteAlertRule` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 286 | C16:197 | `GET /analytics/alerts/unseen` — `getUnseenAlerts` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 287 | C16:206 | `GET /analytics/alerts/history` — `getAlertHistory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 288 | C16:215 | `PATCH /analytics/alerts/:alertId/seen` — `markAlertSeen` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 289 | C16:224 | `POST /analytics/alerts/check-and-trigger` — `checkAndTriggerAlerts` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 290 | C16:234 | `GET /analytics/report-executive` — `getExecutiveReport` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 291 | C16:245 | `GET /analytics/report-executive/download` — `downloadExecutiveReport` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 292 | C19:14 | `GET /api/categories/hierarchy` — `getHierarchy` | `RelaxedThrottle()` |
| 293 | C19:28 | `GET /api/categories/:categoryId/subcategories` — `getSubcategories` | `RelaxedThrottle()` |
| 294 | C19:41 | `GET /api/categories/:categoryId` — `getCategory` | `RelaxedThrottle()` |
| 295 | C19:63 | `GET /api/categories/:categoryId/mappings` — `getCategoryMappings` | `RelaxedThrottle()` |
| 296 | C19:87 | `GET /api/categories/stats/mapping` — `getMappingStats` | `RelaxedThrottle()` |
| 297 | C19:102 | `GET /api/categories/stats/by-category` — `getMappingCountsByCategory` | `RelaxedThrottle()` |
| 298 | C19:112 | `GET /api/categories/pending/list` — `getPendingMappings` | `RelaxedThrottle()` |
| 299 | C19:139 | `GET /api/categories/:categoryId/products` — `getProductsInCategory` | `RelaxedThrottle()` |
| 300 | C20:19 | `POST /api/admin/categories` — `createCategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 301 | C20:35 | `POST /api/admin/categories/:parentId/subcategories` — `createSubcategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 302 | C20:54 | `PUT /api/admin/categories/:categoryId` — `updateCategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 303 | C20:67 | `DELETE /api/admin/categories/:categoryId` — `deleteCategory` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 304 | C20:78 | `POST /api/admin/categories/mappings/create` — `createMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 305 | C20:93 | `PUT /api/admin/categories/mappings/:ean` — `updateMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 306 | C20:107 | `GET /api/admin/categories/mappings/by-ean/:ean` — `getMappingByEan` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 307 | C20:120 | `DELETE /api/admin/categories/mappings/:ean` — `deleteMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 308 | C20:130 | `POST /api/admin/categories/pending/:id/approve` — `approvePendingMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 309 | C20:143 | `POST /api/admin/categories/pending/:id/reject` — `rejectPendingMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 310 | C20:156 | `POST /api/admin/categories/apply` — `applyMappingsSafeMode` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 311 | C20:185 | `GET /api/admin/categories/mappings/suggestions` — `getMappingSuggestions` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 312 | C20:206 | `POST /api/admin/categories/mappings/apply-suggestions` — `applyMappingSuggestions` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 313 | C20:227 | `POST /api/admin/categories/subcategories/populate` — `populateSubcategories` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 314 | C20:247 | `POST /api/admin/categories/pending/generate` — `generatePendingMappings` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 315 | C20:265 | `POST /api/admin/categories/pending/resolve-auto` — `resolvePendingAutomatically` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 316 | C15:13 | `GET /cms/categories/commercial` — `findCommercialTaxonomy` | `RelaxedThrottle()` |
| 317 | C15:18 | `GET /cms/categories/classification-mappings` — `getClassificationMappings` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 318 | C15:25 | `POST /cms/categories/classification-mappings` — `addClassificationMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 319 | C15:34 | `DELETE /cms/categories/classification-mappings/:id` — `removeClassificationMapping` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 320 | C15:41 | `GET /cms/categories` — `findAll` | `RelaxedThrottle()` |
| 321 | C15:46 | `POST /cms/categories` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 322 | C15:53 | `PATCH /cms/categories/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 323 | C15:60 | `DELETE /cms/categories/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 324 | C13:13 | `GET /cms/hero-slides` — `findAll` | `RelaxedThrottle()` |
| 325 | C13:18 | `POST /cms/hero-slides` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 326 | C13:30 | `PATCH /cms/hero-slides/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 327 | C13:37 | `DELETE /cms/hero-slides/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 328 | C12:13 | `GET /cms/promo-banners` — `findAll` | `RelaxedThrottle()` |
| 329 | C12:18 | `GET /cms/promo-banners/all` — `findAllAdmin` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 330 | C12:25 | `POST /cms/promo-banners` — `create` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 331 | C12:49 | `PATCH /cms/promo-banners/:id` — `update` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 332 | C12:75 | `DELETE /cms/promo-banners/:id` — `remove` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 333 | C33:17 | `GET /availability` — `getAvailability` | `RelaxedThrottle()` |
| 334 | C33:39 | `POST /stock/reservations` — `createReservation` | `RelaxedThrottle()` |
| 335 | C33:57 | `POST /stock/reservations/:id/release` — `releaseReservation` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 336 | C33:72 | `POST /admin/stock/adjustments` — `createAdjustment` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('inventory.write')`; `UseGuards(PermissionGuard)` |
| 337 | C33:82 | `POST /admin/stock/picking-ruptures` — `recordPickingRupture` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('picking.write')`; `UseGuards(PermissionGuard)` |
| 338 | C33:92 | `GET /admin/stock/negative` — `getNegative` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('inventory.read')`; `UseGuards(PermissionGuard)` |
| 339 | C33:99 | `GET /admin/stock/reconciliation` — `getReconciliation` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('inventory.read')`; `UseGuards(PermissionGuard)` |
| 340 | C33:106 | `POST /admin/stock/jobs/sync-from-erp` — `syncFromErp` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('inventory.write')`; `UseGuards(PermissionGuard)` |
| 341 | C33:113 | `POST /admin/stock/jobs/recalculate-available` — `recalculateAvailable` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('inventory.write')`; `UseGuards(PermissionGuard)` |
| 342 | C33:120 | `POST /admin/stock/jobs/expire-reservations` — `expireReservations` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RequirePermission('inventory.write')`; `UseGuards(PermissionGuard)` |
| 343 | C17:24 | `POST /auth/login` — `login` | `Throttle({ auth: { limit: 10, ttl: 60000 } })` |
| 344 | C17:57 | `POST /auth/customer/login` — `customerLogin` | `Throttle({ auth: { limit: 10, ttl: 60000 } })` |
| 345 | C17:90 | `POST /auth/forgot-password` — `forgotPassword` | `Throttle({ auth: { limit: 5, ttl: 60000 } })` |
| 346 | C17:101 | `POST /auth/reset-password` — `resetPassword` | `Throttle({ auth: { limit: 5, ttl: 60000 } })` |
| 347 | C17:112 | `POST /auth/customer/forgot-password` — `customerForgotPassword` | `Throttle({ auth: { limit: 5, ttl: 60000 } })` |
| 348 | C17:123 | `POST /auth/customer/reset-password` — `customerResetPassword` | `Throttle({ auth: { limit: 5, ttl: 60000 } })` |
| 349 | C17:134 | `POST /auth/customer/set-password` — `customerSetPassword` | `UseGuards(JwtAuthGuard)`; `Throttle({ auth: { limit: 5, ttl: 60000 } })` |
| 350 | C17:155 | `POST /auth/customer/register` — `customerRegister` | `Throttle({ auth: { limit: 10, ttl: 60000 } })` |
| 351 | C17:177 | `POST /auth/customer/guest-checkout` — `guestCheckout` | `Throttle({ checkout: { limit: 20, ttl: 60000 } })` |
| 352 | C17:196 | `POST /auth/register` — `register` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 353 | C17:221 | `GET /auth/permissions` — `listPermissions` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 354 | C17:234 | `GET /auth/staff` — `listStaff` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 355 | C17:245 | `PATCH /auth/staff/:id` — `updateStaff` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 356 | C17:255 | `POST /auth/staff/:id/toggle-active` — `toggleStaffActive` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 357 | C29:15 | `POST /marketplace/channels` — `upsertChannel` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 358 | C29:24 | `GET /marketplace/channels` — `listChannels` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 359 | C29:33 | `POST /marketplace/channels/:channelId/products` — `upsertChannelProduct` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 360 | C29:42 | `POST /marketplace/channels/:channelId/price-policy` — `upsertPricePolicy` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 361 | C29:51 | `POST /marketplace/channels/:channelId/stock-policy` — `upsertStockPolicy` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 362 | C29:60 | `POST /marketplace/channels/:channelId/orders` — `ingestOrder` | `RelaxedThrottle()` |
| 363 | C29:66 | `GET /marketplace/panel` — `getPanel` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 364 | C24:46 | `POST /delivery/ibge/reverse` — `ibgeReverse` | `RelaxedThrottle()` |
| 365 | C24:52 | `GET /delivery/ibge/by-cep/:cep` — `ibgeByCep` | `RelaxedThrottle()` |
| 366 | C24:58 | `GET /delivery/ibge/search` — `ibgeSearch` | `RelaxedThrottle()` |
| 367 | C24:65 | `GET /delivery/calculate` — `calculate` | `RelaxedThrottle()` |
| 368 | C24:85 | `GET /delivery/slots` — `listPublicSlots` | `RelaxedThrottle()` |
| 369 | C24:96 | `GET /delivery/zones` — `listZones` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 370 | C24:104 | `POST /delivery/zones` — `createZone` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 371 | C24:112 | `PATCH /delivery/zones/:id` — `updateZone` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 372 | C24:120 | `DELETE /delivery/zones/:id` — `deleteZone` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 373 | C24:129 | `POST /delivery/zones/test` — `testZone` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 374 | C24:138 | `POST /delivery/zones/overlap-check` — `checkZoneOverlap` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 375 | C24:147 | `POST /delivery/zones/bulk-import` — `bulkImportZones` | `RelaxedThrottle()`; `UseGuards(JwtAuthGuard, RolesGuard)`; `Roles('admin')` |
| 376 | C24:166 | `GET /admin/fulfillment/slots` — `listSlots` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 377 | C24:178 | `POST /admin/fulfillment/slots` — `createSlot` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 378 | C24:184 | `PATCH /admin/fulfillment/slots/:id` — `updateSlot` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 379 | C24:190 | `DELETE /admin/fulfillment/slots/:id` — `deleteSlot` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 380 | C24:197 | `GET /admin/fulfillment/drivers` — `listDrivers` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 381 | C24:203 | `POST /admin/fulfillment/drivers` — `createDriver` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 382 | C24:209 | `GET /admin/fulfillment/routes` — `listRoutes` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 383 | C24:215 | `GET /admin/fulfillment/drivers/performance` — `getDriverPerformance` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 384 | C24:221 | `POST /admin/fulfillment/routes` — `createRoute` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 385 | C24:227 | `POST /admin/fulfillment/routes/:id/stops` — `addStop` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 386 | C24:233 | `POST /admin/fulfillment/routes/:id/start` — `startRoute` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 387 | C24:239 | `POST /admin/fulfillment/routes/:id/stops/:stopId/status` — `updateStopStatus` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 388 | C24:250 | `POST /admin/fulfillment/routes/:id/complete` — `completeRoute` | `UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)`; `Roles('admin')`; `RelaxedThrottle()` |
| 389 | C26:25 | `GET /driver/me` — `getMe` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 390 | C26:38 | `GET /driver/available` — `listAvailable` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 391 | C26:47 | `POST /driver/available/:orderId/take` — `takeDelivery` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 392 | C26:59 | `GET /driver/routes` — `listMyRoutes` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 393 | C26:76 | `GET /driver/routes/:id` — `findRoute` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 394 | C26:101 | `POST /driver/routes/:id/start` — `startRoute` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 395 | C26:108 | `POST /driver/routes/:id/stops/:stopId/status` — `updateStopStatus` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 396 | C26:120 | `POST /driver/routes/:id/complete` — `completeRoute` | `UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)`; `RequireModule('delivery')`; `RelaxedThrottle()` |
| 397 | C38:43 | `GET /` — `getHello` | Sem guard/decorador adicional reconhecido |
| 398 | C38:59 | `GET /health` — `health` | Sem guard/decorador adicional reconhecido |

## Comandos, resultados e reprodução segura

| Etapa executada | Resultado e limite |
|---|---|
| Inventário com rg e extração AST TypeScript | 398 operações / 38 arquivos; inventário anterior tinha 392 operações, seis acrescentadas concorrentemente e revisadas |
| Inspeção de guards/DTOs/serviços/clientes/configurações | 35 achados confirmados, descritos individualmente; demais buscas não são certificado de ausência |
| Suíte local em memória | 29 PASS, zero falhas finais; sem rede, banco falso e unlink simulado |
| Segredos e dados pessoais | Somente metadados, resultados agregados e arquivos/linhas; sem valores reais |
| Sete lockfiles | 94 resoluções para 27 nomes de pacotes; dependências de 25 tickets herdados |
| Linear, incluindo arquivadas | 156 issues em 7 páginas; completude de paginação confirmada; 60 tickets tratados com read-back |
| Snapshots de fonte/configuração | 589 artefatos na conferência final; mudanças de outros trabalhos preservadas |

Os comandos abaixo exigem apenas Node e as dependências já presentes neste checkout. **Não instalar dependências para reproduzir esta fase**; se faltarem, registrar a limitação. O script não inicializa aplicação, PrismaClient, transporte de rede ou shell para executar entradas. Os nomes, endereços, números e credenciais presentes na fixture são exclusivamente sintéticos; a leitura do certificado usa o arquivo existente sem imprimir seu conteúdo.

### Suíte sintética completa

Para executar diretamente a suíte contida neste relatório:

```powershell
$md = Get-Content -Raw -LiteralPath 'docs/auditoria-360/02-seguranca-autenticacao-sessoes.md'
$codigo = [regex]::Match($md, '(?s)<!-- suite-seguranca-inicio -->\s*```javascript\s*(.*?)\s*```\s*<!-- suite-seguranca-fim -->').Groups[1].Value
if (-not $codigo) { throw 'Suite nao encontrada no relatorio' }
$codigo | node
```

<!-- suite-seguranca-inicio -->
```javascript
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert/strict'), ts=require('./sistema/backend/node_modules/typescript'), crypto=require('crypto');
const common=require('./sistema/backend/node_modules/@nestjs/common');
const safeLog={log(){},warn(){},error(){},debug(){},info(){}};
function loadSource(file,name,extra={}){
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true);
 const input=sf.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(sf)).join('\n');
 const output=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;
 const context={exports:{},...common,Logger:class{log(){}warn(){}error(){}debug(){}},Buffer,process:{env:{NODE_ENV:'test'},cwd:()=>process.cwd()},console:safeLog,...crypto,crypto,Prisma:require('./sistema/backend/node_modules/@prisma/client').Prisma,bcrypt:require('./sistema/backend/node_modules/bcrypt'),DEFAULT_TENANT_ID:'tenant-fixture',DEFAULT_STORE_ID:'store-fixture',STAFF_MODULES:['admin','picking','delivery'],...extra};
 vm.runInNewContext(output,context,{filename:file});
 return context.exports[name];
}
const checks=[];
function ok(name,value){assert(value,name);checks.push({teste:name,resultado:'PASS'});}

(async()=>{
 const Auth=loadSource('sistema/backend/src/modules/auth/auth.service.ts','AuthService');
 const victim={id:'cliente-vitima-fixture',email:'vitima@example.invalid',name:'Cliente fixture',cpf:'00000000000',whatsapp:'00000000000',password:'hash-sintetico',blocked:false,tenantId:'tenant-fixture'};
 let search;const auth=new Auth({customer:{findFirst:async q=>(search=q,victim)}},{sign:(payload,options)=>({payload,options})},{});
 const guest=await auth.guestCheckout({name:'Outro nome',cpf:'11111111111',whatsapp:'22222222222',email:'vitima@example.invalid'});
 ok('S01: e-mail isolado de terceiro emite sessao completa apesar de senha existente',guest.access_token.payload.id===victim.id&&search.where.OR.length===3&&guest.access_token.options.expiresIn==='30d');
 const Pay=loadSource('sistema/backend/src/modules/integrations/payments-webhook.service.ts','PaymentsWebhookService',{PaymentsLedgerService:{sanitizePayload:x=>x}});
 let changed;const pay=new Pay({auditLog:{create:async()=>({})},order:{findUnique:async()=>({id:'pedido-fixture',tenantId:'tenant-fixture',storeId:'store-fixture',total:100,status:'DELIVERED',paymentStatus:'UNPAID',paymentMethod:'CASH'}),update:async q=>(changed=q,{})}},{createTransaction:async()=>({id:'transacao-fixture'}),recordEvent:async()=>({duplicate:false,event:{id:'evento-fixture'}}),updateTransactionStatus:async()=>({})});
 ok('S03: gateway inativo e segredo ausente aceitam assinatura arbitraria',pay.verifySignature(Buffer.from('{}'),'invalida')===true);
 await pay.processEvent({eventId:'evento-fixture',event:'payment.paid',orderId:'pedido-fixture',chargeId:'cobranca-fixture',status:'PAID',amount:0.01});
 ok('S03: evento sintetico marca pedido pago sem comprovacao de gateway',changed.data.paymentStatus==='PAID');
 ok('S04: pagamento divergente regride pedido entregue para confirmado',changed.data.status==='CONFIRMED');
 const Mkt=loadSource('sistema/backend/src/modules/marketplace/marketplace.service.ts','MarketplaceService');
 const mkt=new Mkt({},{});mkt.assertWebhookSecret({config:{}},{});
 ok('S05: canal sem segredo aceita webhook sem credencial',true);
 const Utils=loadSource('sistema/backend/src/common/services/uploads.service.ts','UploadsManagementService',{join:path.join,fs:{unlink:async p=>{changed=p}}});
 const util=new Utils();await util.deleteFileFromUrl('/uploads/../fixture-alvo.txt');
 ok('S06: limpeza de upload resolve arquivo fora da raiz de uploads',changed===path.join(process.cwd(),'fixture-alvo.txt'));

 // Carrinho aceita titular indicado no corpo sem prova de posse.
 let cartData;
 const Cart=loadSource('sistema/backend/src/modules/checkout/cart.service.ts','CartService');
 const cartSvc=new Cart({cart:{create:async q=>(cartData=q.data,{id:'cart-fixture',items:[],...q.data})},checkoutEvent:{create:async()=>({})}});
 await cartSvc.createCart({tenantId:'tenant-fixture',storeId:'store-fixture'},{customerId:'vitima-fixture'});
 ok('S02: carrinho anonimo vincula customerId fornecido no corpo',cartData.customerId==='vitima-fixture');
 // A corrida usa apenas bcrypt substituido e banco em memoria.
 const AuthRace=loadSource('sistema/backend/src/modules/auth/auth.service.ts','AuthService',{bcrypt:{hash:async()=> 'hash-novo-fixture'}});
 for(const table of ['admin','customer']){
  let writes=0;const db={[table]:{findFirst:async()=>({id:'conta-fixture'}),update:async()=>{writes++;return {}}}};
  const svc=new AuthRace(db,{},{});
  const method=table==='admin'?'resetPassword':'customerResetPassword';
  await Promise.all([svc[method]('token-fixture','senha-fixture-A'),svc[method]('token-fixture','senha-fixture-B')]);
  ok('S10: mesmo reset '+table+' e consumido duas vezes em concorrencia',writes===2);
 }
 const Jwt=loadSource('sistema/backend/src/common/strategies/jwt.strategy.ts','JwtStrategy',{PassportStrategy:()=>class{},Strategy:class{},resolveJwtSecret:()=> 'fixture'});
 const jwt=new Jwt({customer:{findUnique:async()=>({id:'conta-fixture',blocked:false,tenantId:'tenant-B'})}});
 const accepted=await jwt.validate({id:'conta-fixture',role:'customer',tenantId:'tenant-A',storeId:'store-A',iat:1});
 ok('S09/S14: validate aceita token antigo e preserva tenant anterior ao cadastro atual',accepted.tenantId==='tenant-A');
 const jwtBlocked=new Jwt({customer:{findUnique:async()=>({id:'conta-fixture',blocked:true})}});
 await assert.rejects(()=>jwtBlocked.validate({id:'conta-fixture',role:'customer'}));
 ok('Positivo: bloqueio atual do cliente revoga acesso nas rotas protegidas',true);
 // Extraimos a expressao HTML original, sem abrir janela ou navegador.
 const printFile='sistema/admin/src/pages/sections/OrdersSection.tsx';
 const printAst=ts.createSourceFile(printFile,fs.readFileSync(printFile,'utf8'),99,true,ts.ScriptKind.TSX);
 let htmlExpr;function visitPrint(n){if(ts.isVariableDeclaration(n)&&n.name.getText(printAst)==='html'&&n.initializer?.getText(printAst).includes('<!DOCTYPE html>'))htmlExpr=n.initializer.getText(printAst);ts.forEachChild(n,visitPrint)}visitPrint(printAst);
 const marker='<script>globalThis.__auditoriaSintetica=1</script>';
 const html=vm.runInNewContext(htmlExpr,{order:{id:'pedido-fixture',customer:{name:marker},createdAt:0,status:'PENDING',notes:marker,items:[],subtotal:1,total:1,discount:0,delivery:0},addr:{street:marker},orderStatusLabels:{},getPaymentMethodLabel:()=>'',getItemStatusLabel:()=>''});
 ok('S07: HTML original de impressao inclui script controlado pelo cliente sem escape',html.split(marker).length===4);
 // Configuracao do multer capturada; nenhuma escrita de upload acontece.
 const configs=[];
 loadSource('sistema/backend/src/modules/uploads/uploads.controller.ts','UploadsController',{
  ApiTags:()=>()=>{},ApiOperation:()=>()=>{},ApiBearerAuth:()=>()=>{},
  SkipThrottle:()=>()=>{},JwtAuthGuard:class{},RolesGuard:class{},Roles:()=>()=>{},
  FileInterceptor:(name,config)=>(configs.push(config),class{}),diskStorage:c=>c,
  uuidv4:()=> 'uuid-fixture',extname:path.extname,join:path.join,fs:{},sharp:()=>{}
 });
 let mimeAccepted=false,filename='';
 configs[0].fileFilter({}, {mimetype:'image/png',originalname:'fixture.html'},(e,v)=>{assert.equal(e,null);mimeAccepted=v});
 configs[0].storage.filename({}, {originalname:'fixture.html'},(e,n)=>{assert.equal(e,null);filename=n});
 ok('S08: filtro aceita MIME declarado de imagem e conserva extensao HTML',mimeAccepted&&filename==='uuid-fixture.html');
 const webpush=require('./sistema/backend/node_modules/web-push');
 const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();
 const request=webpush.generateRequestDetails({endpoint:'https://127.0.0.1:9443/sintetico',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}},'fixture');
 ok('S11: web-push prepara destino loopback sem requisicao de rede',request.endpoint==='https://127.0.0.1:9443/sintetico');
 let target,options;
 const Public=loadSource('sistema/backend/src/modules/public-api/public-api.service.ts','PublicApiService',{axios:{post:async(url,body,opts)=>{target=url;options=opts}}});
 const publicSvc=new Public({webhookDelivery:{findUnique:async()=>({id:'delivery-fixture',status:'PENDING',attempts:0,maxAttempts:3,payload:{sintetico:true},endpoint:{url:'http://127.0.0.1:9443/sintetico',secret:'fixture'}}),update:async()=>({})}});
 await publicSvc.processWebhookDelivery('delivery-fixture');
 ok('S12: envio de webhook entrega URL loopback ao transporte e nao limita redirects',target==='http://127.0.0.1:9443/sintetico'&&options.maxRedirects===undefined);
 let createdClient;
 const tenantApi=new Public({apiClient:{create:async q=>(createdClient=q.data,{...q.data,id:'fixture'})}});
 await tenantApi.createClient({name:'cliente-fixture',scopes:['orders:read'],tenantId:'tenant-B',storeId:'store-B'});
 ok('S13: cadastro de API client aceita tenant e loja escolhidos no corpo',createdClient.tenantId==='tenant-B'&&createdClient.storeId==='store-B');
 const Metrics=loadSource('sistema/backend/src/common/observability/metrics-registry.ts','MetricsRegistry');
 Metrics.observeHttp({method:'GET',route:'/clientes/fixture?email=pessoa%40example.invalid',status:200,durationMs:1,timestamp:Date.now()});
 ok('S18: Prometheus inclui URL e query sensiveis sem normalizacao',Metrics.prometheus().includes('email=pessoa%40example.invalid'));
 let stockWrite;
 const Inventory=loadSource('sistema/backend/src/modules/inventory/inventory.service.ts','InventoryService',{isProductSellable:()=>true});
 const tx={product:{findMany:async()=>[{id:'produto-fixture'}]},stockPosition:{updateMany:async()=>({count:1}),findUniqueOrThrow:async()=>({available:0})},stockReservation:{create:async q=>(stockWrite=q.data,{id:'reserva-fixture',...q.data})},stockLedger:{create:async()=>({})}};
 const inventory=new Inventory({$transaction:async f=>f(tx)},{});
 inventory.ensurePositionsForProducts=async()=>{};inventory.findPolicy=async()=>null;
 await inventory.reserveForCheckout({items:[{productId:'produto-fixture',quantity:1}],ttlMinutes:525600});
 ok('S22: reserva permite um ano de TTL sem carrinho associado',stockWrite.cartId===undefined&&stockWrite.expiresAt.getTime()>Date.now()+300*86400000);
 let calculated;
 const Checkout=loadSource('sistema/backend/src/modules/checkout/checkout.service.ts','CheckoutService');
 const checkout=new Checkout({address:{findFirst:async()=>({id:'addr-fixture',zipCode:'11111111'})}},null,null,null,{validateSlotCapacity:async()=>({valid:true}),calculate:async q=>(calculated=q,{fee:0.01})},null);
 const shipping=await checkout.resolveDelivery({tenantId:'tenant-fixture',storeId:'store-fixture'},{delivery:{addressId:'addr-fixture',cep:'22222222'}},1,{},'customer-fixture');
 ok('S23: frete usa CEP enviado divergente do endereco que sera entregue',calculated.cep==='22222222'&&shipping.addressId==='addr-fixture');
 // A chave privada nunca e exportada nem impressa.
 const key=crypto.createPrivateKey(fs.readFileSync('sistema/certs/key.pem'));
 const cert=new crypto.X509Certificate(fs.readFileSync('sistema/certs/cert.pem'));
 ok('S20: chave privada versionada corresponde ao certificado local',crypto.createPublicKey(key).export({type:'spki',format:'der'}).equals(cert.publicKey.export({type:'spki',format:'der'})));
 const compose=fs.readFileSync('sistema/docker-compose.yml','utf8');
 const secretDefault=compose.match(/JWT_SECRET:\s*\$\{JWT_SECRET:-([^}]+)\}/)?.[1];
 const resolve=loadSource('sistema/backend/src/common/security/jwt-secret.ts','resolveJwtSecret',{process:{env:{NODE_ENV:'production',JWT_SECRET:secretDefault}}});
 ok('S15: segredo padrao versionado passa na validacao de producao',Boolean(secretDefault)&&resolve()===secretDefault);


 const authTenant=new AuthRace({admin:{findUnique:async()=>({id:'staff-B',tenantId:'tenant-B',role:'picker'}),update:async q=>(changed=q,{id:'staff-B',...q.data})}},{},{});
 await authTenant.updateStaff('staff-B',{name:'Fixture alterada'},'admin-A');
 ok('S13: admin A altera staff de B sem contexto de tenant',changed.where.id==='staff-B'&&changed.where.tenantId===undefined);
 const RolesGuard=loadSource('sistema/backend/src/common/guards/roles.guard.ts','RolesGuard',{ROLES_KEY:'roles'});
 const ModGuard=loadSource('sistema/backend/src/common/guards/module-access.guard.ts','ModuleAccessGuard',{REQUIRED_MODULE_KEY:'module'});
 const context={getHandler:()=>function handler(){},getClass:()=>class Controller{},switchToHttp:()=>({getRequest:()=>({user:{id:'picker-fixture',role:'picker',moduleAccess:[]}})})};
 ok('S24: role picker autoriza mesmo sem modulo exigido pelo app',new RolesGuard({getAllAndOverride:()=>['admin','picker']}).canActivate(context)&&!new ModGuard({getAllAndOverride:()=> 'picking'}).canActivate(context));
 let analytic;
 const Analytics=loadSource('sistema/backend/src/modules/analytics/analytics.service.ts','AnalyticsService');
 await new Analytics({analyticsEvent:{create:async q=>(analytic=q.data,q.data)}}).trackEvent({type:'ORDER_CREATED',customerId:'vitima-fixture',tenantId:'tenant-B',storeId:'store-B'});
 ok('S26: evento publico aceita conversao e titular de terceiro',analytic.type==='ORDER_CREATED'&&analytic.customerId==='vitima-fixture'&&analytic.tenantId==='tenant-B');
 const Recipes=loadSource('sistema/backend/src/modules/recipes/recipes.service.ts','RecipesService');
 let recipeWhere;
 const recipes=new Recipes({recipe:{findMany:async q=>(recipeWhere=q.where,[]),count:async()=>0,findUnique:async()=>({slug:'fixture',active:false})}});
 await recipes.list(false);
 ok('S27: lista e consulta por slug expõem receita inativa',recipeWhere.active===false&&(await recipes.findBySlug('fixture')).active===false);
 const CC=loadSource('sistema/backend/src/modules/checkout/checkout.controller.ts','CheckoutSessionsController',{Throttle:()=>()=>{},RelaxedThrottle:()=>()=>{},Roles:()=>()=>{},JwtAuthGuard:class{},TenantAccessGuard:class{},RolesGuard:class{},getTenantContext:()=>({tenantId:'tenant-fixture',storeId:'store-fixture'})});
 let ipSent;
 await new CC({confirmSession:async(ctx,id,dto)=>{ipSent=dto.clientIp}}).confirm('fixture',{}, {headers:{'x-forwarded-for':'198.51.100.7'},ip:'192.0.2.7'});
 ok('S17: confirmacao usa header em vez de IP validado pelo ingress',ipSent==='198.51.100.7');
 const Addresses=loadSource('sistema/backend/src/modules/addresses/addresses.service.ts','AddressesService');
 let addressData;
 await new Addresses({$transaction:async f=>f({address:{findMany:async()=>[],create:async q=>(addressData=q.data,q.data)}})}).create('cliente-A',{street:'Fixture',tenantId:'tenant-B',createdAt:new Date(0)});
 ok('S13: criacao de endereco deixa tenant e campos internos do body passarem',addressData.tenantId==='tenant-B'&&addressData.customerId==='cliente-A'&&addressData.createdAt.getTime()===0);
 const securePay=loadSource('sistema/backend/src/modules/integrations/payments-webhook.service.ts','PaymentsWebhookService',{PaymentsLedgerService:{sanitizePayload:x=>x},process:{env:{NODE_ENV:'test',PAYMENTS_WEBHOOK_SECRET:'segredo-exclusivamente-sintetico'}}});
 const secured=new securePay({},{});
 const bytes=Buffer.from('{"fixture":true}');
 const signature=crypto.createHmac('sha256','segredo-exclusivamente-sintetico').update(bytes).digest('hex');
 ok('Positivo: HMAC configurado valida corpo correto e recusa alteracao',secured.verifySignature(bytes,signature)&&!secured.verifySignature(Buffer.from('{}'),signature));
 const publicOrders=new Public({order:{count:async()=>1,findMany:async()=>[{id:'fixture',customer:{password:'hash-fixture',resetTokenHash:'hash-reset-fixture'}}]}});
 ok('S28: API por chave devolve hashes incluidos na relacao customer',(await publicOrders.listOrders({tenantId:'fixture',storeId:'fixture'})).items[0].customer.password==='hash-fixture');

 console.log(JSON.stringify({checks,network:'nenhuma',database:'mocks',filesystem:'somente leitura; unlink simulado'}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
```
<!-- suite-seguranca-fim -->

### Resultados por verificação

| Verificação | Resultado |
|---|---|
| S01: e-mail isolado de terceiro emite sessao completa apesar de senha existente | PASS |
| S03: gateway inativo e segredo ausente aceitam assinatura arbitraria | PASS |
| S03: evento sintetico marca pedido pago sem comprovacao de gateway | PASS |
| S04: pagamento divergente regride pedido entregue para confirmado | PASS |
| S05: canal sem segredo aceita webhook sem credencial | PASS |
| S06: limpeza de upload resolve arquivo fora da raiz de uploads | PASS |
| S02: carrinho anonimo vincula customerId fornecido no corpo | PASS |
| S10: mesmo reset admin e consumido duas vezes em concorrencia | PASS |
| S10: mesmo reset customer e consumido duas vezes em concorrencia | PASS |
| S09/S14: validate aceita token antigo e preserva tenant anterior ao cadastro atual | PASS |
| Positivo: bloqueio atual do cliente revoga acesso nas rotas protegidas | PASS |
| S07: HTML original de impressao inclui script controlado pelo cliente sem escape | PASS |
| S08: filtro aceita MIME declarado de imagem e conserva extensao HTML | PASS |
| S11: web-push prepara destino loopback sem requisicao de rede | PASS |
| S12: envio de webhook entrega URL loopback ao transporte e nao limita redirects | PASS |
| S13: cadastro de API client aceita tenant e loja escolhidos no corpo | PASS |
| S18: Prometheus inclui URL e query sensiveis sem normalizacao | PASS |
| S22: reserva permite um ano de TTL sem carrinho associado | PASS |
| S23: frete usa CEP enviado divergente do endereco que sera entregue | PASS |
| S20: chave privada versionada corresponde ao certificado local | PASS |
| S15: segredo padrao versionado passa na validacao de producao | PASS |
| S13: admin A altera staff de B sem contexto de tenant | PASS |
| S24: role picker autoriza mesmo sem modulo exigido pelo app | PASS |
| S26: evento publico aceita conversao e titular de terceiro | PASS |
| S27: lista e consulta por slug expõem receita inativa | PASS |
| S17: confirmacao usa header em vez de IP validado pelo ingress | PASS |
| S13: criacao de endereco deixa tenant e campos internos do body passarem | PASS |
| Positivo: HMAC configurado valida corpo correto e recusa alteracao | PASS |
| S28: API por chave devolve hashes incluidos na relacao customer | PASS |

PASS significa que o comportamento descrito foi reproduzido ou que o controle positivo indicado funcionou. **Não significa que a vulnerabilidade foi corrigida.** Os testes de aceitação dos tickets são requisitos da futura implementação e não foram declarados como aprovados.

### Verificador de resoluções de dependências

Executar na raiz via PowerShell; leitura exclusiva dos lockfiles:

```powershell
@'
const fs=require('fs');const names=["@babel/core","axios","baseline-browser-mapping","body-parser","brace-expansion","browserslist","fast-uri","form-data","js-yaml","multer","qs","sharp","socket.io-parser","ws","@remix-run/router","@vitest/mocker","esbuild","joi","nanoid","postcss","postcss-selector-parser","react-router","react-router-dom","undici","vite","vitest","shell-quote"];const roots=['sistema/backend','sistema/frontend','sistema/admin','sistema/picking-app','sistema/delivery-app','sistema','Notificador'];const out=[];for(const root of roots){const f=root+'/package-lock.json';if(!fs.existsSync(f))continue;const p=JSON.parse(fs.readFileSync(f,'utf8'));for(const [location,v] of Object.entries(p.packages||{})){for(const name of names){if(location.endsWith('node_modules/'+name))out.push({file:f,package:name,path:location,version:v.version,dev:Boolean(v.dev)});}}}console.log(JSON.stringify(out));
'@ | node
```

### Extração das operações HTTP

O extrator registra decoradores reconhecidos, assinaturas e corpo para inspeção em memória. Sua saída não é serialização de registros de clientes:

```powershell
@'
const fs=require('fs'),cp=require('child_process'),ts=require('./sistema/backend/node_modules/typescript'); const files=cp.execFileSync('rg',['--files','sistema/backend/src','-g','*controller.ts']).toString().trim().split(/\r?\n/); files.push('sistema/backend/src/app.module.ts'); const names=new Set(['Controller','Get','Post','Put','Patch','Delete','All','UseGuards','Roles','RequirePermission','RequireModule','RequireApiScope','Throttle','SkipThrottle','RelaxedThrottle']);function deco(n,s){return(ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[]).map(d=>d.expression.getText(s)).filter(t=>names.has(t.split('(')[0]));} console.log(JSON.stringify(files.flatMap(f=>{const src=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),99,true);return src.statements.filter(ts.isClassDeclaration).flatMap(c=>{const cls=deco(c,src);return c.members.filter(ts.isMethodDeclaration).filter(m=>deco(m,src).some(d=>/^(Get|Post|Put|Patch|Delete|All)\(/.test(d))).map(m=>({file:f.replaceAll('\\','/'),line:src.getLineAndCharacterOfPosition(m.getStart(src)).line+1,cls,method:m.name.getText(src),deco:deco(m,src),body:m.body.getText(src),params:m.parameters.map(p=>p.getText(src))}));});})));
'@ | node
```

### Snapshot reproduzível dos artefatos monitorados

O filtro exclui dependências, Git, backups, dist e uploads; não lê valores de arquivos .env. O hash não prova segurança: serve para identificar alterações que exigem revalidação.

```powershell
@'
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'); const all=cp.execFileSync('rg',['--files','--hidden','-g','!node_modules','-g','!.git','-g','!_backup-pre-formatacao','-g','!dist','-g','!uploads']).toString().trim().split(/\r?\n/).map(f=>f.replaceAll('\\','/')); const roots=['sistema/backend/src/','sistema/backend/prisma/','sistema/frontend/src/','sistema/frontend/public/','sistema/admin/src/','sistema/admin/public/','sistema/picking-app/src/','sistema/picking-app/public/','sistema/delivery-app/src/','sistema/delivery-app/public/','Notificador/','.github/workflows/']; const files=all.filter(f=>(roots.some(r=>f.startsWith(r))||/nginx|Dockerfile|docker-compose|Caddyfile/.test(f))&&!/(\.env$|package-lock|\.(png|ico|webp|jpg|mp3|wav)$)/.test(f)); console.log(JSON.stringify({time:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),status:cp.execFileSync('git',['status','--porcelain']).toString(),files:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))}));
'@ | node
```

### Leitura de tickets sem dados secretos

```powershell
orca linear list-issues --team JON --include-archived --order-by createdAt --limit 25 --workspace 15caa64f-ef89-40ed-bbb4-d30f347d3b40 --json
orca linear issue JON-131 --workspace 15caa64f-ef89-40ed-bbb4-d30f347d3b40 --json
orca linear team labels --team JON --workspace 15caa64f-ef89-40ed-bbb4-d30f347d3b40 --json
```

A primeira chamada é somente a primeira página; repetir com --cursor do result.meta.nextCursor até hasMore=false. A conclusão desta auditoria usou o conjunto completo, não somente essa primeira página.

## Revalidação, concorrência e integridade da entrega

| Fotografia | UTC | HEAD | Artefatos monitorados |
|---|---|---|---:|
| Inicial | 2026-09-12T17:58:46.341Z | c56ba051d3c52f88160acd6a6a9aa5865e06853b | 583 |
| Intermediária | 2026-09-12T23:28:52.445Z | d078afbc0f60d580b34fc2bc4eec3de5d14e5e1d | 587 |
| Final de análise | 2026-09-13T14:48:53.353Z | 1ad50ea31862dc0fb1ba35b2de95d54bee1b2bbf | 589 |

As mudanças de HEAD foram produzidas por trabalho concorrente, não por commits desta tarefa. Já havia alterações em docs/deploy.md e numerosos arquivos não rastreados, incluindo a pasta docs/auditoria-360. Não foi feito reset, limpeza, stash ou alteração desses arquivos. O relatório Fase 1 preexistente foi somente lido.

Foram reavaliados os deltas de notificações/agendamento, CMS/campanhas, cupons/pricing, chamadas frontend/admin, integração AntenorApi e nginx administrativo. As seis novas operações incluem disponibilidade pública de cupom, campanha pública por ID ERP e quatro operações administrativas de notificações. A disponibilidade projeta somente validade/contadores; a campanha exige active; endpoints administrativos mantêm JWT/role e seguem sujeitos ao isolamento sistêmico documentado em S13. Nenhum achado foi invalidado por esses deltas. A location exata de upload no nginx não valida conteúdo nem corrige traversal; referências de linha foram atualizadas por read-back no Linear.

A leitura final em lote de **60 tickets**, às **2026-09-13T14:48:36.489Z**, encontrou **zero divergências** de conteúdo, título, prioridade, projeto, estado e label. Ajustes posteriores exclusivamente de referências de linha também foram conferidos individualmente; último registro **2026-09-13T14:51:16.716Z**. As 25 dependências tiveram corpo anterior preservado e leitura posterior individual. Algumas respostas de escrita indicaram confirmação incerta da CLI; o resultado só foi aceito após a leitura canônica correspondente confirmar os campos. Não foram criadas duplicatas por repetição cega de escrita.

### Hashes dos arquivos que sustentam os achados

SHA-256 da fotografia final; arquivos de certificado são identificados por caminho, sem conteúdo ou hash de chave privada neste quadro.

| Arquivo | SHA-256 |
|---|---|
| `Notificador/dorsal.js` | c2e6540476762e11f03093badf3a7d3d11d800ba7480fef26fef0625efa5939a |
| `Notificador/main.js` | 8b3d82a8d7d098b3c2e6ca2ca46f5529092e7a57473d4c97a0b46fa7fdcec0df |
| `sistema/Caddyfile` | 214d62036d8678d46bdb18ae1dc966b6c79b639c99d476c949e465102c295ff1 |
| `sistema/admin/nginx.conf` | 76afba22d7b04d879d4d514ed4adc5d148b0983548775977bb9ab2971b78c3f2 |
| `sistema/admin/src/hooks/useAuth.ts` | c4a0fa3f05465be0b68b8617021d306235de7fde3e9a8520e5a27f284c67ca7c |
| `sistema/admin/src/pages/sections/OrdersSection.tsx` | 4f98fe935fe4320dd55fa6836f90ee8acd4d0c1a59979f0351013d34eef334a0 |
| `sistema/backend/prisma/schema.prisma` | 87ea9d9103b7f8eb8f4fcd9793a41368c3264beebfc43312a47aa64dc3715d33 |
| `sistema/backend/src/app.module.ts` | 003152313f3be8f347c3d6873e62033ee3f8bc44853194db79335b073175a80b |
| `sistema/backend/src/common/decorators/relaxed-throttle.decorator.ts` | 8702306b4d5f2d840e791277c32b3b71304afb18a8b56e4fde0e6fd425635b0a |
| `sistema/backend/src/common/guards/roles.guard.ts` | 33fae621cf194d77c22c4706519cd7e2fd4b58f1c95c64d1d9252f8481dbd6e3 |
| `sistema/backend/src/common/guards/tenant-access.guard.ts` | e78aeb7d3192a0be997c77dca00d235fd06c0855c4ff08b7380044821575c71d |
| `sistema/backend/src/common/interceptors/http-logging.interceptor.ts` | 6865e316d6f754d28e1c2d014fdc2b48937e70379f9dbacaac93de1a729eb3de |
| `sistema/backend/src/common/observability/metrics-registry.ts` | 1c787bb4615d6905b57a4a6d5e05b7d16c7e4c513e19edb56b9e00edb02aed9e |
| `sistema/backend/src/common/security/jwt-secret.ts` | 7ec267ca7343419c8f55c4b4862f8005fe37c8ff47906cc3600e6f824f555318 |
| `sistema/backend/src/common/services/uploads.service.ts` | 14e02f19cbc81ceeabb8408cb975d6094aa60bc3f5968805b2bccb660798b57e |
| `sistema/backend/src/common/strategies/jwt.strategy.ts` | e9654cfb94c878c480957e01fbd8154ba4abe11a2161dfad6bb6cf6fe7342443 |
| `sistema/backend/src/common/tenant/tenant-context.ts` | 3c36e1b431c048ff8143eee8075d69cfa11c53142d0d99b1bd82fed38edb9a58 |
| `sistema/backend/src/main.ts` | 004a5edfc02a92836af99a6664ddcb6b9b619dddd50df2c0dc8d32f5dd699d91 |
| `sistema/backend/src/modules/addresses/addresses.service.ts` | 0ed9c7c9cda913667a92a93a7dd637b9a432c96d8d1830a2f6b131ad85c255b5 |
| `sistema/backend/src/modules/analytics/analytics.controller.ts` | acb13e2bb7ac016acb0f426f2b05dbcbc8eaa90a98ddc4bbf9723d9629a7fc69 |
| `sistema/backend/src/modules/analytics/analytics.service.ts` | 07ff840ebea6a739aef9b8b9bf2cc4e7af0aad5c25406ec87c4aba2197cc242c |
| `sistema/backend/src/modules/auth/auth.controller.ts` | 42aaa5512d9d4d28a28c25c35be2099b95425cd142273fcc2ffe9205bc15b21f |
| `sistema/backend/src/modules/auth/auth.service.ts` | 40c82e11dad5f74b0caa2acd3be4f4b9e79fb9388be856555283bfc46d8fd5c8 |
| `sistema/backend/src/modules/checkout/cart.controller.ts` | 8b9b8e9ed5cafd6f69a268bd47fc1df358757be5e7fe60a463023a739f609f28 |
| `sistema/backend/src/modules/checkout/cart.service.ts` | 9ff4a960b4fbef1ec251843a1d4bb0362ad2822e4a46476aedb8995a67cecceb |
| `sistema/backend/src/modules/checkout/checkout.controller.ts` | 0268f8d84dcf5d539ac4cd4455d24aa3162348d3d2c9152fb3c1dfd5582a76f9 |
| `sistema/backend/src/modules/checkout/checkout.service.ts` | f43a95dd56b4ff5fa5afa073d1c160087468ad0caea99c4e0230d34334874a86 |
| `sistema/backend/src/modules/cms/store-banners/store-banners.service.ts` | a94f8f488e07e0bf79b243d459896cde86c3028f53bbb98a57d4aaac34dff9a3 |
| `sistema/backend/src/modules/customers/customers.service.ts` | 88a2baca46fd8938ff4fbb59c1c37239da4c9bb153ce53c4aabf044d8a66c72f |
| `sistema/backend/src/modules/data-privacy/data-privacy.service.ts` | e92ea8e066a4ffee1e06804b7e6275cc689782d3f73dd0fb4ce04e12e8e35f3d |
| `sistema/backend/src/modules/delivery/delivery.service.ts` | 1d04d6f2d1daecb90067232ca1580c9ccb6c6ac821222c670c9f2cded435cb7e |
| `sistema/backend/src/modules/delivery/driver.controller.ts` | 1f5a9d4fb85386e69d5d2c8dd4b46660109acb594dda516cba0908cb80a6bb78 |
| `sistema/backend/src/modules/integrations/health.controller.ts` | ecaf2aa805b297226fe4c564edd456dd176608c95dd6c3c2541eb84008e13a33 |
| `sistema/backend/src/modules/integrations/integrations.controller.ts` | 4c2b419e849bfcd59deab3b9a341185d39413adfd9b8e3199bbcdcd560af28d8 |
| `sistema/backend/src/modules/integrations/integrations.service.ts` | a0268cebf8cf3de8df2a62228a6aaa734ccc1bbe9120418e46b04cb96cc6b2b5 |
| `sistema/backend/src/modules/integrations/payments-ledger.service.ts` | 6e66d663c428d34904294134951d82a97237bdb252d4f2698835de664db9fc3b |
| `sistema/backend/src/modules/integrations/payments-webhook.service.ts` | 9a5c05f4757615f03688430cf6d718c1431a86badec42d6608e9e755f5ab792a |
| `sistema/backend/src/modules/integrations/webhook.guard.ts` | 969239f9f1fb4ecc463d6da29f83fdce4e6caeb7a185220fe185077618feb9aa |
| `sistema/backend/src/modules/inventory/inventory.controller.ts` | 141aacff657972174fa903441c68038396f8ab5ba64a224d8ec1a8cbd450fd8b |
| `sistema/backend/src/modules/inventory/inventory.service.ts` | c8b730d4070a15a409dda2a5e40d4852576c3409e8fe51db1c5c47f4adfdf57e |
| `sistema/backend/src/modules/marketplace/marketplace.controller.ts` | 9172d271be171e231ed57214e57e5ddd58f6577cb296ed1fadb034dbf69a2f7c |
| `sistema/backend/src/modules/marketplace/marketplace.service.ts` | 56e62c500e1fba1d95076057151060a69b9b184088377a3a08d1f7b2ef80e957 |
| `sistema/backend/src/modules/notifications/notifications.controller.ts` | a6050a0a7ec8b829c0ab6698cd108ee2588146a95a276613df88b8a9c4f59a6c |
| `sistema/backend/src/modules/notifications/notifications.service.ts` | 0929b38a652d7699e2d60e1c5ddb9af0f8239e617ae4f9287913727d511720cc |
| `sistema/backend/src/modules/notifications/push-notification.service.ts` | d76f47d28e08f78f2a838dcafef48e2f15d243a18abe205e5a272c8bd4eaba07 |
| `sistema/backend/src/modules/observability/observability.controller.ts` | 6b4099fd41aae3693c16690fd4ad986c13021a3ffa8cb9c2ee4273d28f39ea67 |
| `sistema/backend/src/modules/orders/orders.service.ts` | 2ee7a84880c0281355558d56aa24a5eb914d1f64bb6a54215bc10fba74a10119 |
| `sistema/backend/src/modules/picking/picker.controller.ts` | 968c702aef2ec913001515a0d049440b250450d907d6906f7bd59b2ce2526a22 |
| `sistema/backend/src/modules/picking/picking.service.ts` | 05ff045ac1559846c447773792ec296f86114488625c9975615d093cd3965d86 |
| `sistema/backend/src/modules/products/products.service.ts` | 211fdb8140444061e563bf4c53135e8b864d7d61ad1b90858bb21aa8560d521f |
| `sistema/backend/src/modules/public-api/public-api.service.ts` | 55c0ecbfdef81e3a47cd7ced1339f9c34ac54ba29cba1e925ff6d8b23e4f0cca |
| `sistema/backend/src/modules/recipes/recipes.controller.ts` | 83a49b2ae038bb9dceb975d408f80fd5a662f0c6437379ea959135954350e2e9 |
| `sistema/backend/src/modules/recipes/recipes.service.ts` | 1be22928f923c00fa00da9d2b1557dc51d60d3403bf9e7aec79d5f4b834476ca |
| `sistema/backend/src/modules/recommendations/recommendations.controller.ts` | 763f53b8e8226e9ec3522d61542c5170d913c6b76bbe8286c7e8468a8b0bf69a |
| `sistema/backend/src/modules/recommendations/recommendations.service.ts` | 322ab94a45b057e2bdc57b016fc38f972fa513945bec2a377dad2d005a738b7a |
| `sistema/backend/src/modules/uploads/uploads.controller.ts` | Fora do filtro de snapshot; referência verificada por leitura dirigida |
| `sistema/delivery-app/nginx.conf` | b288f0ce35b78298072891279f5807d35c5b712ec2b0398463f6a8d81d13b3cd |
| `sistema/delivery-app/src/App.tsx` | 761469c17a7e5ce7a4ab3e3560b1970eb89c14ae2414a52fe73d10ab20ea3429 |
| `sistema/docker-compose.staging.yml` | 6221cafe9cfe190ff608f7b5362243fef9a6fe6a1e0f8e2758eddfb2ec42b125 |
| `sistema/docker-compose.yml` | e860a531a4d41ac83f55871886f95ab1f65e0b92db06771489fcf02c035a0e22 |
| `sistema/frontend/nginx.conf` | 6c9016553681b1f83bc4cc0162e7c1337aaacaf8274fd677faf929b19e7516b3 |
| `sistema/frontend/src/contexts/AuthContext.tsx` | 85847cd65fbee345a6bf49d70aad31b68f23d6cee368c1d03650fb96c7f9d36c |
| `sistema/picking-app/nginx.conf` | b288f0ce35b78298072891279f5807d35c5b712ec2b0398463f6a8d81d13b3cd |
| `sistema/picking-app/src/App.tsx` | 5860bbfdd263a8c0e6fc4add02958d56f3dc7ffcb3a22ce8f0ed6c73bbc89393 |
| `sistema/picking-app/src/hooks/usePushEquipe.ts` | 9d7bca80b8abe31e42a3bbfeaec2a819c95f000e97b401897d5802c1c3387e11 |

### Pendências após a auditoria

As correções dos 35 achados, o tratamento dos advisories herdados e a criação/aplicação da label security permanecem no Backlog. Esta entrega encerra a inspeção e o registro autorizados, sem afirmar remediação. As limitações de cobertura dinâmica e configuração real estão explicitadas para orientar validação futura em ambiente local isolado.

A única criação de arquivo atribuída a esta tarefa é `docs/auditoria-360/02-seguranca-autenticacao-sessoes.md`; nenhuma mudança concorrente de aplicação foi incorporada ou revertida pelo worker.

### Verificação final do artefato

Em **2026-09-13T14:58:30.275Z**, o snapshot posterior à criação deste relatório manteve o mesmo HEAD e os mesmos **589 hashes de fonte/configuração**, sem arquivo removido nesse conjunto. A suíte extraída do próprio Markdown terminou com **29 PASS e código de saída 0**, sem rede, banco real ou remoção real de arquivo. O aviso de ambiente NO_COLOR/FORCE_COLOR foi apenas de apresentação da saída.

O frontmatter foi parseado e os seis campos obrigatórios foram confirmados; os **60 links de tickets** e as **145 referências arquivo:linha** foram validados. O relatório está não rastreado no Git, como esperado para esta tarefa sem commit; não há espaços finais nas linhas. O status geral já continha a pasta de auditoria não rastreada, por isso a conferência também consultou especificamente o caminho do relatório. O registro de operações da tarefa contém somente uma criação de arquivo: este Markdown.

