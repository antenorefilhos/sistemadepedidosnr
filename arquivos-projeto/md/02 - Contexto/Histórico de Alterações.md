---
tipo: historico
status: ativo
area: memoria
prioridade: media
criado: 2026-05-24
atualizado: 2026-05-24
atualizado: 2026-06-05
tags:
  - historico
  - changelog
  - memoria
---

# Histórico de Alterações

## 2026-06-05

### Mudança
Pasta automatica de evidencias Web Push adicionada ao orquestrador.

### Motivo
A guarda anti-sobrescrita resolveu a segurança da pasta, mas ainda exigia lembrar de escolher manualmente uma pasta nova para cada homologação. A prova final precisa de um comando que crie uma execução unica e reduza erro operacional.

### Decisões Arquiteturais
- **Adicionar `--evidence-dir-auto`**, criando uma subpasta automatica dentro de `artifacts/web-push-homologation` ou dentro da base informada em `--evidence-dir`.
- **Adicionar `--evidence-run-id`**, permitindo nomear explicitamente a subpasta da execução.
- **Validar o nome da execução**, aceitando apenas letras, numeros, ponto, hifen e underscore.
- **Manter compatibilidade com `--evidence-dir`**, que continua funcionando como pasta fixa quando `--evidence-dir-auto` nao for usado.

### Impacto
A homologação externa final passa a ter um comando mais seguro: `homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir --send --validate-evidence --report`.

### Validação
- `node --check scripts/homologate-web-push.js`: OK.
- Readiness com `--evidence-dir-auto --evidence-run-id codex-auto-dir-test --require-empty-evidence-dir`: OK.
- `--evidence-run-id bad/id`: falha correta.
- Fluxo seco em staging local com subscription temporaria, validação de evidencias e relatório: OK.
- Cleanup da subscription temporaria: `remaining=0`; env/evidencias temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

### Mudança
Guarda anti-sobrescrita de evidencias Web Push adicionada.

### Motivo
O pacote de homologação final não deve ser sobrescrito acidentalmente por uma nova execução usando a mesma pasta. Isso é especialmente importante depois que o comando passou a gerar evidências e relatório automaticamente.

### Decisões Arquiteturais
- **Adicionar `--require-empty-evidence-dir`**, falhando antes do preflight se a pasta ja tiver arquivos.
- **Adicionar `--force-evidence-overwrite`**, para reaproveitamento consciente quando necessário.
- **Manter a flag opt-in**, preservando flexibilidade para testes locais.
- **Documentar a guarda no comando externo recomendado**, onde a evidência final importa.

### Impacto
A homologação externa fica mais segura contra perda de evidências anteriores e incentiva pastas novas/timestampadas por execução.

### Validação
- `node --check scripts/homologate-web-push.js`: OK.
- Pasta ocupada com `--require-empty-evidence-dir`: falha correta.
- Pasta ocupada com `--force-evidence-overwrite`: passou em `--readiness-only`.
- `npm run validate:web-push-tooling`: OK.

### Mudança
Homologação Web Push integrada com validação de evidencias e relatório.

### Motivo
Depois de criar evidências, validador e relatório, ainda era fácil esquecer um dos comandos de fechamento. A homologação externa deve ter um caminho único que gere, valide e resuma as evidências no mesmo fluxo.

### Decisões Arquiteturais
- **Adicionar `--validate-evidence` ao `homologate:web-push`**, chamando o validador depois do dry-run/envio.
- **Adicionar `--report` ao `homologate:web-push`**, chamando o gerador de relatório depois da validação possível.
- **Exigir `--evidence-dir` para ambos**, evitando validação/relatório sem artefatos.
- **Passar `--require-send` automaticamente quando `--send` for usado**, mantendo o rigor do pacote final.

### Impacto
A prova externa final pode ser executada com um único comando operacional, reduzindo erro humano no fechamento.

### Validação
- `node --check scripts/homologate-web-push.js`: OK.
- Homologação seca integrada com `--validate-evidence --report`: OK.
- `--report` sem `--evidence-dir` falhou corretamente.
- Cleanup da subscription temporária: `remaining=0`.

### Mudança
Relatorio Markdown de homologação Web Push adicionado.

### Motivo
O pacote JSON resolve auditoria técnica, mas ainda faltava um resumo humano para anexar rapidamente ao changelog/status depois da prova externa. O relatório precisa nascer a partir de evidencias já validadas, não de preenchimento manual.

### Decisões Arquiteturais
- **Adicionar `generate-web-push-homologation-report.js`**, lendo a pasta de evidencias.
- **Validar o pacote antes de gerar relatório**, chamando `validate-web-push-evidence`.
- **Manter `--require-send`**, para diferenciar relatório de dry-run e relatório final com envio real.
- **Gerar Markdown no próprio diretório de evidencias**, por padrão.

### Impacto
Depois da homologação externa, o fechamento operacional passa a ser: gerar evidencias, validar pacote e gerar relatório Markdown para anexar à documentação.

### Validação
- `node --check scripts/generate-web-push-homologation-report.js`: OK.
- Fixture sem envio gerou relatório: OK.
- `--require-send` falhou corretamente sem `web-push-send.json`.
- Pacote real de dry-run gerado por `homologate:web-push`: relatório gerado com sucesso.
- Cleanup da subscription temporária: `remaining=0`.

### Mudança
Validador do pacote de evidencias Web Push adicionado.

### Motivo
Depois de gerar evidencias JSON, ainda faltava um gate que comprovasse se o pacote está completo e consistente. A prova externa precisa terminar com uma validação objetiva, especialmente quando o envio real for executado com `--send`.

### Decisões Arquiteturais
- **Adicionar `validate-web-push-evidence.js`**, lendo evidencias de uma pasta.
- **Criar `--require-send`**, separando pacote de dry-run de pacote final com envio real.
- **Validar ausência de campos sensíveis**, como VAPID privado, `auth` e `p256dh`.
- **Testar com fixture e com evidencias geradas pelo orquestrador**, evitando validação só sintética.

### Impacto
A homologação externa passa a ter fechamento automatizado: gerar evidencias com `homologate:web-push -- --evidence-dir` e validar com `validate:web-push-evidence -- --require-send`.

### Validação
- `node --check scripts/validate-web-push-evidence.js`: OK.
- Fixture sem envio: OK.
- `--require-send` falhou corretamente sem `web-push-send.json`.
- Fixture com envio: OK.
- Pacote real de dry-run gerado por `homologate:web-push`: OK.
- Cleanup da subscription temporária: `remaining=0`.

### Mudança
Evidencias JSON adicionadas à homologação Web Push.

### Motivo
A prova externa de Web Push precisa deixar um rastro auditável além do log no terminal. Sem um artefato estruturado, fica mais fácil perder filtros usados, contagem de subscriptions, alvo validado, resultado do dry-run e resultado do envio real.

### Decisões Arquiteturais
- **Adicionar `--json-output` em inspeção e prova**, mantendo o log humano existente.
- **Adicionar `--evidence-dir` no orquestrador**, gravando arquivos separados para inspeção, dry-run e envio.
- **Mascarar endpoints e omitir segredos**, evitando vazamento de VAPID privado.
- **Validar com subscription temporaria em staging local**, sem envio real.

### Impacto
A homologação externa pode gerar um pacote de evidências reaproveitável em changelog/status, com dados suficientes para auditoria e sem expor segredo.

### Validação
- `node --check` nos scripts alterados: OK.
- Homologação seca com `--evidence-dir`: OK.
- JSONs de inspeção/dry-run parseados e validados.
- Cleanup da subscription temporária: `remaining=0`.

### Mudança
Gate automatizado da tooling operacional de Web Push adicionado.

### Motivo
Os scripts de preparo, inspeção e prova já estavam funcionais, mas a sequência de validação ficava espalhada em comandos manuais. Antes de mexer em `.env.staging` real ou chaves VAPID finais, é melhor ter um gate rápido que prove que geração, reaproveitamento de chaves e merge seguro continuam funcionando.

### Decisões Arquiteturais
- **Adicionar `validate-web-push-tooling.js`**, isolado em `sistema/scripts`.
- **Executar tudo com arquivos temporarios**, evitando tocar `.env.staging` real.
- **Comparar VAPID por hash**, sem imprimir chave privada.
- **Cobrir `--merge-existing`**, preservando variáveis não-WebPush.

### Impacto
Alterações futuras na tooling de Web Push podem ser validadas com um comando único antes de homologar em ambiente real.

### Validação
- `node --check scripts/validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK.
- Cenários cobertos: env gerado, readiness, `--vapid-from-env` e `--merge-existing`.

### Mudança
Merge seguro de `.env` adicionado ao preparador Web Push.

### Motivo
Usar `prepare:web-push-env --output .env.staging --force` substitui o arquivo inteiro. Em staging real, isso poderia apagar variaveis de banco, integrações, feature flags ou outras configurações não relacionadas ao Web Push.

### Decisões Arquiteturais
- **Adicionar `--merge-existing`**, deixando a preservação explícita.
- **Atualizar apenas chaves geradas pelo Web Push**, preservando comentários e variáveis desconhecidas.
- **Manter `--force` como substituição total**, para rotação consciente.
- **Exibir `Write mode`**, deixando claro se houve merge ou replace.

### Impacto
Atualizações de `.env.staging` para Web Push ficam seguras para uso incremental, sem risco de apagar configurações do ambiente.

### Validação
- `node --check scripts/prepare-web-push-env.js`: OK.
- Merge preservou `NODE_ENV=staging` e `CUSTOM_KEEP=nao-apagar`.
- Preflight com env mergeado: OK.
- Temporario removido.

### Mudança
Inspeção e prova Web Push passaram a aceitar `--env-file`.

### Motivo
O orquestrador ja carregava arquivo de ambiente, mas os comandos individuais ainda dependiam de `.env`/`.env.staging` ou variáveis do terminal. Isso criava divergência entre runbook detalhado e fluxo orquestrado.

### Decisões Arquiteturais
- **Adicionar `--env-file` aos scripts existentes**, mantendo os mesmos filtros e comportamento.
- **Aplicar override sobre `.env`, `.env.local` e `.env.staging`**, igual ao preflight.
- **Validar com fixture temporária**, provando inspeção direta e dry-run direto sem envio real.

### Impacto
Agora todos os comandos principais da homologação aceitam o mesmo artefato `.env.staging`: preflight, inspeção, dry-run/prova e orquestrador.

### Validação
- `node --check scripts/inspect-web-push-subscriptions.js`: OK.
- `node --check scripts/prove-web-push-delivery.js`: OK.
- Inspeção direta com `--env-file`: `total=1 complete=1 incomplete=0`.
- Prova direta com `--env-file --dry-run`: `targets=1 failed=0`.
- Cleanup da subscription temporária: `deleted=1 remaining=0`.

### Mudança
Preparador Web Push passou a reutilizar VAPID via env.

### Motivo
Passar `--vapid-private-key` por argumento resolve o caso funcional, mas expõe segredo na linha de comando e no histórico. Para ambiente real, o caminho preferível é ler o par de um arquivo local/seguro e reemitir `.env.staging` sem rotacionar chaves.

### Decisões Arquiteturais
- **Carregar `.env`, `.env.local`, `.env.staging` e `--env-file`**, com override explícito quando informado.
- **Adicionar `--vapid-from-env`**, priorizando `STAGING_VAPID_*` em modo staging.
- **Bloquear mistura com chaves por argumento**, evitando ambiguidade de fonte.
- **Validar por hash sem imprimir segredo**, confirmando reutilização do mesmo par.

### Impacto
O operador pode atualizar origem, CORS ou `DATABASE_URL` de `.env.staging` preservando VAPID existente e sem colocar chave privada no comando.

### Validação
- `node --check scripts/prepare-web-push-env.js`: OK.
- Env derivado por `--vapid-from-env --env-file` passou no preflight.
- Hashes confirmaram `publicSame=True privateSame=True` sem imprimir segredo.
- Conflito entre `--vapid-from-env` e chaves por argumento falhou corretamente.
- Temporarios removidos.

### Mudança
Preparador Web Push passou a aceitar VAPID existente.

### Motivo
Depois que o ambiente externo tiver um par VAPID final aprovado, gerar novas chaves automaticamente pode quebrar subscriptions existentes. A homologação precisava de um caminho explícito para montar `.env.staging` com o par já escolhido.

### Decisões Arquiteturais
- **Aceitar `--vapid-public-key` e `--vapid-private-key` juntos**, evitando par parcial.
- **Validar tamanho base64url e `web-push.setVapidDetails`**, reaproveitando a mesma regra do runtime.
- **Manter geração automática quando nenhum par for fornecido**, preservando o fluxo rápido de primeira configuração.
- **Mostrar `VAPID: generated/provided`**, deixando claro se houve rotação.

### Impacto
O operador pode preparar o `.env.staging` com chaves finais existentes sem gerar novo par por acidente. Isso protege subscriptions reais já registradas.

### Validação
- `node --check scripts/prepare-web-push-env.js`: OK.
- Modo gerado passou no preflight.
- Modo fornecido passou no preflight.
- Par incompleto falhou corretamente.
- Temporarios removidos.

### Mudança
Homologação seca Web Push validada com banco staging.

### Motivo
O orquestrador ja validava o preflight, mas a prova operacional precisava demonstrar o caminho completo ate o dry-run usando `DATABASE_URL`, inspeção de subscription completa e payload de prova, sem disparar notificação real.

### Decisões Arquiteturais
- **Adicionar `--database-url` ao `prepare:web-push-env`**, para que o arquivo de homologação carregue banco, origem e VAPID juntos.
- **Validar com subscription temporária filtrada**, evitando depender de cliente real e evitando tocar em subscriptions existentes.
- **Limpar a fixture ao final**, confirmando `remaining=0`.
- **Manter envio real protegido por `--send`**, preservando a etapa como dry-run seguro.

### Impacto
O fluxo `prepare:web-push-env` + `homologate:web-push` agora foi comprovado até o ponto imediatamente anterior ao envio real. A pendência restante ficou estritamente ambiental: subscription real criada pelo navegador/PWA em HTTPS e execução final com `--send`.

### Validação
- `node --check scripts/prepare-web-push-env.js`: OK.
- `.tmp-web-push-db.env` gerado com `DATABASE_URL` staging local.
- Subscription temporaria `codex-homologate-dry-run` criada.
- `npm run homologate:web-push -- --env-file .tmp-web-push-db.env --endpoint-contains codex-homologate-dry-run --limit 1`: OK, `targets=1 failed=0`.
- Cleanup da subscription temporaria: `deleted=1 remaining=0`.
- Inspeção final filtrada: `total=0 complete=0 incomplete=0`.

### Mudança
Orquestrador de homologação Web Push adicionado.

### Motivo
O runbook ja tinha todos os comandos, mas a execução final ainda dependia de rodar manualmente preflight, inspeção, dry-run e envio real na ordem correta. Isso aumentava a chance de pular o gate de subscription ou disparar uma notificação antes da conferência.

### Decisões Arquiteturais
- **Criar `homologate-web-push.js` como orquestrador**, reaproveitando os scripts validados em vez de duplicar regras.
- **Nao enviar por padrão**, exigindo `--send` para o disparo real.
- **Carregar `--env-file` no processo pai**, permitindo que inspeção e prova recebam as variáveis mesmo sem parse próprio de `--env-file`.
- **Preservar filtros e payload**, repassando cliente, tenant, endpoint, limite, título, corpo, ícone e URL aos scripts existentes.

### Impacto
A homologação externa passa a ter um único comando seguro para preparar a prova: `cd sistema && npm run homologate:web-push -- --external --live --env-file .env.staging`. O envio real fica em uma segunda execução explícita com `--send`.

### Validação
- `node --check scripts/homologate-web-push.js`: OK.
- `npm run homologate:web-push -- --external --env-file .tmp-web-push.env --readiness-only`: OK.
- Sem `--readiness-only`, a execução avançou para inspeção e falhou corretamente por `DATABASE_URL` ausente no env temporário.

### Mudança
Preparador de arquivo env Web Push adicionado.

### Motivo
Depois de gerar VAPID e alinhar `.env.staging` ao Compose, ainda havia uma etapa manual sujeita a erro: montar o arquivo com origem, CORS, `VITE_VAPID_PUBLIC_KEY` e variaveis VAPID coerentes. O preflight ja detectava inconsistencia, mas faltava um comando que produzisse o arquivo pronto.

### Decisões Arquiteturais
- **Criar `prepare-web-push-env.js` como comando separado**, mantendo `generate-web-push-vapid.js` simples para quem so quer as chaves.
- **Nao sobrescrever arquivos por padrao**, exigindo `--force` para rotacao consciente.
- **Gerar `VITE_VAPID_PUBLIC_KEY` junto com VAPID**, garantindo paridade entre backend e build do storefront.
- **Suportar staging e default**, com `STAGING_VAPID_*` quando `--staging` estiver presente.

### Impacto
A homologacao externa pode iniciar com um comando unico: `cd sistema && npm run prepare:web-push-env -- --output .env.staging --staging --origin https://SEU-DOMINIO --admin-origin https://SEU-ADMIN --subject mailto:admin@antenor.com.br`. Em seguida, o mesmo arquivo alimenta `staging-ops.ps1`, Compose e `validate:web-push-readiness`.

