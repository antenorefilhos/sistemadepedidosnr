---
tipo: runbook
status: ativo
area: contexto
prioridade: alta
criado: 2026-06-05
atualizado: 2026-06-06
tags:
  - web-push
  - homologacao
  - operacao
---

# RUNBOOK_WEB_PUSH - Homologacao Externa

Objetivo: provar entrega real de Web Push em dominio HTTPS nao-local, com VAPID final, PWA/service worker publicado e subscription real gravada em `push_subscriptions`.

## Pre-requisitos

- Storefront publicado em HTTPS nao-local.
- Backend apontando para o mesmo banco que sera usado na prova.
- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` configuradas no backend.
- `VITE_VAPID_PUBLIC_KEY` no build do storefront igual a `VAPID_PUBLIC_KEY`.
- `VAPID_SUBJECT` configurado como `mailto:` ou URL HTTPS.
- Cliente real ou QA com login funcional no storefront.
- Navegador com permissao de notificacoes desbloqueada para o dominio.

## Variaveis

Para gerar um par VAPID novo sem gravar segredo automaticamente:

```powershell
cd sistema
npm run generate:web-push-vapid -- --subject mailto:admin@antenor.com.br
```

Para gerar formato `.env` com prefixo staging:

```powershell
npm run generate:web-push-vapid -- --staging --env --subject mailto:admin@antenor.com.br
```

Para gerar um arquivo completo de homologacao, com VAPID, origem, CORS e chave do build do storefront:

```powershell
npm run prepare:web-push-env -- --output .env.staging --staging --origin https://SEU-DOMINIO --admin-origin https://SEU-ADMIN --subject mailto:admin@antenor.com.br
```

Para incluir o banco usado na inspeção e na prova:

```powershell
npm run prepare:web-push-env -- --output .env.staging --staging --origin https://SEU-DOMINIO --admin-origin https://SEU-ADMIN --subject mailto:admin@antenor.com.br --database-url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public"
```

Se as chaves VAPID finais ja existirem e nao devem ser rotacionadas, informe o par explicitamente:

```powershell
npm run prepare:web-push-env -- --output .env.staging --staging --origin https://SEU-DOMINIO --admin-origin https://SEU-ADMIN --subject mailto:admin@antenor.com.br --database-url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public" --vapid-public-key "CHAVE_PUBLICA" --vapid-private-key "CHAVE_PRIVADA"
```

Preferivel quando as chaves ja estiverem em um arquivo local: reutilizar do env sem expor chave privada na linha de comando:

```powershell
npm run prepare:web-push-env -- --output .env.staging --merge-existing --staging --origin https://SEU-DOMINIO --admin-origin https://SEU-ADMIN --subject mailto:admin@antenor.com.br --database-url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public" --vapid-from-env --env-file .env.staging
```

Use `--merge-existing` quando o destino for `.env.staging` existente; assim variaveis nao relacionadas ao Web Push sao preservadas. O comando nao sobrescreve arquivo existente sem `--force` ou `--merge-existing`. Para rotacionar chaves conscientemente e substituir o arquivo inteiro:

```powershell
npm run prepare:web-push-env -- --output .env.staging --staging --origin https://SEU-DOMINIO --admin-origin https://SEU-ADMIN --subject mailto:admin@antenor.com.br --force
```

Para usar `.env.staging` no staging local/externo, grave as variaveis `STAGING_VAPID_*`, `WEB_PUSH_ORIGIN`, `STAGING_FRONTEND_URL`, `STAGING_ADMIN_URL` e `STAGING_CORS_ORIGIN` nesse arquivo. O helper `.\staging-ops.ps1 up` carrega `.env.staging` automaticamente quando ele existir. No Compose direto, use:

```powershell
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
```

No terminal da prova, apontar para o banco do ambiente externo:

```powershell
$env:DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public"
$env:WEB_PUSH_ORIGIN="https://SEU-DOMINIO"
$env:VAPID_PUBLIC_KEY="CHAVE_PUBLICA"
$env:VAPID_PRIVATE_KEY="CHAVE_PRIVADA"
$env:VAPID_SUBJECT="mailto:admin@antenor.com.br"
$env:VITE_VAPID_PUBLIC_KEY=$env:VAPID_PUBLIC_KEY
```

Se o ambiente usa prefixo staging, tambem sao aceitas:

```powershell
$env:STAGING_VAPID_PUBLIC_KEY="CHAVE_PUBLICA"
$env:STAGING_VAPID_PRIVATE_KEY="CHAVE_PRIVADA"
$env:STAGING_VAPID_SUBJECT="mailto:admin@antenor.com.br"
```

## Passo a Passo

1. Validar a tooling operacional antes de mexer no ambiente real:

```powershell
cd sistema
npm run validate:web-push-tooling
```

Esperado: `Web Push tooling validation OK.` Esse gate cria arquivos temporarios, valida geração de env, readiness, `--vapid-from-env` e `--merge-existing`, depois limpa os temporarios.

2. Validar configuracao externa e origem publicada:

```powershell
cd sistema
npm run validate:web-push-readiness -- --external --live
```

Esperado: `Web Push readiness OK (external mode, live origin checked).`

Se o arquivo `.env.staging` precisa ser preservado, sobrescreva a origem apenas no comando:

```powershell
npm run validate:web-push-readiness -- --external --live --env-file .env.staging --origin https://SEU-DOMINIO
```

Se o dominio HTTPS ainda nao estiver publicado, rode sem `--live` para validar apenas variaveis/arquivos locais:

```powershell
npm run validate:web-push-readiness -- --external
```

O preflight tambem aceita arquivo de ambiente especifico, sobrescrevendo `.env`, `.env.local` e `.env.staging`:

```powershell
npm run validate:web-push-readiness -- --external --live --env-file .env.web-push
```

Os comandos individuais tambem aceitam o mesmo arquivo:

```powershell
npm run inspect:web-push-subscriptions -- --env-file .env.staging --require-ready
npm run prove:web-push-delivery -- --env-file .env.staging --dry-run
npm run prove:web-push-delivery -- --env-file .env.staging
```

Fluxo orquestrado recomendado depois de publicar o dominio e registrar a subscription:

```powershell
npm run homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir
```

Esse comando executa preflight, inspeção com `--require-ready` e dry-run da prova. Ele nao envia notificação real sem `--send`:

```powershell
npm run homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir --send --validate-evidence --report
```

Quando a origem do arquivo `.env.staging` nao for a URL da prova, adicione `--origin https://SEU-DOMINIO`; o orquestrador aplica essa origem no preflight, inspeção, dry-run e envio.