### Validação
- `node --check scripts/prepare-web-push-env.js`: OK.
- Arquivo HTTPS temporario gerado com `--staging` alimentou `validate:web-push-readiness -- --external --env-file`: OK.
- Protecao contra sobrescrita sem `--force`: falha esperada.
- `--subject invalid-subject`: falha esperada sem stack trace.
- Arquivo local temporario alimentou `validate:web-push-readiness -- --env-file`: OK.

### Mudança
Ponte `.env.staging`/Compose adicionada para Web Push.

### Motivo
O projeto ja conseguia gerar chaves VAPID, mas a aplicacao no staging ainda dependia de lembrar manualmente que o Compose consome `STAGING_VAPID_*`. O exemplo de ambiente nao deixava esse contrato claro e o helper de staging nao carregava `.env.staging`.

### Decisões Arquiteturais
- **Documentar `STAGING_VAPID_*` no `.env.staging.example`**, alinhando o arquivo ao contrato real do Compose.
- **Carregar `.env.staging` no `staging-ops.ps1` quando existir**, sem quebrar o fallback local.
- **Parametrizar URLs do staging no Compose**, permitindo homologacao HTTPS externa sem editar YAML.
- **Manter segredos fora do repositorio**, deixando apenas placeholders nos exemplos.

### Impacto
A etapa entre gerar VAPID e rebuildar o staging ficou reproduzivel: criar `.env.staging`, preencher `STAGING_VAPID_*`/origem HTTPS e rodar `.\staging-ops.ps1 up` ou `docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build`.

### Validação
- Sintaxe PowerShell de `staging-ops.ps1`: OK.
- `docker compose -f docker-compose.staging.yml config --quiet`: OK.
- Varredura confirmou `STAGING_VAPID_*`, `WEB_PUSH_ORIGIN` e URLs staging nos arquivos esperados.

### Mudança
Gerador VAPID operacional adicionado ao Web Push.

### Motivo
O runbook dependia de chaves VAPID finais, mas não havia comando oficial para gerá-las dentro do projeto. Isso criava atrito e risco de usar chaves malformadas na homologação externa.

### Decisões Arquiteturais
- **Usar o pacote `web-push` do backend**, mantendo a geração alinhada ao runtime real.
- **Não gravar segredo automaticamente**, apenas imprimir blocos para PowerShell, `.env` ou JSON.
- **Validar `--subject`**, aceitando somente `mailto:` ou `https://`, que são os formatos aceitos pelo Web Push.
- **Suportar prefixo staging**, gerando `STAGING_VAPID_*` quando solicitado.

### Impacto
A sequência de homologação agora começa com um comando reproduzível para criar VAPID: `cd sistema && npm run generate:web-push-vapid`. As chaves geradas podem alimentar o preflight externo imediatamente.

### Validação
- `node --check scripts/generate-web-push-vapid.js`: OK.
- `npm run generate:web-push-vapid -- --subject mailto:qa@antenor.com.br`: OK.
- `npm run generate:web-push-vapid -- --staging --env --subject https://antenor.com.br`: OK.
- `npm run generate:web-push-vapid -- --subject invalid-subject`: falha esperada sem stack trace.
- Chaves geradas via `--json` alimentaram `npm run validate:web-push-readiness -- --external`: OK.

### Mudança
Dry-run adicionado à prova assistida Web Push.

### Motivo
Antes do envio real, o operador precisa conseguir conferir se os filtros, payload e subscriptions alvo estão corretos sem disparar uma notificação ou remover registros. Isso reduz risco na homologação externa em dispositivo real.

### Decisões Arquiteturais
- **Adicionar `--dry-run` ao script existente**, mantendo um único comando operacional de prova.
- **Não chamar `webpush.sendNotification` no dry-run**, para garantir que não haja disparo acidental.
- **Não executar limpezas no dry-run**, mesmo que flags de cleanup sejam passadas.
- **Validar com subscription temporária controlada**, removida no `finally`, para não poluir staging.

### Impacto
A sequência externa recomendada passa a ser: preflight live, inspeção com `--require-ready`, dry-run da prova, envio real. O envio final segue pendente de subscription real em HTTPS/VAPID final.

### Validação
- `node --check scripts/prove-web-push-delivery.js`: OK.
- Subscription temporária `codex-dry-run` criada, validada no dry-run e removida: `targets=1 failed=0`, cleanup `deleted=1`.
- `npm run inspect:web-push-subscriptions` após limpeza: `total=0 complete=0 incomplete=0`.
- Dry-run após limpeza falhou corretamente por nenhuma subscription encontrada.

### Mudança
Script de prova assistida Web Push endurecido.

### Motivo
A homologação externa depende de um comando confiável para disparar a notificação real depois que a subscription existir. O script já enviava a prova, mas ainda aceitava `limit` inválido, não filtrava por tenant e não tinha opção explícita para limpar registros expirados ou incompletos durante a operação.

### Decisões Arquiteturais
- **Validar `--limit` entre 1 e 100**, evitando query ampla ou inválida por erro operacional.
- **Adicionar `--tenant`**, alinhando a prova ao diagnóstico de subscriptions.
- **Adicionar limpeza explícita**, com `--cleanup-expired` para 404/410 e `--cleanup-incomplete` para registros sem chaves completas.
- **Não limpar por padrão**, porque a prova operacional deve ser previsível e evitar mutação destrutiva acidental.

### Impacto
O operador pode rodar a prova externa com filtros mais seguros e limpar subscriptions inválidas apenas quando decidir. A pendência final continua sendo registrar uma subscription real em HTTPS/VAPID final e obter `sent>=1 failed=0`.

### Validação
- `node --check scripts/prove-web-push-delivery.js`: OK.
- `npm run prove:web-push-delivery` contra staging: falha esperada por nenhuma subscription real.
- `npm run inspect:web-push-subscriptions` contra staging: `total=0 complete=0 incomplete=0`.
- `npm run prove:web-push-delivery -- --limit 0`: falha esperada com validação de limite.

### Mudança
Cypress de inscrição Web Push adicionado ao storefront.

### Motivo
O projeto já tinha CTA de ativação, preflight, inspeção de banco e prova assistida, mas faltava uma cobertura automatizada que provasse o caminho do botão até o contrato `/notifications/push-subscribe`. Sem isso, uma regressão no hook, na serialização da subscription ou na conversão VAPID poderia passar despercebida antes da homologação externa.

### Decisões Arquiteturais
- **Criar spec autocontida**, seguindo o padrão do storefront com `supportFile: false`.
- **Mockar APIs reais do navegador**, incluindo `Notification`, `serviceWorker.ready` e `PushManager`.
- **Validar o payload enviado à API**, não apenas a presença visual do CTA.
- **Usar VAPID temporária no dev server**, preservando chaves finais fora do teste.

### Impacto
O M33 Web Push passa a ter uma prova automatizada de inscrição no storefront, cobrindo o contrato necessário para que a homologação externa avance quando houver domínio HTTPS, VAPID final e dispositivo real.

### Validação
- Cypress local `web-push-subscribe.cy.ts`: 1/1 OK.
- Frontend `npm run build` com `VITE_VAPID_PUBLIC_KEY` temporária: OK.
- `npm run validate:obsidian-links`: OK.
- `npm run validate:web-push-readiness -- --live` contra staging local: OK.

### Mudança
Validação de links operacionais da wiki Obsidian adicionada e executada.

### Motivo
A organização da wiki ainda tinha uma pendência explícita para validar links. Após várias reorganizações em subpastas, alguns wikilinks e links Markdown ainda apontavam para caminhos antigos, o que prejudicava retomada por humanos e IAs.

### Decisões Arquiteturais
- **Criar validador próprio em Node**, sem depender de plugin do Obsidian.
- **Validar wikilinks e links Markdown locais**, cobrindo os formatos usados na wiki.
- **Ignorar `06 - Sessões` por padrão**, porque são transcrições históricas brutas e não páginas operacionais de navegação.
- **Manter `--include-sessions`**, para auditoria rígida quando for necessário analisar o histórico bruto.

### Impacto
A wiki operacional passa a ter gate reproduzível por `npm run validate:obsidian-links`. A pendência "Validar todos os links no Obsidian" foi fechada para os arquivos operacionais, e os links quebrados restantes ficam restritos a sessões históricas preservadas.

### Validação
- `node --check scripts/validate-obsidian-links.js`: OK.
- `npm run validate:obsidian-links`: OK, 42 arquivos operacionais, 3 sessões ignoradas e 0 links quebrados.
- `node scripts/validate-obsidian-links.js --include-sessions`: falha esperada com 5 links quebrados apenas em transcrições históricas.

### Mudança
Preflight live de Web Push adicionado à homologação externa.

### Motivo
O Web Push já tinha validação de variáveis, arquivos locais e prova assistida, mas a homologação final precisa provar que o domínio publicado realmente entrega HTML, manifesto e service worker corretos. Sem essa checagem, o teste poderia chegar ao dispositivo com erro de publicação ou cache.

### Decisões Arquiteturais
- **Adicionar `--live` ao preflight existente**, mantendo o comando atual compatível.
- **Carregar `.env.staging` no validador**, alinhando o preflight aos scripts de inspeção e prova.
- **Aceitar `--env-file`**, para homologação com arquivo temporário de variáveis sem alterar `.env`.
- **Validar a origem publicada por HTTP**, cobrindo HTML, manifesto, service worker, Content-Type, cache e handlers mínimos.

### Impacto
A prova externa passa a ter uma etapa objetiva antes da inscrição do navegador: `npm run validate:web-push-readiness -- --external --live`. A pendência restante continua ambiental: aplicar VAPID real, usar domínio HTTPS, registrar subscription real e provar `sent>=1`.

### Validação
- `node --check scripts/validate-web-push-readiness.js`: OK.
- `npm run validate:web-push-readiness -- --live` contra staging local: OK.
- `npm run validate:web-push-readiness -- --external` com origem HTTPS/VAPID temporários: OK.
- `npm run inspect:web-push-subscriptions` contra staging: `total=0 complete=0 incomplete=0`.
- `npm run prove:web-push-delivery` contra staging com VAPID temporário: falha esperada por nenhuma subscription registrada.

### Mudança
Capas WebP próprias e copy/SEO finais adicionados ao acervo editorial de receitas.

### Motivo
As receitas já estavam publicadas e validadas, mas ainda usavam banners genéricos como capa. Para deixar a experiência pronta para produção, cada receita precisava de imagem editorial própria e copy revisada com acentuação, SEO e instruções mais naturais.

### Decisões Arquiteturais
- **Gerar capas como bitmap**, usando a skill `imagegen`, porque receitas precisam de fotografia editorial, não de ilustração vetorial.
- **Converter para WebP com `ffmpeg`**, mantendo os arquivos finais leves em `sistema/frontend/public/recipes/`.
- **Preservar slugs e produtos vinculados**, evitando quebrar contratos do seed e do carrinho.
- **Endurecer o gate editorial**, validando `imageUrl` esperado por slug e existência física do asset.

### Impacto
O acervo editorial de staging passa a ter 5 receitas com capas próprias, copy/SEO revisados, relacionadas e produtos reais. A frente local de conteúdo visual das receitas fica fechada; a pendência maior restante continua sendo Web Push externo em HTTPS/VAPID real.

### Validação
- `node --check scripts/seed-staging-recipes.js`: OK.
- `node --check scripts/validate-staging-recipes.js`: OK.
- `npm run seed:staging-recipes` contra staging: 5 receitas publicadas.
- `npm run validate:staging-recipes` contra staging: OK.
- Frontend `npm run build`: OK.
- Assets `/recipes/*.webp` em staging: 5/5 HTTP 200, `image/webp`.
- Cypress staging `staging-secondary-routes-real.cy.ts` + `secondary-routes-visual.cy.ts`: 20/20.
- Cypress staging `staging-smoke.cy.ts`: 1/1.
- Cypress staging `staging-secondary-routes-real.cy.ts` após copy final: 4/4.

### Mudança
Busca/Search e Promoções do storefront migrados para o UI kit.

### Motivo
Depois dos utilitários de entrega/notificações, a página de busca ainda concentrava a maior quantidade de controles nativos no storefront: busca, limpar busca, sugestões, categorias, filtros, selects mercadológicos, limpar filtros, sugestões rápidas, estado vazio e CTA móvel. Promoções ainda mantinha o helper legado `btn-gold`.

### Decisões Arquiteturais
- **Migrar a camada visual de `Search`**, preservando query params, tracking, paginação infinita, filtros CMS/mercadológicos e comportamento de foco.
- **Evoluir o primitive `Input` com `forwardRef`**, porque a busca depende de `blur()` programático via `inputRef`.
- **Remover `btn-gold` de `Promocoes`**, usando `buttonVariants` em link navegacional.
- **Manter a validação existente**, usando `mobile-visual-smoke` para Mercado/Search e `secondary-routes-visual` para Promoções.

### Impacto
O storefront fica sem controles nativos diretos em `src/components` e `src/pages`, exceto pelos wrappers `components/ui/*` e pelo compat layer `LoadingButton`. A próxima frente local deixa de ser UI kit estrutural e passa a ser conteúdo final de produção ou a homologação externa de Web Push.

### Validação
- Varredura `rg` em `sistema/frontend/src/components` e `sistema/frontend/src/pages`: controles nativos diretos apenas em wrappers `components/ui/*` e `LoadingButton`.
- Frontend `npm run build`: OK.
- Cypress local `mobile-visual-smoke.cy.ts` + `secondary-routes-visual.cy.ts`: 36/36.
- Docker staging `storefront_staging` rebuildado/recriado, com `api_staging` recriado pela composição.
- API staging `/health`: OK.
- Storefront staging `http://127.0.0.1:4000`: HTTP 200.
- Cypress staging `mobile-visual-smoke.cy.ts` + `secondary-routes-visual.cy.ts` + `staging-smoke.cy.ts`: 37/37.

### Mudança
`DeliveryVerificationModal` e `NotificationBell` do storefront migrados para o UI kit.

### Motivo
Depois de Conta/Fallbacks, ainda havia componentes utilitários importantes usando botões, inputs e superfícies próprias. O modal de entrega aparece no fluxo inicial de endereço/CEP e o sino é o ponto operacional do Web Push, então ambos precisavam seguir o mesmo contrato visual do storefront.

### Decisões Arquiteturais
- **Preservar lógica de domínio**, mantendo GPS, fallback de CEP, consulta de endereço, cálculo de entrega, cache local e fluxo de Web Push.
- **Migrar somente a camada visual**, usando `Button`, `Input`, `surfaceClasses` e `cn`.
- **Adicionar semântica de dialog**, com `role="dialog"`, `aria-modal` e `aria-labelledby` no modal de verificação de entrega.
- **Ampliar o smoke visual existente**, cobrindo o fluxo do modal em mobile com geolocalização negada, CEP, número, cálculo de entrega e overflow.

### Impacto
O UI kit do storefront passou a cobrir também os utilitários de entrega e notificações. Na sequência, Busca/Search e Promoções também foram migrados; a entrega externa de Web Push segue dependente de domínio HTTPS, VAPID real e subscription registrada.

### Validação
- Frontend `npm run build`: OK.
- Cypress local `mobile-visual-smoke.cy.ts`: 20/20.
- Docker staging `storefront_staging` rebuildado/recriado, com `api_staging` recriado pela composição.
- API staging `/health`: OK.
- Storefront staging `http://127.0.0.1:4000`: HTTP 200.
- Cypress staging `mobile-visual-smoke.cy.ts`: 20/20.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.

### Mudança
Conta e fallbacks do storefront migrados para o UI kit.

### Motivo
Depois de Login/Cadastro, ainda restavam superfícies de conta e fallback usando classes diretas para botões, cards e selects. Essas telas aparecem em fluxos importantes de retorno, erro e área autenticada, então precisavam acompanhar o padrão visual do storefront.

### Decisões Arquiteturais
- **Migrar controles principais de `Account`**, preservando hooks, filtros, query string e fluxo de repetir pedido.
- **Usar primitives nos fallbacks**, deixando `NotFound`, `Forbidden` e `ErrorBoundary` no mesmo contrato visual.
- **Criar Cypress focado**, com conta autenticada mockada, tabs, filtro de pagamento, detalhe de pedido, endereço e fallbacks 403/404 em mobile e desktop.

### Impacto
O UI kit do storefront passa a cobrir também Conta e estados de erro/navegação inválida. A frente de polimento visual restante fica restrita a componentes utilitários menores, enquanto a entrega externa de Web Push continua aguardando ambiente HTTPS/VAPID real.

### Validação
- Frontend `npm run build`: OK.
- Cypress local `account-fallback-ui-kit.cy.ts`: 4/4.
- Cypress local `auth-ui-kit.cy.ts`: 4/4.
- Docker staging `storefront_staging` rebuildado/recriado, com `api_staging` recriado pela composição.
- API staging `/health`: OK.
- Cypress staging `account-fallback-ui-kit.cy.ts`: 4/4.
- Cypress staging `auth-ui-kit.cy.ts`: 4/4.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.

### Mudança
Login e Cadastro do storefront migrados para o UI kit.

### Motivo
Depois de Home/Mercado/Produto/Carrinho/Checkout/Adega, as telas de autenticação ainda usavam inputs, selects e botões com classes próprias. Isso deixava a experiência de entrada fora do padrão visual que já estava consolidado no storefront.

### Decisões Arquiteturais
- **Criar primitive `Select` no UI kit do storefront**, em vez de manter select nativo estilizado direto no Cadastro.
- **Reutilizar `buttonVariants` no `LoadingButton`**, preservando o comportamento de loading e alinhando Checkout/Login/Cadastro ao mesmo contrato visual.
- **Migrar Login/Cadastro com escopo curto**, sem alterar fluxo de autenticação, validação, payload de registro ou navegação.
- **Corrigir o link de voltar no mobile**, deixando-o estático em telas pequenas para não sobrepor o card.

### Impacto
O UI kit do storefront passou a cobrir também as rotas de autenticação. A fatia seguinte foi Conta/Fallbacks, enquanto a homologação Web Push externa continua dependente de ambiente HTTPS/VAPID real.

### Validação
- Frontend `npm run build`: OK.
- Browser interno em `http://127.0.0.1:5173`: Login/Cadastro desktop/mobile sem erros de console e sem overflow horizontal.
- Cypress local `auth-ui-kit.cy.ts`: 4/4.
- Docker staging `storefront_staging` rebuildado/recriado, com `api_staging` recriado pela composição.
- API staging `/health`: OK.
- Cypress staging `auth-ui-kit.cy.ts`: 4/4.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.

### Mudança
Runbook externo de homologação Web Push criado.

### Motivo
Com preflight, inspeção, CTA e prova real prontos, faltava um documento operacional que colocasse tudo em ordem para execução no domínio HTTPS final. Sem isso, a homologação ainda dependeria de memória da sessão.

### Decisões Arquiteturais
- **Criar `RUNBOOK_WEB_PUSH.md` em Contexto**, porque é material de retomada e operação.
- **Separar preflight, inscrição, inspeção e envio**, preservando cada comando com seu papel.
- **Documentar diagnóstico por sintoma**, para acelerar correções quando o dispositivo ou o domínio externo falhar.

### Impacto
A pendência externa do M33 Web Push agora tem roteiro executável, critérios de aceite e comandos de evidência. O trabalho restante é ambiental: aplicar VAPID real em HTTPS, registrar subscription e provar recebimento.

### Validação
- Runbook criado em `arquivos-projeto/md/02 - Contexto/RUNBOOK_WEB_PUSH.md`.
- Índice de Arquivos atualizado com link para o runbook.
- Status, Roadmap, Próximas Ações, Pendências, Referência Técnica e Onde Parei sincronizados para `1.24.94-alpha`.

### Mudança
Inspeção operacional de subscriptions Web Push criada.

### Motivo
Depois do CTA e do script de prova, ainda faltava um comando simples para responder se o banco ja tem subscription real pronta para envio. Sem essa etapa, a homologacao externa poderia tentar `prove:web-push-delivery` sem saber se o navegador realmente registrou a inscrição.

### Decisões Arquiteturais
- **Separar inspeção de envio**, mantendo `inspect:web-push-subscriptions` como diagnóstico e `prove:web-push-delivery` como prova real.
- **Permitir filtros operacionais**, por cliente, email, tenant, endpoint e limite.
- **Adicionar `--require-ready`**, para usar o inspetor como gate quando a rotina de homologação precisar falhar sem subscription completa.

### Impacto
A homologação Web Push ganhou uma etapa verificável entre ativar notificações no storefront e disparar a prova real. O staging atual confirma 0 subscriptions registradas, então a pendência externa ficou explícita.

### Validação
- `node --check scripts/inspect-web-push-subscriptions.js`: OK.
- `npm run inspect:web-push-subscriptions` contra staging: `total=0 complete=0 incomplete=0`.
- `npm run inspect:web-push-subscriptions -- --require-ready` contra staging: falha esperada enquanto não existe subscription real completa.

### Mudança
CTA de inscrição Web Push exposto no sino do storefront.

### Motivo
O backend, service worker, manifesto, preflight e script de prova ja estavam prontos, mas a homologacao externa ainda precisava de um caminho claro para o cliente logado registrar a subscription no navegador. Sem esse CTA, o teste em HTTPS dependeria de chamada manual ou console.

### Decisões Arquiteturais
- **Usar `NotificationBell` como ponto de entrada**, porque ele ja aparece no header para cliente logado.
- **Expandir `useNotifications` com status de push**, distinguindo ativo, bloqueado, sem suporte, sem VAPID e erro.
- **Nao disparar permissao automaticamente**, mantendo a chamada ligada a acao explicita do usuario.
- **Cobrir com Cypress visual**, validando cliente logado e sino aberto sem tentar controlar o prompt nativo do navegador.

### Impacto
A prova externa de Web Push agora tem caminho completo pelo storefront: login do cliente, sino de notificacoes, ativacao do navegador, registro da subscription e, depois, `prove:web-push-delivery`.

### Validação
- Frontend `npm run build`: OK.
- Docker staging `storefront_staging` rebuildado/recriado: OK.
- Cypress staging visual responsivo `mobile-visual-smoke.cy.ts`: 18/18.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.
- API staging `/health`: OK.
- `npm run validate:staging-recipes` contra staging: OK.

### Mudança
Gate executavel do acervo editorial de receitas criado.

### Motivo
Depois de enriquecer o staging com capas e receitas relacionadas, faltava uma prova rapida e repetivel de que o contrato editorial continuava inteiro. Sem um gate, uma alteracao no seed, no banco ou nos assets poderia quebrar a vitrine sem aparecer ate a navegacao manual.

### Decisões Arquiteturais
- **Criar `validate:staging-recipes` no backend**, usando Prisma e os slugs esperados do seed.
- **Validar arquivos locais de capa**, conferindo se cada `imageUrl` aponta para asset existente em `frontend/public`.
- **Validar qualidade minima por receita**, incluindo categoria, `publishedAt`, ingredientes, passos, produtos ativos e 2 relacionadas.
- **Endurecer Cypress real**, exigindo imagem visivel na listagem e relacionadas no detalhe quando a API retorna esses dados.

### Impacto
O acervo editorial de staging agora tem seed, prova de contrato e cobertura navegavel real. A proxima etapa editorial pode focar em copy/imagens definitivas de producao sem risco de perder a base operacional.

### Validação
- `node --check scripts/validate-staging-recipes.js`: OK.
- `node --check scripts/seed-staging-recipes.js`: OK.
- `npm run validate:staging-recipes` contra staging: OK.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.

### Mudança
Acervo editorial de receitas enriquecido com capas locais e receitas relacionadas.

### Motivo
O seed editorial ja validava dados reais, mas a vitrine ainda precisava parecer navegavel: cards com imagem, detalhe com `og:image` real e caminhos de descoberta entre receitas.

### Decisões Arquiteturais
- **Reutilizar banners locais do storefront** como capas iniciais, evitando dependencia de imagens externas.
- **Persistir `imageUrl` no seed**, usando o campo ja existente no schema/API/UI.
- **Criar relações entre receitas em segunda passagem**, depois que todos os slugs estaveis ja existem no banco.
- **Atualizar o Cypress real**, aceitando `og:image` real quando `imageUrl` existir e fallback apenas quando a receita nao tiver imagem.

### Impacto
A pagina `/receitas` e os detalhes deixam de depender do fallback visual e passam a mostrar imagens e recomendacoes internas no staging. A etapa final editorial fica focada em copy e imagens definitivas de producao.

### Validação
- `node --check scripts/seed-staging-recipes.js`: OK.
- `npm run seed:staging-recipes` contra staging: OK.
- API staging `/recipes/:slug`: 5 receitas com `imageUrl`, 2 relacionadas, ingredientes e produtos.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.

### Mudança
Prova assistida de Web Push adicionada ao pacote operacional.

### Motivo
O Web Push ja tinha implementacao backend/frontend, manifesto PWA e preflight externo, mas a homologacao final dependia de um comando objetivo para disparar contra uma subscription real registrada no banco. Sem isso, o teste externo ficaria manual demais e facil de confundir com falha de ambiente.

### Decisões Arquiteturais
- **Criar script raiz `prove:web-push-delivery`**, usando `web-push` e Prisma a partir dos pacotes do backend.
- **Filtrar subscription por cliente/email/endpoint**, permitindo prova controlada sem broadcast acidental.
- **Falhar cedo quando faltar VAPID, `DATABASE_URL` ou subscription**, separando erro de preparo de ausencia de ambiente externo.
- **Manter a homologacao final pendente**, porque ainda nao ha subscription real em origem HTTPS neste staging local.

### Impacto
Quando o storefront estiver em HTTPS com VAPID real, basta instalar/abrir o PWA, aceitar notificacoes, registrar a subscription e rodar `cd sistema && npm run prove:web-push-delivery` para provar envio real.

### Validação
- `node --check scripts/prove-web-push-delivery.js`: OK.
- `node --check scripts/validate-web-push-readiness.js`: OK.
- `npm run validate:web-push-readiness -- --external` com VAPID temporario: OK.
- `npm run prove:web-push-delivery` contra staging: falha esperada por nenhuma push subscription real registrada.

### Mudança
Acervo editorial de receitas populado no staging com seed idempotente.

### Motivo
Depois que `/receitas` e o detalhe real foram validados, o staging ainda tinha cara de prova tecnica: uma receita isolada. Para avaliar navegação, categorias e compra por receita com mais realismo, era preciso um acervo editorial minimo, vinculado a produtos reais do catalogo.

### Decisões Arquiteturais
- **Criar seed idempotente no backend**, usando Prisma e slugs estaveis para categorias/receitas.
- **Vincular receitas a produtos reais ativos**, falhando explicitamente se algum produto obrigatorio nao existir no staging.
- **Recriar ingredientes/passos/produtos vinculados a cada execucao**, evitando duplicacao e preservando previsibilidade.
- **Ajustar o Cypress real para carrinho dinamico**, porque receitas com varios produtos devem mostrar o total real de itens adicionados.

### Impacto
O staging agora tem 5 receitas publicadas em 4 categorias, com ingredientes, modo de preparo e produtos compraveis. A proxima frente editorial deixa de ser cadastrar conteudo inicial e passa a ser revisar copy/imagens para producao.

### Validação
- Seed staging executado duas vezes com sucesso.
- API staging `/recipes?active=true&limit=100`: 5 receitas e 4 categorias.
- API staging `/recipes/:slug`: OK para as 5 receitas.
- Backend `npm run build`: OK.
- Docker staging `api_staging` rebuildado/recriado: OK.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.

### Mudança
UI kit do storefront expandido para Home.

### Motivo
Depois de receitas, Mercado, detalhe de produto, carrinho, checkout e Adega, a Home era a última superfície central do storefront ainda com botões/CTAs próprios fora dos primitives. Como ela concentra header, busca, hero, banners e entrada para o funil, fechar essa fatia consolida a experiência visual do cliente final.

### Decisões Arquiteturais
- **Migrar botões reais para `Button`**, preservando o clique de endereço no header mobile/desktop e os dots do hero.
- **Migrar CTAs para `buttonVariants`**, mantendo `Link` do React Router como elemento de navegação.
- **Migrar badges e superfícies para `Badge` e `surfaceClasses`**, sem trocar a composição comercial da Home.
- **Validar em staging**, porque a Home é a porta de entrada do funil e dos smokes responsivos.

### Impacto
O UI kit do storefront agora cobre receitas, Mercado, detalhe de produto, carrinho, checkout, Adega e Home. A próxima frente funcional volta para homologação externa de Web Push com VAPID real ou para conteúdo editorial real de receitas/categorias.

### Validação
- Frontend `npm run build`: OK.
- Varredura em `Home.tsx`: sem `<button`/`<input` nativos e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging `storefront_staging` rebuildado/recriado: OK.
- Cypress visual responsivo `mobile-visual-smoke.cy.ts`: 16/16.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.
- Cypress visual rotas secundarias `secondary-routes-visual.cy.ts`: 16/16.
- Browser interno na Home staging: H1 presente, links renderizados, sem overflow horizontal e sem erros de console.

### Mudança
UI kit do storefront expandido para Checkout e Adega, com ajuste de robustez em janelas de entrega.

### Motivo
Depois de Mercado/Produto/Carrinho, o próximo ponto crítico era o fim do funil: Checkout. A Adega entrou na mesma fatia porque já estava coberta pelas rotas secundárias e ainda usava botões/badges fora do kit. Durante a validação, o smoke real expôs um risco operacional: slots de entrega prestes a expirar podiam derrubar o quote com `canConfirm: false`.