Com `--evidence-dir-auto`, o orquestrador cria uma subpasta unica dentro de `artifacts/web-push-homologation` e imprime o caminho no terminal. Para usar uma base propria, combine `--evidence-dir-auto --evidence-dir artifacts/minha-base`; para nomear a execução, use `--evidence-run-id ID_DA_PROVA`.
Dentro da pasta criada, o orquestrador grava `web-push-inspect.json`, `web-push-dry-run.json` e, somente quando `--send` for usado, `web-push-send.json`. Esses arquivos mascaram endpoints e nao gravam VAPID privado.
O preflight também grava `web-push-readiness.json` quando a homologação usa `--evidence-dir` ou `--evidence-dir-auto`.
Com `--validate-evidence --report`, o mesmo comando também valida o pacote e gera `web-push-homologation-report.md`.
Depois de registrar a confirmacao visual, `--require-visual-confirmation` pode ser usado na validacao/relatorio para exigir `web-push-visual-confirmation.json`.
Use `--require-readiness` na validação final para exigir que o preflight externo/live esteja no pacote.
Com `--require-empty-evidence-dir`, a prova falha se a pasta ja tiver arquivos. `--force-evidence-overwrite` existe apenas para reaproveitamento consciente.

Depois da homologação seca, valide o pacote parcial de evidencias:

```powershell
npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation
```

Depois do envio real com `--send`, valide o pacote completo:

```powershell
npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation --require-send
```

Em seguida, gere o relatório Markdown para anexar ao status/changelog:

```powershell
npm run report:web-push-homologation -- --evidence-dir artifacts/web-push-homologation --require-send
```

3. Abrir o storefront HTTPS no navegador/dispositivo real.

4. Fazer login como cliente.

5. Abrir o sino de notificacoes.

6. No bloco "Avisos no navegador", clicar em "Ativar notificações".

7. Aceitar a permissao nativa do navegador.

8. Confirmar que o banco recebeu subscription completa:

```powershell
npm run inspect:web-push-subscriptions -- --env-file .env.staging --require-ready
```

Esperado: `complete` maior que `0` e mensagem para rodar `prove:web-push-delivery`.
O JSON de evidência gravado pelo orquestrador inclui a origem usada na inspeção; em fluxo avulso, passe `--origin https://SEU-DOMINIO` ou configure `WEB_PUSH_ORIGIN`.

9. Disparar a prova real:

```powershell
npm run prove:web-push-delivery -- --env-file .env.staging --title "Antenor & Filhos" --body "Prova Web Push recebida" --url "/"
```

Esperado: `Web Push proof result: sent=1 failed=0` ou `sent>=1 failed=0`.

Opcionalmente, antes do envio real, valide os alvos sem disparar push:

```powershell
npm run prove:web-push-delivery -- --env-file .env.staging --dry-run --title "Antenor & Filhos" --body "Prova Web Push recebida" --url "/"
```