### Decisões Arquiteturais
- **Adicionar `Radio` ao UI kit**, porque forma de pagamento e troco são controles recorrentes do checkout.
- **Migrar `Checkout` sem alterar nomes/tipos dos campos**, preservando seletores usados pelo Cypress e contratos de formulário.
- **Migrar `WinePage` com primitives leves**, mantendo a linguagem premium da Adega.
- **Ignorar slots prestes a expirar no checkout** e endurecer o seed temporal do smoke real para validar com janela de entrega utilizável.

### Impacto
O UI kit do storefront agora cobre receitas, Mercado, detalhe de produto, carrinho, checkout e Adega. A próxima expansão visual fica concentrada na Home.

### Validação
- Frontend `npm run build`: OK.
- Varredura em `Checkout.tsx` e `WinePage.tsx`: sem `<button`/`<input` nativos e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging `storefront_staging` rebuildado/recriado: OK.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.
- Cypress visual responsivo `mobile-visual-smoke.cy.ts`: 16/16.
- Cypress visual rotas secundarias `secondary-routes-visual.cy.ts`: 16/16.

### Mudança
UI kit do storefront expandido para Mercado, detalhe de produto e carrinho.

### Motivo
Depois da primeira fatia em receitas, o próximo ponto de maior impacto era a superfície comercial principal: card de produto, detalhe e carrinho. Esses componentes aparecem em Mercado, Home, recomendações, carrinho e checkout real, então padronizá-los reduz duplicação visual e melhora a consistência dos fluxos de compra.

### Decisões Arquiteturais
- **Adicionar `Input` e `Checkbox` ao UI kit**, porque cupom e substituição são controles reais do carrinho.
- **Migrar `StoreProductCard` primeiro**, pois ele é compartilhado por Mercado, vitrines e recomendações.
- **Migrar `Cart` e `ProductDetail` na mesma fatia**, preservando labels, textos e `aria-labels` usados pelos smokes.
- **Validar em staging**, não só localmente, porque a mudança afeta o funil produto -> carrinho -> checkout.

### Impacto
Mercado, detalhe de produto e carrinho passam a usar os primitives do UI kit do storefront. A próxima expansão visual fica concentrada em Checkout, Home e Adega.

### Validação
- Frontend `npm run build`: OK.
- Varredura em `StoreProductCard.tsx`, `Cart.tsx` e `ProductDetail.tsx`: sem `<button` nativo e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging `storefront_staging` rebuildado/recriado: OK.
- Cypress staging visual responsivo `mobile-visual-smoke.cy.ts`: 16/16.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.
- Cypress staging real rotas secundarias `staging-secondary-routes-real.cy.ts`: 4/4.

### Mudança
Primeira fatia de UI kit aplicada no storefront, começando por receitas.

### Motivo
Depois que o staging passou a ter receita real e cobertura de lista/detalhe sem mocks, receitas virou a superfície ideal para iniciar a padronização visual do storefront: escopo pequeno, fluxo comercial real, SEO/carrinho já cobertos e baixo risco de quebrar o funil principal.

### Decisões Arquiteturais
- **Criar primitives leves**, sem instalar dependência nova: `Button`, `Badge`, `surfaceClasses` e `cn`.
- **Reusar `clsx` e `tailwind-merge`**, que já estavam no frontend.
- **Aplicar primeiro em receitas**, migrando filtros, cards, badges, skeletons, painel lateral e ações de carrinho.
- **Preservar comportamento e textos existentes**, para manter compatibilidade com Cypress e com o staging real.

### Impacto
O storefront passa a ter uma base de UI kit própria para superfícies comerciais, coerente com o visual Antenor e sem acoplar o cliente final a um visual de dashboard. A próxima expansão natural é Mercado, detalhe de produto e carrinho.

### Validação
- Frontend `npm run build`: OK.
- Varredura em `RecipeList.tsx` e `RecipeDetail.tsx`: sem `<button` nativo e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging `storefront_staging` rebuildado/recriado: OK.
- Cypress staging real `staging-secondary-routes-real.cy.ts`: 4/4 contra `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.

### Mudança
Receita real publicada no staging, detalhe `/receitas/:slug` validado sem mocks e API admin de receitas/categorias corrigida.

### Motivo
O smoke real anterior provou `/receitas`, mas tambem revelou que staging nao tinha conteudo publicado. Ao tentar publicar via API admin, o `ValidationPipe` rejeitou campos validos porque os DTOs de receitas/categorias nao tinham decorators de validação. Sem corrigir isso, o staging ficaria validado apenas por inserção direta no banco, mas nao operacional pelo admin.

### Decisões Arquiteturais
- **Publicar seed minimo real em staging**, com categoria, ingredientes, passos e produto existente vinculado.
- **Corrigir os DTOs**, usando `class-validator`, `class-transformer` e `PartialType` para manter `whitelist` + `forbidNonWhitelisted` sem bloquear payloads validos.
- **Ampliar a spec real existente**, `staging-secondary-routes-real.cy.ts`, para cobrir detalhe de receita, SEO/canonical, fallback de `og:image` e carrinho.
- **Validar mutação admin com smoke temporario**, criando categoria/receita, lendo publicamente e removendo os temporarios.

### Impacto
O staging agora tem uma receita ativa real (`picadinho-de-acem-da-casa`) e o storefront prova lista/detalhe com API real. A API admin de receitas/categorias voltou a ser operacional para criação e edição, removendo um bloqueio importante antes de avançar em UI/operacao.

### Validação
- API staging `/recipes?active=true&limit=100`: 1 receita.
- API staging `/recipes/picadinho-de-acem-da-casa`: ingredientes, passos e produto vinculado OK.
- Smoke admin real: login, criação de categoria temporária, criação de receita temporária, leitura pública e limpeza OK.
- Backend `npm run build`: OK.
- Docker staging `api_staging` rebuildado/recriado: OK.
- Cypress staging real `staging-secondary-routes-real.cy.ts`: 4/4 contra `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.

### Mudança
Smoke real de rotas secundarias criado para staging.

### Motivo
As rotas secundarias ja estavam cobertas visualmente com mocks, mas ainda faltava provar o comportamento contra o contrato e os dados reais do staging. A validacao real tambem precisava diferenciar falha de UI de ausencia legitima de conteudo publicado.

### Decisões Arquiteturais
- **Criar spec separada**, `staging-secondary-routes-real.cy.ts`, para nao misturar smoke visual mockado com smoke de contrato real.
- **Consultar a API real antes da assercao**, usando `4001` como fonte de verdade.
- **Tratar empty state como comportamento valido**, quando a API real nao tiver promocao ativa ou receita publicada.
- **Manter detalhe de receita fora do smoke real por enquanto**, porque staging retorna 0 receitas ativas.

### Impacto
O storefront passa a ter cobertura real de `/promocoes`, `/adega` e `/receitas` contra staging. A proxima pendencia de receitas ficou objetiva: publicar ou seedar ao menos uma receita ativa para validar o detalhe sem mock.

### Validação
- API staging `/products?limit=100`: 29 produtos.
- API staging `/products?limit=100&category=Adega`: 5 produtos.
- API staging `/recipes?active=true&limit=100`: 0 receitas.
- Cypress staging real `staging-secondary-routes-real.cy.ts`: 3/3 contra `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.

### Mudança
Web Push recebeu preparo operacional de PWA e preflight externo.

### Motivo
O envio real via `web-push` ja existia, mas a homologacao externa ainda dependia de requisitos ambientais dificeis de enxergar rapidamente: chave VAPID coerente entre backend e build do storefront, origem HTTPS, service worker publicado, manifesto PWA e cache correto. Sem um gate, o risco era tentar homologar em dispositivo com ambiente mal configurado.

### Decisões Arquiteturais
- **Adicionar manifesto PWA**, `manifest.webmanifest`, linkado no `index.html`.
- **Criar preflight executavel**, `npm run validate:web-push-readiness`, com modo `--external`.
- **Validar VAPID e origem segura antes da homologacao**, incluindo paridade de `VAPID_PUBLIC_KEY` e `VITE_VAPID_PUBLIC_KEY`.
- **Evitar cache agressivo em PWA core**, servindo `service-worker.js` e `manifest.webmanifest` com no-store no Nginx local/staging.
- **Servir manifesto com MIME correto**, `application/manifest+json`.

### Impacto
A frente M33 Web Push deixa de depender de checklist manual fragil para saber se o ambiente esta pronto. A pendencia remanescente fica reduzida a prova final: chaves VAPID reais, dominio HTTPS nao-local, PWA instalado e entrega recebida com o app fechado.

### Validação
- `npm run validate:web-push-readiness -- --external`: OK com chaves VAPID temporarias geradas via `web-push`.
- Backend focused tests `push-notification.service.spec.ts` e `notifications.service.spec.ts`: 5/5 OK.
- Frontend `npm run build`: OK.
- Docker local/staging de storefront rebuildado e recriado.
- `/manifest.webmanifest` e `/service-worker.js`: HTTP 200 em `3000` e `4000`, cache no-store e manifesto em `application/manifest+json`.

### Mudança
Smoke visual do storefront ampliado para rotas secundarias e SEO endurecido para imagem nula.

### Motivo
As telas principais ja estavam cobertas em mobile/tablet/desktop, mas ainda faltava proteger as rotas editoriais e comerciais fora do funil principal. A rota de detalhe de receita tambem revelou um caso real: `imageUrl: null` podia quebrar o componente `SEO` ao montar Open Graph/Twitter image.

### Decisões Arquiteturais
- **Criar spec dedicada**, `secondary-routes-visual.cy.ts`, para manter a matriz de rotas secundarias separada do smoke primario.
- **Reusar a matriz responsiva**, cobrindo 375x667, 414x896, 768x1024 e 1280x900.
- **Mockar receitas com `imageUrl: null`**, garantindo que o fallback seja validado de forma reproduzivel.
- **Resolver no `SEO`**, aceitando `image: null` e caindo para `/og-image.png`.

### Impacto
O storefront passa a ter protecao visual para `/promocoes`, `/adega`, `/receitas` e detalhe de receita, alem de evitar regressao em conteudo editorial sem imagem.

### Validação
- Frontend `npm run build`: OK.
- Docker local/staging de storefront rebuildado e recriado.
- Cypress local `secondary-routes-visual.cy.ts`: 16/16 contra `http://127.0.0.1:3000`.
- Cypress staging `secondary-routes-visual.cy.ts`: 16/16 contra `http://127.0.0.1:4000`.
- Cypress staging `mobile-visual-smoke.cy.ts`: 16/16 contra `http://127.0.0.1:4000`.
- Cypress staging real `staging-smoke.cy.ts`: 1/1 contra `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.

### Mudança
Smoke visual do storefront ampliado de mobile para matriz responsiva mobile/tablet/desktop.

### Motivo
A primeira versao da spec protegia bem os CTAs mobile, mas ainda faltava cobrir os breakpoints `md` e desktop, onde header, bottom nav, CTA de carrinho e layout de carrinho/checkout mudam de comportamento.

### Decisões Arquiteturais
- **Manter a mesma spec**, `mobile-visual-smoke.cy.ts`, para preservar os mocks e tratar a cobertura como uma matriz responsiva unica.
- **Adicionar viewports 768x1024 e 1280x900**, alem dos dois mobile existentes.
- **Validar diferencas de breakpoint**, como ausencia de bottom nav mobile em `md+`, ausencia de CTA mobile no Mercado e comportamento distinto do CTA de carrinho em tablet vs desktop.

### Impacto
A cobertura visual do storefront passa a proteger as telas comerciais principais em mobile, tablet e desktop, reduzindo risco de regressao responsiva antes de homologacao.

### Validação
- Cypress local `mobile-visual-smoke.cy.ts`: 16/16 contra `http://127.0.0.1:3000`.
- Cypress staging visual/responsivo `mobile-visual-smoke.cy.ts`: 16/16 contra `http://127.0.0.1:4000`.
- Frontend `npm run build`: OK.

### Mudança
Smoke visual/mobile do storefront criado para Home, Mercado, Produto, Carrinho e Checkout.

### Motivo
Depois do smoke real de staging fechar o caminho produto/carrinho/checkout, ainda faltava uma cobertura especifica de ergonomia mobile: overflow horizontal, CTAs fixos, bottom nav e barras de acao dentro da viewport.

### Decisões Arquiteturais
- **Criar spec dedicada**, `mobile-visual-smoke.cy.ts`, separada dos fluxos funcionais existentes.
- **Usar mocks controlados**, para validar layout e comportamento mobile sem depender da API real.
- **Cobrir dois tamanhos de tela**, 375x667 e 414x896.
- **Testar invariantes visuais simples**, como ausencia de overflow horizontal e CTAs fixos visiveis dentro da viewport.

### Impacto
O storefront ganhou uma proteção objetiva contra regressao mobile nas telas comerciais principais. A revalidacao staging real tambem foi rerodada depois que o Docker Desktop voltou durante a rodada.