Esperado: `Web Push proof dry-run: targets>=1 failed=0`.

Para evidencias avulsas fora do orquestrador, adicionar:

```powershell
npm run inspect:web-push-subscriptions -- --env-file .env.staging --origin https://SEU-DOMINIO --require-ready --json-output artifacts/web-push-homologation/web-push-inspect.json
npm run prove:web-push-delivery -- --env-file .env.staging --dry-run --json-output artifacts/web-push-homologation/web-push-dry-run.json
npm run prove:web-push-delivery -- --env-file .env.staging --json-output artifacts/web-push-homologation/web-push-send.json
```

10. Confirmar recebimento visual no dispositivo/navegador.

11. Registrar a confirmacao visual na mesma pasta de evidencias impressa pelo orquestrador e finalizar o pacote:

```powershell
npm run confirm:web-push-visual -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA --confirmed-by "NOME_QA" --device "DISPOSITIVO" --browser "Chrome PWA" --origin "https://SEU-DOMINIO" --note "Notificacao recebida visualmente." --finalize
```

Se houver screenshot salvo dentro de `sistema/`, inclua:

```powershell
npm run confirm:web-push-visual -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA --confirmed-by "NOME_QA" --device "DISPOSITIVO" --browser "Chrome PWA" --origin "https://SEU-DOMINIO" --screenshot artifacts/web-push-homologation/ID_DA_PROVA/screenshot.png --finalize
```

12. Alternativa manual: se a confirmação visual ja foi registrada sem `--finalize`, valide e gere o pacote final:

```powershell
npm run finalize:web-push-homologation -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA
```

O `--finalize` do comando de confirmação visual chama esse finalizador automaticamente. O finalizador roda a validacao final com `--require-readiness --require-send --require-visual-confirmation`, gera `web-push-homologation-report.md`, grava `web-push-evidence-manifest.json` com SHA-256/tamanho dos artefatos finais e verifica o manifesto automaticamente. Se precisar salvar o relatorio em outro caminho dentro de `sistema/`, use o comando manual com `--output CAMINHO.md`.

13. Revalidar integridade do manifesto final antes de arquivar/enviar o pacote:

```powershell
npm run verify:web-push-evidence-manifest -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA
```

Esperado: `Web Push evidence manifest verified.`. Esse comando recalcula os hashes e tamanhos dos artefatos listados em `web-push-evidence-manifest.json`; se relatório ou JSON forem alterados depois da finalização, o pacote é reprovado.

O pacote final é reprovado se a origem registrada em `web-push-readiness.json`, `web-push-inspect.json`, `web-push-dry-run.json`, `web-push-send.json` e `web-push-visual-confirmation.json` nao for a mesma.
O pacote final é reprovado se o alvo enviado nao tiver aparecido no dry-run, ou se o alvo do dry-run nao tiver aparecido como subscription completa na inspeção.
O pacote final também é reprovado se a cronologia dos timestamps estiver invertida: preflight, inspeção, dry-run, envio real e confirmação visual precisam aparecer nessa ordem.

## Filtros Uteis

Por email do cliente:

```powershell
npm run inspect:web-push-subscriptions -- --customer-email cliente@exemplo.com --require-ready
npm run prove:web-push-delivery -- --customer-email cliente@exemplo.com
```

Por id do cliente:

```powershell
npm run inspect:web-push-subscriptions -- --customer-id CUSTOMER_ID --require-ready
npm run prove:web-push-delivery -- --customer-id CUSTOMER_ID
```

Por tenant:

```powershell
npm run inspect:web-push-subscriptions -- --tenant tenant_default --require-ready
npm run prove:web-push-delivery -- --tenant tenant_default
```

Por trecho do endpoint:

```powershell
npm run inspect:web-push-subscriptions -- --endpoint-contains fcm.googleapis.com
npm run prove:web-push-delivery -- --endpoint-contains fcm.googleapis.com
```

Limpeza operacional opcional durante a prova:

```powershell
npm run prove:web-push-delivery -- --cleanup-expired --cleanup-incomplete
```

- `--cleanup-expired` remove endpoints que retornarem 404 ou 410 do provider.
- `--cleanup-incomplete` remove registros sem `endpoint`, `auth` ou `p256dh`.
- Sem essas flags, o script apenas reporta falhas e nao remove registros.
- `--dry-run` nao envia push e nao executa limpezas; use para conferir alvos e payload antes do disparo real.

## Diagnostico Rapido