### Validação
- Cypress local `mobile-visual-smoke.cy.ts`: 8/8 contra `http://127.0.0.1:3000`.
- Cypress staging visual/mobile `mobile-visual-smoke.cy.ts`: 8/8 contra `http://127.0.0.1:4000`.
- Cypress staging real `staging-smoke.cy.ts`: 1/1 contra `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.
- Docker Desktop ficou indisponivel no inicio da rodada e voltou antes do fechamento.

## 2026-06-02

### Mudança
M33 Web Push saiu da base tecnica e passou a enviar notificacoes reais via `web-push` quando o ambiente tiver VAPID configurado.

### Motivo
A auditoria ainda apontava Web Push como pendencia funcional. O backend ja aceitava subscriptions e o service worker ja tinha handler, mas faltava ligar o envio real, normalizar o formato `PushSubscriptionJSON` do navegador e expor as variaveis corretas para local/staging.

### Decisões Arquiteturais
- **Usar `web-push` diretamente no backend**, configurado por `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`.
- **Manter a notificacao in-app como registro principal**, disparando push como efeito adicional em notificacoes com `customerId`.
- **Aceitar o formato real do navegador**, lendo `keys.auth` e `keys.p256dh` no endpoint de subscription.
- **Remover subscriptions expiradas automaticamente**, limpando endpoint com 404/410 do provider.
- **Nao forcar registro sem VAPID**, preservando notificacoes in-app quando a chave publica nao existir no frontend.

### Impacto
O projeto agora tem Web Push implementado no caminho backend/frontend/service worker. A pendencia remanescente mudou de "implementar envio" para "validar entrega externa" com chaves VAPID reais, origem segura e PWA instalado.

### Validação
- Backend focused tests `push-notification.service.spec.ts` e `notifications.service.spec.ts`: 5/5.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.
- Compose local/staging `config --quiet`: OK.
- Docker local/staging rebuildado e recriado para API/storefront; endpoints `3001/3000/4001/4000` responderam 200.

### Mudança
Smoke real do storefront/staging ampliado para produto, carrinho e checkout.

### Motivo
Depois de validar `/mercado`, ainda faltava provar que o caminho comercial inteiro funcionava em staging com API real. O primeiro smoke encontrou um bloqueio real: o frontend sempre enviava `slotId=ASAP`, mas o backend exige um `FulfillmentSlot` valido para liberar `canConfirm`.

### Decisões Arquiteturais
- **Consumir janelas publicas no checkout**, usando `/delivery/slots?type=DELIVERY` no storefront.
- **Enviar slot real no quote/confirm**, com `slotId`, `windowStart` e `windowEnd` vindos da API quando houver janela ativa disponivel.
- **Preservar fallback `ASAP` como contingencia**, mas sem depender dele quando a API oferece slot real.
- **Criar smoke real isolado**, `staging-smoke.cy.ts`, chamado explicitamente contra `localhost:4000/4001`.
- **Preparar dados QA idempotentes no staging local**, garantindo zona CEP e janela `DELIVERY` antes do fluxo.

### Impacto
O checkout em staging deixou de ficar preso na etapa de entrega por janela invalida e agora tem cobertura real de produto, mercado, carrinho, sessao de checkout, quote e confirmacao de pedido convidado com PIX.

### Validação
- Frontend `npm run build`: OK.
- `docker compose -f docker-compose.staging.yml build storefront_staging`: OK.
- `docker compose -f docker-compose.staging.yml up -d --force-recreate storefront_staging`: OK.
- Cypress staging real `staging-smoke.cy.ts`: 1/1.
- Cypress checkout mockado `checkout.cy.ts`: 5/5.

### Mudança
Reconciliacao das proximas etapas apos validacao real de M33/M39.

### Motivo
Depois da suite admin real passar, a wiki ainda indicava M39 como pendente e M33.3 como bloqueado por Docker indisponivel. O codigo e os testes ja cobriam M39, e a stack local voltou a permitir validar os endpoints de Inteligencia.

### Decisões Arquiteturais
- **Tratar M39 como concluido**, mantendo a proxima frente fora da duplicacao de catalogo.
- **Fechar M33 Inteligencia em runtime local**, usando os endpoints reais de relatório executivo, CSV, funil/insights e regras de alerta.
- **Manter Web Push real como pendencia ambiental**, pois depende de chaves VAPID/provider e validacao no ambiente final.
- **Priorizar smoke ampliado do storefront/staging**, cobrindo produto, carrinho e checkout como proxima frente funcional.

### Impacto
A fila de trabalho deixa de apontar tarefas ja entregues e passa a orientar o proximo ciclo para configuracao real de Web Push ou smoke visual/mobile mais amplo do storefront.

### Validação
- `GET /analytics/report-executive?week=2026-05-25&format=json`: 200, receita 665.15, 35 pedidos e 5 categorias.
- `GET /analytics/report-executive/download?week=2026-05-25`: 200, 847 bytes.
- `GET /analytics/funnel-compare?days=7`: respondeu em runtime local.
- `GET /analytics/insights-compare?days=7`: respondeu em runtime local.
- `GET /analytics/alert-rules`: 1 regra retornada.

### Mudança
Validação real da stack local/staging concluída após retorno do Docker.

### Motivo
A etapa anterior fechou a suite mockada do admin, mas ainda faltava provar a stack real: Docker, migrations, seed QA, Cypress crítico com API real, suite admin completa e os pontos de staging que tinham sido reportados antes, especialmente produtos no storefront e login admin.

### Decisões Arquiteturais
- **Manter `critical-flows.cy.ts` fora do fallback mockado**, garantindo que ele continue exercitando API real.
- **Validar staging por contrato e renderização**, checando `/products`, login em `/auth/login` e produto real aparecendo no `/mercado`.
- **Preservar senha oficial em minúsculo**, documentando que `admin2026` e case-sensitive e que `Admin2026` nao autentica.

### Impacto
O bloqueio Docker/API foi removido, o admin está validado de ponta a ponta em stack real, e o staging local deixa de estar em estado incerto para os dois pontos operacionais principais: produtos e login.

### Validação
- `docker compose build api admin`: OK.
- `docker compose up -d --force-recreate api admin`: OK.
- Prisma local `migrate deploy`: OK, sem pendências.
- Prisma staging `migrate status`: OK.
- Seed QA local `npm run seed:qa`: OK.
- Cypress `critical-flows.cy.ts`: 3/3.
- Cypress admin completo: 25 specs, 88/88.
- Staging API `/products?limit=5`: OK, 29 produtos totais.
- Staging admin login `admin@antenor.com.br` / `admin2026`: OK.
- Staging storefront `/mercado`: produto real renderizado.

### Mudança
Auditoria final do UI kit e suite Cypress mockada do admin estabilizadas.

### Motivo
Depois da remoção dos pop-ups nativos, ainda faltava provar a migracao em lote: varrer controles nativos, varrer pop-ups e rodar todos os specs mockados juntos. No lote completo, alguns specs tardios ficavam presos porque requests nao mockadas para `localhost:3001` permaneciam penduradas quando Docker/API estavam desligados.

### Decisões Arquiteturais
- **Criar fallback Cypress global apenas para specs mockados**, mantendo `critical-flows.cy.ts` fora do fallback para continuar validando API real.
- **Criar `QueryClient` por montagem do `App`**, evitando cache entre specs no mesmo navegador Cypress.
- **Adicionar cache-busting em `/health/detail`**, impedindo reaproveitamento de resposta do navegador.
- **Endurecer specs tardios**, limpando storage antes da autenticação e usando seletores por `aria-label`.

### Impacto
O admin mockado agora tem uma prova de regressao mais forte para a fase de UI kit: 24 specs rodam juntos sem depender da API real, e o codigo de produção fica sem controles nativos diretos fora do ui-kit e sem pop-ups nativos.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress admin mock completo sem `critical-flows.cy.ts`: 24 specs, 85/85.
- Varredura global: sem `button/input/select/textarea` nativos diretos fora de `components/ui/*`.
- Varredura global: sem `alert()`, `prompt()` ou `confirm()` em `sistema/admin/src`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
Pop-ups nativos residuais removidos de Picking.

### Motivo
Depois da limpeza de Pedidos, a varredura global ainda apontava quatro `prompt()` em `PickingSection`: atribuir separador, finalizar separacao, registrar conferencia e finalizar embalagem.

### Decisões Arquiteturais
- **Usar um dialog reutilizavel por acao de tarefa**, com `role="dialog"`, `Input` e `Button` do UI kit.
- **Preservar contratos da API**, mantendo payloads `{ pickerId }`, `{ notes }` e `{ justification }` conforme endpoint.
- **Manter feedback controlado**, adicionando `role="alert"` ao erro de separacao.
- **Endurecer mocks Cypress**, aceitando rotas com ou sem prefixo `/api`.

### Impacto
O codigo real do admin fica sem `alert()`, `prompt()` ou `confirm()` nativos; a operacao de separacao segue o padrao de UI controlada do restante do admin.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `picking.cy.ts`: 3/3.
- Varredura global do admin: nenhum `alert()`, `prompt()`, `confirm()`, `window.alert`, `window.prompt` ou `window.confirm` em `sistema/admin/src`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
Alertas residuais removidos de Pedidos.

### Motivo
Depois da limpeza do Catalogo, `Dashboard.tsx` ainda tinha dois `alert()` nos handlers de pedido e `OrdersSection` ainda usava `prompt()` para motivo de cancelamento.

### Decisões Arquiteturais
- **Centralizar feedback no Dashboard**, com estado `orderFeedback` para erros de status e pagamento.
- **Renderizar feedback no contexto correto**, exibindo `role="alert"` na lista ou dentro do modal de detalhes quando ele esta aberto.
- **Substituir `prompt()` por UI controlada**, usando campo de motivo dentro do modal antes de confirmar cancelamento.
- **Nao relancar erro para o React**, mantendo selects controlados pelo estado local e evitando rejeicao global.

### Impacto
Pedidos deixa de interromper o operador com pop-ups nativos e passa a seguir o padrao visual/acessivel do UI kit.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `orders.cy.ts`: 5/5.
- Varredura global do admin: sem `alert()` no codigo real; pop-ups nativos restantes concentrados em quatro `prompt()` de `PickingSection.tsx`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
Alertas residuais removidos do fluxo de produtos no Catalogo.

### Motivo
Depois das fatias de UI kit e inputs especiais, o fluxo de produtos ainda usava `alert()` em erros de salvar/remover/lote/edicao inline e em mensagens de sincronizacao Solidcom/taxonomia.

### Decisões Arquiteturais
- **Centralizar feedback no Dashboard**, com estado `productFeedback` para mensagens de sucesso e erro.
- **Renderizar feedback no Catalogo**, usando banner acessivel com `role="alert"` e acao de dispensar.
- **Manter contexto de erro em acoes confirmadas**, exibindo a falha dentro do dialogo quando a exclusao/lote falha.
- **Evitar rejeicao global no React**, capturando a falha no modal depois que o handler pai registra o feedback.
- **Cobrir ausencia de `window.alert` no Cypress**, validando preco inline invalido e falha de exclusao.

### Impacto
O fluxo de produtos do Catalogo passa a se comportar como uma superficie de UI kit: sem pop-up nativo, com erro visivel, acessivel e contextual.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `catalog.cy.ts`: 8/8.
- Varredura da fatia: sem `alert()`, `window.alert`, `window.confirm` ou `confirm()` em `ProductsSection.tsx` e `catalog.cy.ts`; em `Dashboard.tsx` restam apenas dois alertas de pedidos.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
Alertas residuais removidos de `CategoriesManager`.

### Motivo
Depois da migracao dos inputs especiais, a tela ainda usava `alert()` em dois caminhos de erro: falha ao excluir categoria e falha ao reordenar a arvore.

### Decisões Arquiteturais
- **Manter o fluxo atual**, preservando rollback da ordem em falha de drag-and-drop e mantendo o modal de exclusao aberto quando a API falha.
- **Substituir interrupcao do navegador por UI controlada**, usando estado `actionError`, `role="alert"` e acao de dispensar.
- **Melhorar semantica do modal**, adicionando `role="dialog"`, `aria-modal` e titulo referenciado.
- **Cobrir a falha de exclusao no Cypress**, garantindo que `window.alert` nao seja chamado.

### Impacto
`CategoriesManager` fica sem `alert()` residual e a experiencia de erro passa a ser consistente com o UI kit.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `categories.cy.ts`: 6/6.
- Varredura da fatia: sem `alert()`, `window.alert`, `window.confirm` ou `confirm()` em `CategoriesManager.tsx` e `categories.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado no input especial de `CategoriesManager`.

### Motivo
A varredura global ainda apontava um input nativo escondido para upload de banner de categoria.

### Decisões Arquiteturais
- **Preservar o fluxo de upload existente**, mantendo `accept`, `handleBannerUpload`, `uploadsAPI.upload`, PATCH de `bannerUrl` e estado `uploading`.
- **Padronizar o controle real**, usando `Input type="file"` do UI kit dentro do label visual existente.
- **Reforcar acessibilidade**, adicionando `aria-label` com o nome da categoria.
- **Endurecer a spec de Categorias**, usando intercepts que funcionam com URLs com ou sem `/api`.

### Impacto
A varredura global do admin deixa de apontar controles nativos diretos fora dos componentes `ui/*`.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `categories.cy.ts`: 5/5.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `CategoriesManager.tsx` e `categories.cy.ts`.
- Varredura global do admin: sem controles nativos diretos fora dos componentes `ui/*`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos inputs especiais de `ProductSlideOver`.

### Motivo
O formulario lateral de produto ja usava componentes do UI kit, mas ainda mantinha dois inputs nativos escondidos para upload de Foto 1 e Foto 2.

### Decisões Arquiteturais
- **Preservar o fluxo de upload existente**, mantendo `accept`, `disabled`, reset do campo, `productsAPI.uploadImage` e os slots `1`/`2`.
- **Padronizar o controle real**, usando `Input type="file"` do UI kit dentro dos labels visuais existentes.
- **Reforcar acessibilidade**, adicionando `aria-label` especifico para foto principal e foto auxiliar.
- **Ampliar a spec de Catalogo**, validando os dois endpoints de upload com `selectFile`.

### Impacto
`ProductSlideOver.tsx` fica sem controles nativos diretos residuais; a varredura global do admin passa a apontar apenas o upload de banner em `CategoriesManager` fora dos componentes `ui/*`.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `catalog.cy.ts`: 6/6.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ProductSlideOver.tsx` e `catalog.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nas abas de `PaymentEventsSection`.

### Motivo
O painel de pagamentos ja existia, mas os controles segmentados `Transacoes` e `Webhooks` ainda usavam botoes nativos diretos.

### Decisões Arquiteturais
- **Preservar o visual segmentado**, mantendo estados ativo/inativo e badges de contagem.
- **Padronizar o controle real**, usando `Button variant="ghost"` do UI kit.
- **Expor estado acessivel**, usando `aria-pressed` para indicar a aba selecionada.
- **Criar spec proprio**, isolando pagamentos em `payment-events.cy.ts` com mocks para saude, transacoes e webhooks.

### Impacto
`PaymentEventsSection.tsx` fica sem controles nativos diretos residuais e ganha cobertura E2E dedicada para a trilha de pagamentos.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `payment-events.cy.ts`: 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `PaymentEventsSection.tsx` e `payment-events.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos inputs especiais de `StoreBannersManager`.

### Motivo
A tela de Banners da Loja ja estava migrada, mas ainda tinha inputs nativos escondidos para upload de imagem desktop e mobile.

### Decisões Arquiteturais
- **Preservar o fluxo atual de upload**, mantendo refs, `accept`, reset do campo e `handleUpload` para desktop/mobile.
- **Padronizar o controle real**, usando `Input type="file"` do UI kit sem alterar os botoes visuais que abrem o seletor de arquivo.
- **Reforcar acessibilidade**, adicionando `aria-label` nos inputs escondidos.

### Impacto
`StoreBannersManager.tsx` fica sem controles nativos diretos residuais, mantendo a spec dedicada de Banners da Loja.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `store-banners.cy.ts`: 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `StoreBannersManager.tsx` e `store-banners.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos inputs especiais de `BrandIdentity`.

### Motivo
Mesmo com a tela ja migrada, o upload escondido de logos e os color pickers ainda eram controles nativos diretos.

### Decisões Arquiteturais
- **Preservar o comportamento do upload**, mantendo `ref`, `accept`, reset do valor apos selecao e fluxo `uploadsAPI.upload`.
- **Manter os color pickers nativos do navegador**, mas renderizados via `Input type="color"` do UI kit para padronizar o componente.
- **Reforcar acessibilidade**, adicionando `aria-label` nos controles especiais.

### Impacto
`BrandIdentity.tsx` fica sem controles nativos diretos residuais, mantendo preview, campos hex e a spec dedicada de identidade visual.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `brand-identity.cy.ts`: 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `BrandIdentity.tsx` e `brand-identity.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos inputs especiais de `PromoBannersManager`.

### Motivo
Depois de `LayoutManager`, os banners promocionais ainda mantinham inputs nativos escondidos para upload de imagens em cards e no modal.

### Decisões Arquiteturais
- **Preservar o fluxo de upload existente**, mantendo validacao de tipo/tamanho, `uploadsAPI.upload`, atualizacao no CMS e feedback por notice.
- **Padronizar o controle real**, usando `Input type="file"` do UI kit sem alterar a superficie visual acionada pelas labels.
- **Reforcar acessibilidade**, adicionando `aria-label` nos inputs escondidos de upload.

### Impacto
`PromoBannersManager` fica sem controles nativos diretos residuais e segue coberto pela spec de Layout.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `layout.cy.ts`: 8/8.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `PromoBannersManager.tsx` e `layout.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos inputs especiais de `LayoutManager.tsx`.

### Motivo
Apos `FormElements`, `LayoutManager` ainda tinha inputs nativos escondidos para upload de banners de categoria e slides.

### Decisões Arquiteturais
- **Manter o controle real de arquivo**, porque upload exige `type="file"`, mas expor via `Input` do UI kit para padronizar a superficie do componente.
- **Preservar handlers e acessibilidade**, mantendo `accept="image/*"`, `aria-label` e `handleFileUpload` para categoria e hero.
- **Endurecer a spec de Layout**, aceitando endpoints com ou sem `/api` e aguardando dados CMS antes da assercao visual.

### Impacto
`LayoutManager.tsx` fica sem controles nativos diretos residuais, com cobertura Cypress da tela de Layout preservada e mais estavel.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `layout.cy.ts`: 8/8.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `LayoutManager.tsx` e `layout.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos wrappers `FormElements.tsx`.

### Motivo
Depois da tela de login, os wrappers acessiveis legados ainda mantinham `input`, `select` e `button` nativos, mesmo expondo uma API reutilizavel para formularios.

### Decisões Arquiteturais
- **Preservar a API publica**, mantendo `AccessibleInput`, `AccessibleSelect` e `AccessibleButton` com as mesmas props de alto nivel.
- **Delegar para o UI kit**, usando `Input`, `Label`, `Select`, `Button` e `Loader2` sem exigir mudanca em consumidores futuros.
- **Melhorar estabilidade de IDs**, substituindo IDs aleatorios por `React.useId()` para manter associacao label/campo consistente no ciclo de vida do componente.

### Impacto
Os wrappers compartilhados deixam de gerar controles nativos diretamente e passam a alinhar qualquer uso futuro ao padrao visual/acessivel do admin.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `FormElements.tsx`.
- Uso ativo: nenhum consumidor encontrado em `src/` ou `cypress/`, entao a fatia foi validada por tipo/build/lint/varredura.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado na tela `Login.tsx`.

### Motivo
A tela de login ainda mantinha `label`, `input` e `button` nativos, mesmo depois da migracao do shell e do fallback global.

### Decisões Arquiteturais
- **Preservar o contrato de autenticacao**, mantendo `useAuth().login`, redirecionamento para `/` e tratamento de erro via `getApiErrorMessage`.
- **Melhorar associacao acessivel**, usando `Label htmlFor` com `Input id` nos campos de email e senha.
- **Estabilizar o smoke local**, mockando `POST /auth/login` no teste de sucesso para validar payload sem depender da API local desligada.

### Impacto
O acesso inicial do admin fica alinhado ao UI kit e o smoke de login passa a ser reprodutivel mesmo quando Docker/API estao fora.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `smoke.cy.ts`: 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Login.tsx` e `smoke.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado no fallback `ErrorBoundary`.

### Motivo
Depois da migracao do shell principal, o fallback de erro ainda mantinha um botao nativo para recarregar a pagina.

### Decisões Arquiteturais
- **Preservar a recuperacao atual**, mantendo `window.location.reload()` como acao do fallback.
- **Migrar sem alterar layout**, substituindo apenas o controle por `Button` e preservando a identidade visual existente.
- **Validar por build e varredura**, por ser uma fatia isolada sem harness Cypress proprio.

### Impacto
O estado de erro global do admin fica alinhado ao UI kit sem alterar comportamento de recuperacao.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ErrorBoundary.tsx`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado no shell principal `Dashboard.tsx`.

### Motivo
Depois de `ProductsSection`, o shell do admin ainda mantinha botoes nativos para navegacao lateral, ferramentas, logout e menu mobile.

### Decisões Arquiteturais
- **Preservar o comportamento de navegacao**, mantendo `activeSection`, `aria-current`, `aria-label` e fechamento automatico da sidebar mobile.
- **Migrar sem redesenhar o shell**, usando `Button` com `variant="ghost"`/`destructive` e mantendo as classes visuais existentes.
- **Ampliar `dashboard.cy.ts`**, cobrindo navegacao por shell, abertura/fechamento da sidebar mobile e logout com limpeza de `localStorage`.

### Impacto
O chassi principal do admin passa a usar o UI kit nos controles de navegacao e sessao, sem alterar as secoes internas nem o roteamento local do painel.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `dashboard.cy.ts`: 7/7.
- Varredura da fatia: sem `button` nativo nem `confirm/prompt` em `Dashboard.tsx` e `dashboard.cy.ts`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nas acoes e confirmacoes de `ProductsSection`.

### Motivo
Mesmo com o catalogo ja iniciado no UI kit, `ProductsSection` ainda mantinha botoes nativos em metricas/chips/cards/barra em lote e `window.confirm()` para inativar/excluir produtos.

### Decisões Arquiteturais
- **Mover a decisao destrutiva para a UI**, criando dialog controlado em `ProductsSection` para inativar produto, ativar/inativar em lote e excluir em lote.
- **Remover confirmacoes do container**, deixando `Dashboard.tsx` responsavel apenas por chamar API, recarregar dados e tratar erro.
- **Migrar botoes residuais**, usando `Button` para metricas Solidcom, chips de filtro, cards e barra flutuante de lote.
- **Endurecer a spec de catalogo**, mockando leituras/acoes e validando cancelamento/confirmacao via dialog.

### Impacto
O fluxo de produtos deixa de depender de `window.confirm()`, ganha confirmacao visual consistente com o admin e passa a ter cobertura E2E para acoes individuais e em massa sem depender da API local.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `catalog.cy.ts`: 5/5.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ProductsSection.tsx` e `catalog.cy.ts`; sem `window.confirm()` no fluxo `Dashboard.tsx` + `ProductsSection.tsx`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos chips de filtros em `OrdersSection`.

### Motivo
Depois de `CustomersSection`, os chips de filtros ativos em Pedidos ainda tinham botoes nativos para limpar status, data, pagamento e troco.

### Decisões Arquiteturais
- **Preservar o estado dos filtros**, mantendo os callbacks existentes de status, data, pagamento e troco.
- **Migrar os controles pequenos para `Button`**, usando modo icon-only, `variant="ghost"` e `aria-label` especifico para cada limpeza.
- **Ampliar a spec existente**, validando criacao dos quatro chips e limpeza individual em `orders.cy.ts`.
- **Endurecer os mocks**, aceitando URLs com ou sem `/api` e mockando `/health/detail` para manter a spec independente da API local.

### Impacto
Pedidos fica sem botoes nativos residuais na fatia de chips, com melhor acessibilidade nos controles de limpeza e cobertura E2E mais precisa para filtros ativos.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `orders.cy.ts`: 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado nos chips de filtros em `CustomersSection`.

### Motivo
Depois do `DashboardSection`, os chips de filtros ativos em Clientes ainda tinham botoes nativos para limpar email, endereco, pedidos e cadastro.

### Decisões Arquiteturais
- **Preservar o estado dos filtros**, mantendo os callbacks existentes de email, endereco, pedidos e data.
- **Migrar os controles pequenos para `Button`**, usando modo icon-only, `variant="ghost"` e `aria-label` especifico para cada limpeza.
- **Ampliar a spec existente**, validando criacao dos quatro chips e limpeza individual em `customers.cy.ts`.
- **Endurecer os mocks**, aceitando URLs com ou sem `/api` e mockando `/health/detail` para manter a spec independente da API local.

### Impacto
Clientes fica sem botoes nativos residuais na fatia de chips, com melhor acessibilidade nos controles de limpeza e cobertura E2E mais precisa para filtros ativos.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `customers.cy.ts`: 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado no select de periodo em `DashboardSection`.

### Motivo
Depois da fatia de Regras de Alerta, o bloco `Performance de Vendas` ainda tinha um `select` nativo para alterar o periodo do grafico de vendas.

### Decisões Arquiteturais
- **Preservar o estado `salesPeriod`**, mantendo o fluxo existente de `onAnalyticsChange` e recarga de `/orders/analytics/sales`.
- **Migrar apenas a casca visual**, usando `Select` do UI kit sem alterar `SalesChart` nem os contratos de analytics.
- **Endurecer o Cypress do dashboard**, cobrindo URLs com ou sem `/api`, mockando `/health/detail` e validando a chamada com `period=month`.

### Impacto
`DashboardSection` fica alinhado ao UI kit na area de analytics e a spec do dashboard passa a validar comportamento real de API ao trocar o periodo, nao apenas o valor visual do campo.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `dashboard.cy.ts`: 5/5.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
Remocao de `window.confirm()` em `AlertRulesManager`.

### Motivo
Mesmo com `AlertRulesManager` ja iniciado no UI kit, a exclusao de regra ainda dependia de confirmacao nativa do navegador, fora do padrao visual e mais dificil de validar por Cypress.

### Decisões Arquiteturais
- **Trocar confirmacao nativa por estado React**, usando `pendingDeleteRule` para controlar a regra em remocao.
- **Preservar contrato de API**, mantendo `DELETE /analytics/alert-rules/:id` e recarregamento da lista apos sucesso.
- **Usar UI kit na decisao destrutiva**, com `Button` para cancelar ou confirmar exclusao.
- **Cobrir o comportamento critico**, criando `alert-rules.cy.ts` para validar cancelamento sem DELETE e exclusao apenas apos confirmacao.

### Impacto
Regras de Alerta deixa de depender de `window.confirm()`, ganha fluxo visual consistente com o admin e reduz risco de exclusao acidental sem uma confirmacao rastreavel na propria tela.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `alert-rules.cy.ts`: 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo: bloqueado nesta sessao porque Docker Desktop nao estava ativo (`dockerDesktopLinuxEngine` indisponivel).

### Mudança
UI kit shadcn/ui aplicado no cabecalho de `Intelligence`.

### Motivo
Depois de `IntelligenceSearchInsightsPanel`, o cabecalho da pagina `Inteligencia (IA)` ainda tinha selects nativos para periodo/top termos e botao nativo `Atualizar agora`.

### Decisões Arquiteturais
- **Preservar filtros e cache de busca**, mantendo `searchWindowDays`, `searchTopLimit`, persistencia por URL e refresh manual de `/analytics/admin/search-insights`.
- **Migrar controles de cabecalho**, usando `Select` para periodo/top termos, `Badge` para indicadores e `Button` para refresh.
- **Ampliar spec existente**, mantendo a cobertura em `search-insights.cy.ts` e adicionando assercoes de query `days`/`limit`.

### Impacto
O cabecalho de Inteligencia fica alinhado ao UI kit e a tela passa a validar os parametros enviados ao trocar periodo, limite e acionar refresh manual.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `search-insights.cy.ts`: 4/4.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `IntelligenceSearchInsightsPanel`.

### Motivo
Depois de `IntelligenceAutoInsightsPanel`, o bloco `Saude da Busca` ainda tinha botoes nativos para presets, restauracao e expandir/recolher secoes, alem de marcadores visuais manuais.

### Decisões Arquiteturais
- **Preservar o contrato `/analytics/admin/search-insights`**, mantendo filtros de periodo/top, cache local e estado persistido por URL na pagina `Intelligence`.
- **Migrar acoes de painel**, usando `Button` para presets, reset, expandir/recolher tudo e toggles por secao.
- **Migrar indicadores visuais**, usando `Badge` para modo global, contagem de secoes, atualizacao e tier de Ads.
- **Criar spec proprio**, isolando Saude da Busca em `search-insights.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`IntelligenceSearchInsightsPanel` entra na trilha visual do UI kit e ganha cobertura E2E para metricas, gaps, correcoes, Ads, conversoes, presets e recolhimento/expansao de secoes.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `search-insights.cy.ts`: 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `IntelligenceAutoInsightsPanel`.

### Motivo
Depois de `Integrations`, o bloco `Insights Automaticos` dentro de Inteligencia ainda tinha botoes nativos para alternar visualizacao e atualizar os insights.

### Decisões Arquiteturais
- **Preservar os contratos de analytics**, mantendo os dados derivados de categoria/funil/origem e o endpoint `/analytics/admin/insights`.
- **Migrar controles de visualizacao e refresh**, usando `Button` para Compacto/Detalhado e Atualizar.
- **Manter acessibilidade do controle segmentado**, preservando `aria-pressed` e adicionando `aria-label` especifico ao refresh.
- **Corrigir percentual de abandono**, removendo o `%` extra no texto detalhado e no modo compacto.
- **Criar spec proprio**, isolando Insights Automaticos em `auto-insights.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`IntelligenceAutoInsightsPanel` entra na trilha visual do UI kit e ganha cobertura E2E para modo detalhado, modo compacto, ranking de produtos desejados, refresh e exibicao correta de percentual.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `auto-insights.cy.ts`: 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `Integrations`.

### Motivo
Depois de `ExecutiveReport`, a tela `Integracoes` ainda tinha botoes nativos para mostrar modulos, alternar extensoes e atualizar o status Solidcom, alem de badges manuais fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar `integrationsAPI`**, mantendo os contratos `/integrations/modules`, `PATCH /integrations/modules/:key` e `/integrations/solidcom/status`.
- **Migrar controles pontuais**, usando `Button` para acoes e `Badge` para status de modulo.
- **Corrigir aninhamento interativo**, trocando o card de modulo de `button` nativo para wrapper acessivel com `role="button"`, teclado Enter/Espaco e `aria-pressed`.
- **Criar spec proprio**, isolando Integracoes em `integrations.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`Integrations` entra na trilha visual do UI kit, preserva os toggles plugaveis e ganha cobertura E2E para resumo, selecao de conector, ativacao de modulo e refresh Solidcom.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `integrations.cy.ts`: 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt`.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `ExecutiveReport`.

### Motivo
Depois de `SystemHealthWidget`, o bloco `Relatorio Executivo Semanal` dentro de Inteligencia ainda tinha input, botoes, tabelas nativas e marcadores visuais fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar o contrato `/analytics/report-executive`**, mantendo chamada JSON por semana opcional e download CSV via `format=csv`.
- **Migrar controles e tabelas**, usando `Input`, `Label`, `Button`, `Table` e `Badge`.
- **Remover emoji do titulo externo e dos subtitulos internos**, mantendo linguagem operacional consistente no admin.
- **Criar spec proprio**, isolando o relatorio em `executive-report.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`ExecutiveReport` entra na trilha visual do UI kit e fica coberto por E2E para geracao semanal, resumo executivo, tabelas, gaps, recomendacoes e CSV.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `executive-report.cy.ts`: 2/2.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `SystemHealthWidget`.

### Motivo
Depois de `FraudAudit`, o widget `Status dos Serviços` no dashboard ainda mantinha badge manual de saude geral e botao nativo de atualizacao.

### Decisões Arquiteturais
- **Preservar `integrationsAPI.getSystemHealth`**, mantendo consulta em `/health/detail`, polling automatico a cada 60s e refresh manual.
- **Migrar controles pontuais**, usando `Badge` para o estado geral e `Button` iconico para atualizar.
- **Criar spec proprio**, isolando `Status dos Servicos` em `system-health.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`SystemHealthWidget` entra na trilha visual do UI kit e ganha cobertura E2E para degradacao, recuperacao por refresh e erro da API.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `system-health.cy.ts`: 3/3.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

## 2026-06-01

### Mudança
UI kit shadcn/ui aplicado em `FraudAudit`.

### Motivo
Depois de `NotificationsBroadcast`, a tela `Anti-fraude` ainda tinha botoes nativos para atualizar e filtrar vetores, alem de badges/tabela fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar `fraudAPI.listLogs`**, mantendo consulta em `/orders/admin/fraud-logs` com `limit` e `vector` opcional.
- **Migrar controles e tabela**, usando `Button`, `Badge` e `Table`.
- **Manter destaque de reincidencia por valor**, preservando o calculo local `countByValue` e o realce visual das linhas repetidas.
- **Criar spec proprio**, isolando `Anti-fraude` em `fraud-audit.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`FraudAudit` passa a seguir o padrao visual do admin e ganha cobertura E2E para registros, filtros e estado vazio.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `fraud-audit.cy.ts`: 3/3.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `NotificationsBroadcast`.

### Motivo
Depois de `DeliveryZones`, a tela `Notificacoes` ainda tinha select, inputs, textarea, botao e feedback visual fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar `notificationsAdminAPI.broadcast`**, mantendo o payload `type`, `title`, `body` e `customerId` opcional.
- **Migrar controles do formulario**, usando `Button`, `Input`, `Label`, `Select` e `Textarea`.
- **Separar feedback de sucesso e erro**, mantendo a limpeza do formulario apenas no sucesso e preservando o texto digitado em falha.
- **Criar spec proprio**, isolando `Notificacoes` em `notifications-broadcast.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`NotificationsBroadcast` entra no mesmo padrao visual do admin e fica protegido por E2E para broadcast geral, segmentado e falha de API.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `notifications-broadcast.cy.ts`: 4/4.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `DeliveryZones`.

### Motivo
Depois de `Recipes`, a tela `Taxas de Entrega` ainda concentrava frete gratis global, formulario de zona, janela de fulfillment via `window.prompt()` e exclusao via `window.confirm()` fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar `deliveryAPI`, `fulfillmentAPI` e `brandAPI`**, mantendo zonas de entrega, slots de fulfillment e configuracao global de frete nos contratos existentes.
- **Migrar controles operacionais**, usando `Button`, `Input`, `Label`, `Select`, `Checkbox` e `Badge`.
- **Substituir prompt/confirm nativos por modais controlados**, deixando criacao de janela e remocao de zona no mesmo padrao visual das telas anteriores.
- **Criar spec proprio**, isolando `Taxas de Entrega` em `delivery-zones.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`DeliveryZones` fecha a sequencia atual de configuracoes operacionais da loja no UI kit e ganha cobertura E2E para frete, janelas e zonas.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `delivery-zones.cy.ts`: 4/4.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `Recipes`.

### Motivo
Depois das configuracoes de loja, a tela `Receitas` ainda tinha formulario, tabela, acoes, paginacao e exclusao via `window.confirm()` fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar `recipesAPI`**, mantendo listagem, categorias, criacao, update, toggle via update e remocao nos endpoints existentes.
- **Migrar formulario e tabela**, usando `Button`, `Input`, `Label`, `Select`, `Textarea`, `Checkbox`, `Badge` e `Table`.
- **Substituir `window.confirm()` por modal controlado**, alinhando a exclusao ao padrao das outras superficies migradas.
- **Criar spec proprio**, isolando `Receitas` em `recipes.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`Recipes` entra na trilha visual do UI kit e ganha cobertura E2E para listagem, criacao, edicao, toggle e exclusao.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `recipes.cy.ts`: 3/3.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `BusinessHours`.

### Motivo
Depois de `BrandIdentity`, a tela `Horarios de Funcionamento` ainda usava checkbox, inputs de horario, botoes de janela e acoes finais fora do padrao do UI kit.

### Decisões Arquiteturais
- **Preservar `brandAPI` como contrato de configuracao da loja**, mantendo `businessHours`, `openMessage`, `closedMessage` e `countdownLabel`.
- **Migrar controles operacionais**, usando `Button`, `Input`, `Label` e `Checkbox`.
- **Criar spec proprio**, isolando `Horarios de Funcionamento` em `business-hours.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`BusinessHours` agora segue o mesmo kit visual das configuracoes de loja e fica protegido por E2E proprio para dias, janelas, mensagens e salvamento.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `business-hours.cy.ts`: 2/2.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `BrandIdentity`.

### Motivo
Depois de concluir as superficies de CMS visual de banners, a tela `Identidade Visual` ainda mantinha inputs e botoes nativos para nome da loja, cores, upload/remocao de logos e salvamento.

### Decisões Arquiteturais
- **Preservar os contratos de marca existentes**, mantendo `brandAPI.get`, `brandAPI.update` e `uploadsAPI`.
- **Migrar controles acionaveis**, usando `Button`, `Input` e `Label`; `input[type=file]` permanece escondido por necessidade de upload e `input[type=color]` permanece nativo por ser controle proprio do navegador.
- **Criar spec proprio**, isolando `Identidade Visual` em `brand-identity.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`BrandIdentity` fica alinhado ao mesmo kit visual usado nas demais superficies do admin e ganha E2E proprio para renderizacao e salvamento.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `brand-identity.cy.ts`: 2/2.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `StoreBannersManager`.

### Motivo
Depois do `LayoutManager` e dos banners promocionais, a tela separada `Banners da Loja` ainda concentrava botoes, inputs, selects, toggle, upload e confirmacao em controles nativos fora do padrão visual escolhido.

### Decisões Arquiteturais
- **Preservar os contratos CMS existentes**, mantendo `cmsAPI.storeBanners` e `uploadsAPI`.
- **Migrar controles operacionais e formulario**, usando `Button`, `Input`, `Label`, `Select`, `Checkbox` e `Badge`.
- **Criar spec proprio**, isolando a tela `Banners da Loja` em `store-banners.cy.ts` com mocks compativeis com URL local com e sem `/api`.

### Impacto
`StoreBannersManager` entra na mesma trilha visual do UI kit e fica protegido por E2E proprio para preview/lista, toggle, edicao e exclusao.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress `store-banners.cy.ts`: 3/3.
- Docker/admin completo e seed QA: bloqueados nesta sessao porque Docker Desktop, API `localhost:3001` e banco `localhost:5432` nao estavam ativos.

### Mudança
UI kit shadcn/ui aplicado em `PromoBannersManager`.

### Motivo
Depois do `LayoutManager`, os banners promocionais ainda apareciam dentro de `Layout do Site` com botoes, inputs, select e modal fora do padrão do UI kit.

### Decisões Arquiteturais
- **Manter a fronteira de CMS existente**, preservando `cmsAPI.promoBanners`, `productsAPI.getAdmin` e `uploadsAPI`.
- **Migrar controles operacionais e formulario**, usando `Button`, `Input`, `Label`, `Select`, `Textarea` e `Badge`.
- **Expandir o spec de Layout**, cobrindo renderizacao, toggle, edicao com produto exaltado, alinhamento e exclusao de banner promocional.

### Impacto
Layout do Site agora cobre tambem a superficie de banners promocionais com UI kit e E2E proprio.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `layout.cy.ts`: 8/8.
- Cypress admin completo: 36/36.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui completou `LayoutManager` em Layout do Site.

### Motivo
A primeira fatia havia migrado o slider e filtros, mas a tabela de categorias, modal de slide e confirmação de exclusão ainda usavam controles nativos fora do padrão escolhido.

### Decisões Arquiteturais
- **Completar `LayoutManager` antes de avançar para banners promocionais**, deixando apenas inputs `file` escondidos como elemento nativo necessário para upload.
- **Adicionar `Textarea` compartilhado**, evitando textarea cru em formularios multiline do admin.
- **Expandir Cypress**, cobrindo prioridade, limite, curadoria manual e exclusão de slide.

### Impacto
`LayoutManager` agora segue o mesmo kit das demais superficies migradas e fica protegido por cobertura E2E propria.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `layout.cy.ts`: 5/5.
- Cypress admin completo: 33/33.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui iniciado em Layout do Site.

### Motivo
O Layout do Site concentra controles de CMS visuais usados na home, especialmente slider principal e banners de categoria. Era a proxima superficie natural depois de Categorias.

### Decisões Arquiteturais
- **Migracao por fatia**, começando pelo `Slider de Destaque` e pela busca/filtros de categorias, sem alterar os contratos `cmsAPI.heroSlides` e `cmsAPI.categories`.
- **Componentes `ui/*` compartilhados**, usando `Button`, `Input` e `Badge` nos controles principais.
- **Cypress com dados mockados**, protegendo renderizacao CMS, busca/filtro, toggle de slide, abertura de modal e toggle de categoria sem depender do banco local.

### Impacto
Layout do Site entrou na trilha do UI kit com cobertura E2E propria, mantendo os modais e a tabela restante como proxima fatia isolada.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `layout.cy.ts`: 3/3.
- Cypress admin completo: 31/31.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui completou o fluxo guiado de Categorias.

### Motivo
A primeira fatia de Categorias cobria `Estrutura da loja`, mas as abas `Sugestões automáticas` e `Revisão final` ainda mantinham botoes e chips fora do UI kit.

### Decisões Arquiteturais
- **Completar a tela antes de mudar de modulo**, migrando tambem navegacao guiada, dry-run, aplicacao real, aprovacao/rejeicao e chips de categoria.
- **Manter o input nativo de upload escondido**, porque o fluxo de arquivo ainda depende do input file do navegador.
- **Cypress ampliado**, cobrindo dry-run, sugestoes, aprovacao e rejeicao de pendencias com dados mockados.

### Impacto
Categorias ficou consistente com o UI kit em todo o fluxo guiado, preservando APIs e contrato visual de upload.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `categories.cy.ts`: 4/4.
- Cypress admin completo: 28/28.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui iniciado em Categorias.

### Motivo
A etapa `Estrutura da loja` concentra a arvore de departamentos/secoes, criacao de categoria, renomeacao, visibilidade e exclusao, que sao controles recorrentes na organizacao do catalogo.

### Decisões Arquiteturais
- **Migracao por fatia**, limitada primeiro a `Estrutura da loja`; a automacao/mapeamento EAN fica para uma fatia separada.
- **Componentes `ui/*` compartilhados**, usando `Button`, `Input` e `Table` nos controles principais sem mudar os contratos de `cmsAPI.categories`.
- **Cypress com dados mockados**, cobrindo listagem, criacao, renomeacao, visibilidade e confirmacao de exclusao sem depender das categorias reais do banco local.

### Impacto
Categorias entrou na trilha do UI kit com cobertura E2E propria e preservou o fluxo guiado existente para automacao e revisao.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `categories.cy.ts`: 2/2.
- Cypress admin completo: 26/26.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui iniciado em Separacao/Picking.

### Motivo
Picking e a superficie operacional mais sensivel do admin depois de pedidos: separadores usam botoes grandes, filtro de fila, formularios inline e status de item durante a execucao real.

### Decisões Arquiteturais
- **Migracao por fatia**, preservando handlers e contratos `pickingAPI` ja cobertos pelos fluxos criticos M20.
- **Componentes `ui/*` compartilhados**, usando `Button`, `Input`, `Select`, `Checkbox` e `Badge` nos controles principais e formularios inline.
- **Cypress com dados mockados**, protegendo leitura da fila, criacao de tarefa, filtro, separacao e ruptura sem depender do estado operacional do banco.

### Impacto
Picking passou a usar a mesma base de UI kit das demais superficies operacionais e ganhou cobertura E2E propria, alem da cobertura critica API/runtime ja existente.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `picking.cy.ts`: 2/2.
- Cypress admin completo: 24/24.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui iniciado em Contas B2B.

### Motivo
Depois de Produtos, Pedidos e Clientes, Contas B2B era a proxima superficie operacional conectada diretamente ao M19, com carteira empresarial, financeiro, listas corporativas, aprovacao e faturamento ainda baseados em controles crus.

### Decisões Arquiteturais
- **Migracao por fatia**, focando primeiro nos controles de leitura e operacao da tela: carteira, busca, cards, formularios, recorrencia/faturamento e fila de aprovacao.
- **Componentes `ui/*` compartilhados**, usando `Button`, `Input`, `Select`, `Badge` e `Table` sem alterar chamadas de API ou regras B2B existentes.
- **Cypress com dados mockados**, validando a UI B2B sem depender de estado real de contas, clientes, listas ou pedidos pendentes.

### Impacto
Contas B2B passou a seguir a base visual do restante do admin migrado e ganhou cobertura E2E especifica para financeiro, listas, formularios e aprovacao.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `business-accounts.cy.ts`: 2/2.
- Cypress admin completo: 22/22.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui iniciado em Clientes.

### Motivo
Depois de Produtos e Pedidos, Clientes era a proxima superficie operacional recorrente, com busca, filtros, lista/colunas e perfil detalhado ainda baseados em elementos crus.

### Decisões Arquiteturais
- **Migracao por fatia**, focando primeiro em controles de leitura e navegacao: toolbar, filtros, tabela, colunas e modal de perfil.
- **Componentes `ui/*` compartilhados**, usando `Button`, `Input`, `Select`, `Badge` e `Table` sem alterar o contrato de props da secao.
- **Cypress com dados mockados**, protegendo comportamento de busca/filtro/detalhe sem depender da base local.

### Impacto
Clientes passou a seguir a mesma base visual de Produtos e Pedidos, reduzindo divergencia de componentes no admin e aumentando a cobertura E2E focada.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `customers.cy.ts`: 2/2.
- Cypress admin completo: 20/20.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui iniciado em Pedidos.

### Motivo
Depois de Produtos, Pedidos era a proxima superficie operacional de maior impacto, com uso frequente de busca, filtros, status, listagem e detalhes financeiros.

### Decisões Arquiteturais
- **Migracao por fatia**, focando primeiro na camada de controles e leitura: toolbar, filtros, lista/kanban, tabela e modal de detalhes.
- **Sem alterar contratos operacionais**, mantendo callbacks existentes de status, pagamento, selecao de pedido e drag/drop Kanban.
- **Cypress com dados mockados**, para validar a UI de Pedidos sem depender de pedidos reais ou do estoque do banco local.

### Impacto
Pedidos passou a compartilhar os componentes base do admin (`Button`, `Input`, `Select`, `Badge`, `Table`) e ganhou cobertura E2E especifica para filtros, lista, kanban e modal.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress `orders.cy.ts`: 2/2.
- Cypress admin completo: 18/18.
- Seed QA recomposto apos a suite completa: OK.

### Mudança
UI kit shadcn/ui expandido para `ProductSlideOver` e Cypress admin estabilizado.

### Motivo
Depois da primeira fatia de Produtos, o formulario lateral ainda concentrava controles fora do UI kit. A suite completa tambem ficava vulneravel ao throttle do `/auth/login` quando varios specs autenticavam em sequencia.

### Decisões Arquiteturais
- **ProductSlideOver como fechamento da fatia de Catalogo**, migrando campos, selects, botoes e badges sem alterar regra de negocio.
- **Seed QA com estoque real**, criando dois produtos M20 idempotentes e `stock_positions` para evitar falha de fluxo critico por dados consumidos em execucoes anteriores.
- **JWT local em Cypress via task**, reduzindo chamadas repetidas ao login real e mantendo o smoke que valida login pela UI.

### Impacto
Catalogo de Produtos ficou com o formulario principal alinhado ao UI kit. A suite admin completa voltou a ser reexecutavel de ponta a ponta sem depender da janela de rate limit do login.

### Validação
- Backend `npm run build`: OK.
- Backend `npm run seed:qa`: OK com `QA-M20-0001` e `QA-M20-0002`.
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Cypress admin `critical-flows.cy.ts`: 3/3.
- Cypress admin completo: 16/16.

### Mudança
UI kit shadcn/ui expandido para Catalogo de Produtos.

### Motivo
Depois da base inicial e da tela de Regras de Alerta, Produtos era a superficie admin de maior uso e melhor retorno para padronizacao visual/operacional.

### Decisões Arquiteturais
- **Migracao incremental**, preservando os cards KPI especificos de M39 e os fluxos cobertos por Cypress.
- **Uso dos componentes `ui/*` ja versionados** para toolbar, busca, filtros, tabela, badges, campos inline, paginacao e historico Solidcom.
- **Sem reescrever regra de negocio**: a fatia alterou apresentacao/controles, mantendo handlers, selecao em lote e edicao inline existentes.

### Impacto
Produtos deixou de depender majoritariamente de HTML cru nos controles principais e passou a usar o UI kit comum do admin. A tela fica mais alinhada com a base shadcn/ui sem interromper a operacao atual do catalogo.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Admin `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress admin `catalog.cy.ts`: 3/3.
- Cypress admin completo: 15/15.

### Mudança
UI kit shadcn/ui iniciado no admin.

### Motivo
O projeto decidiu padronizar a camada de UI em shadcn/ui para ganhar componentes consistentes sem prender o visual a uma biblioteca fechada.

### Decisões Arquiteturais
- **shadcn/ui no admin primeiro**, por ser a superficie operacional mais sensivel e com maior retorno de padronizacao.
- **Componentes versionados no proprio repo** em `sistema/admin/src/components/ui/`, mantendo controle total sobre Tailwind e tokens de marca.
- **Migracao por fatias**, iniciando por `AlertRulesManager` na area de Inteligencia antes de mexer em Produtos/Pedidos/Clientes.

### Impacto
O admin agora tem base de UI kit reutilizavel, com componentes iniciais para botoes, inputs, labels, selects, checkboxes, badges, cards e tables. Tambem foi corrigido o token enviado por Regras de Alerta e Relatorio Executivo, que agora usa `adminToken`.

### Validação
- Admin `npm run lint`: OK.
- Admin `npm run build`: OK.
- Admin `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- `docker compose build admin`: OK.
- `docker compose up -d --force-recreate admin`: OK.
- Cypress admin `ui-kit.cy.ts`: 1/1, validando navegacao ate Inteligencia, renderizacao da superficie migrada e header `Authorization` em `/analytics/alert-rules`.
- Cypress admin completo: 15/15.

### Mudança
Auditoria Top-Tier M20 — segurança frontend/admin aplicada.

### Motivo
Depois do upgrade backend, restavam vulnerabilidades moderadas em Vite/esbuild nos pacotes `frontend` e `admin`.

### Decisões Arquiteturais
- **Vite 7.3.3** aplicado no storefront e admin para consumir a cadeia esbuild corrigida.
- **@vitejs/plugin-react 5.2.0** aplicado junto para manter compatibilidade com Vite 7.
- A validacao foi feita contra os bundles Docker recriados, nao apenas contra `dist` local.

### Impacto
Backend, frontend e admin ficaram com `npm audit --audit-level=moderate` zerado. O bloco M20 de seguranca/release aplicado nao tem pendencia tecnica restante neste ambiente local.

### Validação
- Frontend/admin `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- Frontend/admin lint e build OK.
- Frontend unit: 60/60.
- `docker compose build storefront admin` e recreate dos containers OK.
- `release-ops.ps1 smoke` OK.
- Cypress storefront completo: 34/34.
- Cypress admin completo: 14/14, incluindo `critical-flows.cy.ts`.

### Mudança
Auditoria Top-Tier M20 — segurança backend aplicada.

### Motivo
O audit ainda apontava vulnerabilidades altas no backend presas em NestJS, bcrypt/tar e tooling TypeScript/ESLint. Frontend/admin também tinham high em `@typescript-eslint`/`minimatch`.

### Decisões Arquiteturais
- **NestJS 11 coordenado** aplicado no backend para `common`, `core`, `platform-express`, `swagger`, `serve-static`, `throttler`, `config`, `jwt`, `passport`, `testing`, `cli` e `schematics`.
- **bcrypt 6** substituiu `bcrypt 5`, removendo a cadeia `@mapbox/node-pre-gyp` -> `tar`.
- **Tooling TypeScript/ESLint** atualizado para ESLint `8.57.1` e `@typescript-eslint/*` `7.18.0` nos três workspaces sem migrar ainda para ESLint 9.
- **Rota opcional de upload** reescrita como duas rotas explicitas para compatibilidade com path-to-regexp novo.

### Impacto
Backend ficou com audit zerado e frontend/admin ficaram sem vulnerabilidades altas. A pendencia de seguranca restante e moderada, concentrada em Vite/esbuild.

### Validação
- Backend lint/build OK.
- Backend testes: 34 suites / 206 testes.
- Backend `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- Frontend/admin `npm audit --audit-level=high`: sem vulnerabilidades altas.
- Frontend unit: 60/60.
- Prisma validate/migrate status OK.
- Docker API rebuild/recreate OK; `release-ops.ps1 smoke` OK.
- Cypress admin completo: 14/14.

### Mudança
Auditoria Top-Tier M20 — release e seguranca operacionalizados.

### Motivo
Depois do E2E critico, o checklist M20 ainda exigia ambiente staging, variaveis por ambiente, feature flags, changelog, rollback, smoke pos-deploy, backup e restore testado.

### Decisões Arquiteturais
- **Staging reativado como homologacao local isolada** usando `sistema/docker-compose.staging.yml` nas portas `4000/4001/4002`.
- **Runbook canonico M20** criado em `M20 Release e Seguranca.md`, concentrando gates obrigatorios, matriz de ambientes, feature flags, rollback, smoke, backup/restore e plano de upgrade major.
- **Operador de release** criado em `sistema/release-ops.ps1` para tornar smoke, backup e restore-test executaveis.
- **Changelog canonico** criado em `CHANGELOG.md`.

### Impacto
O bloco de release do M20 deixou de ser pendencia documental. A proxima frente fica bem delimitada: executar os upgrades major para zerar as vulnerabilidades altas restantes em backend/frontend/admin.

### Validação
- `.\release-ops.ps1 preflight` OK, incluindo `docker compose config` local/staging e smoke local autenticado.
- `.\release-ops.ps1 backup` gerou dump PostgreSQL.
- `.\release-ops.ps1 restore-test` restaurou o dump em PostgreSQL temporario e confirmou 109 tabelas publicas.

## 2026-05-31

### Mudança
Auditoria Top-Tier M20 — E2E critico fechado.

### Motivo
O checklist M20 ainda tinha lacunas nos fluxos operacionais mais sensiveis: picking, substituicao, pagamento webhook, integracao ERP, cancelamento parcial e reembolso.

### Decisões Arquiteturais
- **Spec API-driven no admin Cypress** em `sistema/admin/cypress/e2e/critical-flows.cy.ts`, validando contratos reais de backend/admin sem depender de prompts ou timing visual.
- **Selecao por disponibilidade real** via `/availability`, evitando falso vermelho quando o catalogo mostra estoque bruto mas reservas deixam o produto indisponivel.

### Impacto
O M20 agora tem evidencia objetiva para o bloco E2E critico. As pendencias restantes ficam concentradas em seguranca/release: upgrades major, variaveis por ambiente, changelog, rollback, smoke pos-deploy, backup e restore testado.

### Validação
- Cypress admin `critical-flows.cy.ts`: 3/3.
- Cypress admin completo: 14/14.
- Admin lint/build OK.

### Mudança
Auditoria Top-Tier M20 — governanca de engenharia, QA e release iniciada.

### Motivo
Depois do fechamento do M19, a auditoria exige evidência objetiva de evolução sem regressão: lint, typecheck/build, testes, migration check, seed seguro, E2E critico, smoke e security scan.

### Decisões Arquiteturais
- **Seed QA idempotente** criado em `scripts/seed-qa.ts`, separado do `prisma/seed.ts` legado porque o seed legado apaga dados reais.
- **E2E checkout atualizado** para o fluxo server-side atual, mockando `/cart` e `/checkout/sessions` nos testes de storefront.
- **Security scan nao-forcado**: aplicado `npm audit fix` sem `--force`; upgrades major ficaram pendentes para uma janela propria.

### Impacto
O projeto agora tem uma primeira base verificavel de M20: pipeline local verde para lint/build/test, seed de QA seguro e E2E storefront/admin passando. As pendencias restantes ficaram explicitadas, sem vender o milestone como concluido antes de cobrir os fluxos críticos faltantes.

### Validação
- Backend lint/build/test OK — 34 suites / 206 testes.
- Frontend lint/build/unit OK — 60/60 testes.
- Admin lint/build OK.
- Prisma validate/migrate status OK — banco atualizado com 45 migrations.
- `npm run seed:qa` OK.
- Cypress storefront 34/34 e admin 11/11.
- Docker API/admin/storefront recriados e smoke HTTP 200.
- `npm audit --audit-level=high` executado; root sem vulnerabilidades, pacotes dos apps ainda com vulnerabilidades altas que dependem de upgrades major/breaking.

### Mudança
Auditoria Top-Tier M19 — núcleo B2B/atacarejo e contas comerciais aplicado.

### Motivo
A auditoria exigia compras empresariais com preço próprio, aprovação, limite de crédito, prazo de pagamento, faturamento e vínculo de múltiplos usuários por conta.

### Decisões Arquiteturais
- **Conta comercial** criada como `BusinessAccount`, com tenant/store, documento, status, limite de crédito, prazo, perfil fiscal e regras recorrentes.
- **Usuários empresariais** vinculados por `BusinessAccountUser`, com papel e status por cliente.
- **Preço B2B** usa `PriceList.businessAccountId`, com prioridade explícita sobre listas globais, por cliente e por segmento.
- **Aprovação de compra** fica no pedido por `businessApprovalStatus`, preservando o pedido em `PENDING_APPROVAL` até aprovação.
- **Financeiro B2B** expõe limite, crédito usado/disponível, prazo, aprovações pendentes e usuários ativos.
- **Admin B2B** ganhou a seção `Contas B2B`, com carteira de empresas, financeiro, criação de conta, vínculo de cliente, tabela de preço e aprovação de pedidos.
- **Pedido mínimo B2B** passa a morar em `BusinessAccount.minimumOrder`, aparecer na cotação e bloquear criação de pedido abaixo do valor.
- **Lista corporativa** reaproveita `ShoppingList`, agora vinculável a `BusinessAccount` por `businessAccountId`.
- **Pedido recorrente operacional** cria pedido B2B a partir de lista corporativa, respeitando regras recorrentes, aprovação e idempotência.
- **Faturamento/nota operacional** aciona os contratos fiscais e de cobrança existentes por pedido ou por conta empresarial.

### Impacto
Cliente B2B recebe preço próprio na cotação, pedidos empresariais podem exigir aprovação antes de seguir fluxo operacional, e o financeiro passa a consultar limite/prazo e exposição de crédito por conta.
O time administrativo agora opera contas comerciais e aprovações sem sair do painel.
Compras empresariais agora têm lista corporativa e proteção de pedido mínimo antes de chegar ao operacional.
Recorrência e faturamento deixam de ser apenas configuração: a operação consegue gerar pedidos B2B recorrentes e disparar contratos fiscal/cobrança pela tela `Contas B2B`.

### Validação
- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run build` em `sistema/backend`
- `npm test -- --runInBand` em `sistema/backend` — 34 suites / 206 testes passando
- Docker API recriado e `/health` OK
- Fluxo runtime validado com preço B2B `17.99` sobre base `24.99`, pedido `PENDING_APPROVAL`, fila de aprovação, aprovação `APPROVED`, financeiro com limite/prazo e conta com 2 usuários ativos.
- `npm run build` em `sistema/admin`
- `docker compose build admin`
- `docker compose up -d --force-recreate admin`
- Browser em `http://localhost:3002` validou menu `Contas B2B`, métricas, financeiro, fila sem erros/warnings e aprovação de pedido pendente pela UI.
- Migration `20260531043000_add_b2b_minimum_order_and_corporate_lists`
- Runtime validou lista corporativa criada/listada, quote com mínimo B2B e bloqueio 400 para pedido abaixo de `999.00`.
- Runtime validou conta B2B, lista corporativa, pedido recorrente aprovado, faturamento por pedido e faturamento por conta.
- Conectores externos de NF-e/pagamentos retornaram erro controlado por falta de credenciais no ambiente, preservando o contrato gerado para auditoria.
- Browser em `http://localhost:3002` validou controles de recorrência e faturamento na seção `Contas B2B`.
- Flush Redis, build e recreate de `api`, `admin` e `storefront` executados no encerramento do M19; `/health`, admin e storefront responderam 200.

### Mudança
Auditoria Top-Tier M18 — UX/UI premium por persona concluída.

### Motivo
A auditoria exigia que o produto deixasse de ser apenas uma loja organizada e passasse a guiar consumidor, operador, separador e gestor com prioridades claras e fluxos móveis.

### Decisões Arquiteturais
- **Vitrines por intenção** na home usando recomendações, taxonomia comercial e fallback local: recompre, ofertas, frescos, feira, churrasco/ocasião e recorrentes.
- **Substituição por item** virou preferência persistida no carrinho e enviada ao contrato de checkout, não apenas texto informativo.
- **Picker mobile sem prompts soltos**: ações de separar, falta e substituição passaram para formulário inline no card do item.
- **Painel por função** no admin concentra filas operacionais por operador, separador e gestor.

### Impacto
Consumidor recompra e fecha pedido com menos atrito; operador identifica prioridades por SLA/fila; separador consegue operar pelo celular; gestor enxerga gargalos de catálogo, integrações, ruptura e picking rapidamente.

### Validação
- `npm run build` em `sistema/frontend`
- `npm run build` em `sistema/admin`
- `npm run test:unit` em `sistema/frontend` — 60/60 testes passando
- `docker compose build storefront/admin`
- `docker compose up -d --force-recreate storefront/admin`
- Browser validou home, carrinho, checkout, dashboard e separação sem erros/warnings de console.

## 2026-05-25

### Mudança
M39 — Redesign da tela de edição de produtos no Admin + Gestão de Mídia de Produto.

### Motivo
A tela de edição era um slide-over lateral que deixava a maior parte da tela vazia, gerando experiência ruim. O operador também não tinha forma de associar fotos ou vídeos promocionais diretamente ao produto.

### Decisões Arquiteturais
- **Modal centralizada** substituiu o slide-over lateral — melhor uso do espaço, premium e alinhado ao design do projeto.
- **Upload de imagens por slot** em vez de URL: mais simples para o operador, mantendo naming convention `{ean}.webp` / `{ean}_2.webp` já usada pelo storefront.
- **Vídeo por link** (não upload): decisão deliberada pois os vídeos existem em plataformas (YouTube, Instagram, TikTok); o sistema converte o link para `<iframe>` embed automaticamente.

### Impacto
Admin: edição de produtos muito mais ergonômica e com gestão de mídia integrada.
Storefront: página de detalhe já exibia 2 slots de imagem e o player de vídeo embed; agora o operador pode preencher esses slots via backoffice.

### Arquivos Afetados
- `sistema/admin/src/pages/sections/ProductSlideOver.tsx` (refatorado completamente)
- `sistema/admin/src/pages/sections/ProductsSection.tsx` (chamada da modal)
- `sistema/admin/src/services/api.ts` (`productsAPI.uploadImage` com suporte a slot)
- `sistema/admin/src/pages/Dashboard.tsx` (`buildProductPayload` corrigido)
- `sistema/backend/src/modules/uploads/uploads.controller.ts` (rota `/:ean/:slot?`)
- `sistema/frontend/src/pages/ProductDetail.tsx` (já implementado: slots de imagem + `ProductVideoEmbed`)

## 2026-05-24

### Mudança
Estruturação completa da Memory-Wiki Obsidian em subpastas sob `arquivos-projeto/md/`.

### Motivo
Atendimento à solicitação de execução da skill `obsidian-memory-wiki-skill`.

### Impacto
Melhoria na escaneabilidade do projeto, manutenção de memória contínua, ponto claro de retomada de tarefas para IAs e humanos, e definição estruturada de agentes.

### Arquivos Afetados
- Todos os arquivos sob `00 - Dashboard/`
- Todos os arquivos sob `01 - Projeto/`
- Todos os arquivos sob `02 - Contexto/`
- Todos os arquivos sob `03 - Agentes/`
- Todos os arquivos sob `04 - Skills/`
- Todos os arquivos sob `99 - Sistema/`
- [[STATUS|STATUS.md]] (atualizado para registrar início/fim do milestone)