Estado local verificado em 6 de junho de 2026:
- `.env.staging` ja possui VAPID persistente e o readiness live local passa contra `http://localhost:4000`;
- o banco staging ainda tem `total=0 complete=0 incomplete=0`;
- o navegador interno exibiu `Permissão bloqueada no navegador.` e nao criou subscription;
- o preflight `--external --live` deve reprovar a origem local somente por exigir HTTPS e host nao-local.

Estado externo verificado em 6 de junho de 2026:
- origem `https://jonathan.tailf56692.ts.net` publicada via Tailscale Funnel;
- preflight externo/live OK;
- subscription real Chrome/Cypress registrada com `total=1 complete=1 incomplete=0`;
- envio real OK em `artifacts/web-push-homologation/20260606T080939Z`, `sent=1 failed=0`;
- helper `register:web-push-cdp-chrome` registra subscription real via Chrome/CDP quando for preciso manter uma janela de navegador viva;
- pacote candidato `artifacts/web-push-homologation/20260606T085300Z-final` tambem passou com `total=6 complete=6` e `sent=1 failed=0`;
- confirmação visual final foi registrada por histórico de notificações do Windows;
- pacote `artifacts/web-push-homologation/20260606T085300Z-final` foi finalizado com relatório e manifesto verificado.

Quando a UI informar que a permissao esta bloqueada:
- abra as configuracoes do site no navegador e altere Notificacoes para Permitir, ou use outro navegador/dispositivo real;
- recarregue o storefront e acione novamente "Ativar notificações";
- nao tente contornar a decisao de permissao via script: a subscription precisa vir da autorizacao nativa do navegador;
- rode `inspect:web-push-subscriptions -- --env-file .env.staging --require-ready` e prossiga apenas quando `complete>=1`.

`validate:web-push-readiness -- --external` falha:
- conferir `WEB_PUSH_ORIGIN` HTTPS nao-local;
- conferir paridade `VAPID_PUBLIC_KEY` e `VITE_VAPID_PUBLIC_KEY`;
- conferir manifesto/service worker publicados;
- conferir `VAPID_SUBJECT`.

`validate:web-push-readiness -- --external --live` falha:
- conferir se `WEB_PUSH_ORIGIN` esta acessivel publicamente;
- conferir se `/manifest.webmanifest` responde 200 com JSON;
- conferir se `/service-worker.js` responde 200 sem cache longo;
- conferir se o HTML publicado aponta para `/manifest.webmanifest`.

`inspect:web-push-subscriptions -- --require-ready` falha com `total=0`:
- cliente ainda nao clicou em "Ativar notificações";
- permissao foi bloqueada;
- storefront foi buildado sem `VITE_VAPID_PUBLIC_KEY`;
- API nao recebeu `POST /notifications/push-subscribe`;
- `DATABASE_URL` aponta para banco errado.

`inspect:web-push-subscriptions` mostra registros incompletos:
- subscription chegou sem `auth` ou `p256dh`;
- navegador/ambiente nao retornou `PushSubscriptionJSON` completo;
- repetir ativacao depois de limpar permissao/site data.

`prove:web-push-delivery` falha com 404 ou 410:
- endpoint expirou ou foi revogado;
- o backend remove subscriptions expiradas no fluxo normal de envio;
- no script de prova, rode com `--cleanup-expired` se quiser remover expiradas durante a homologação;
- repetir ativacao no navegador e rodar inspeção novamente.

`prove:web-push-delivery` envia, mas nada aparece:
- conferir permissao do sistema operacional;
- conferir foco/quiet mode do navegador;
- conferir se service worker esta ativo;
- testar com navegador aberto e depois com app fechado.

## Criterio de Aceite

- Preflight externo com `--live` OK contra o dominio publicado.
- `web-push-readiness.json` gerado no pacote de evidencias.
- `inspect:web-push-subscriptions -- --require-ready` OK com `complete>=1`.
- `prove:web-push-delivery -- --dry-run` OK com `targets>=1 failed=0`.
- `prove:web-push-delivery` OK com `sent>=1 failed=0`.
- Evidencias JSON geradas em `artifacts/web-push-homologation/`.
- `validate:web-push-evidence -- --require-send` OK contra o pacote de evidencias.
- `confirm:web-push-visual` gerou `web-push-visual-confirmation.json` depois da notificacao ser vista.
- `finalize:web-push-homologation` OK contra o pacote de evidencias, com readiness externo/live, inspeção, envio real, confirmacao visual e origem consistente.
- `verify:web-push-evidence-manifest` OK contra o pacote finalizado.
- Alvo do envio real confere com o alvo validado no dry-run e na inspeção.
- Cronologia do relatório mostra confirmação visual posterior ao envio real.
- `web-push-homologation-report.md` gerado pelo finalizador.
- Notificacao recebida visualmente no dispositivo/navegador real.
- Evidencia registrada no changelog/status com data, dominio usado, cliente de teste e resultado.
