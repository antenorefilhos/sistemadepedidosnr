# Notificador de Pedidos — Windows

App Electron que roda em segundo plano no Windows: icone na bandeja, toast
sempre que existirem pedidos novos ou pendentes de separacao, e um painel
(clique no icone) com a lista dos ultimos pedidos e o andamento de cada um.

## Comportamento

- Polling a cada **1 minuto** na API do backend
- Clique no icone da bandeja abre um painel ancorado no canto da tela com os
  ultimos pedidos, nome do cliente, status traduzido, itens e total —
  atualiza sozinho a cada poll, fecha ao perder foco
  (clique com o botao direito abre o menu: Ver pedidos / Verificar agora / Sair)
- Roda sem janela de console (VBS launcher)
- Inicia automaticamente com o Windows (pasta Startup)

### Alerta escalonado por tempo de espera

Todo pedido que ainda **nao entrou em separacao** (`PENDING`, `CONFIRMED` ou
`PICKING_PENDING`) escala de nivel conforme envelhece. O alerta so silencia
quando a separacao comeca de fato (status vira `PICKING`).

| Idade do pedido | Nivel | Cor | Som | Tempo na tela |
|---|---|---|---|---|
| 0–5 min | **NOVO** | verde | Notify Messaging | 6s |
| 5–10 min | **ATENCAO** | amarelo | Exclamation | 9s |
| 10 min+ | **CRITICO** | vermelho (pulsando) | Critical Stop | 14s |

- **CRITICO se repete a cada 5 minutos** ate a separacao comecar. Os outros
  niveis avisam so uma vez (na entrada do nivel).
- A idade conta do `createdAt` **real do pedido**, nao de quando o notificador
  viu: se o PC ficou desligado e o pedido tem 40 min, ele ja abre em vermelho.
- Um aviso por nivel, nao um por pedido — 3 pedidos criticos = 1 aviso
  agrupado, nao 3 janelas.
- Avisos entram numa **fila**: aparecem um de cada vez, nao se atropelam.
- Clicar na notificacao abre o painel.
- No painel os pedidos aguardando vem primeiro, do mais antigo pro mais novo
  (o mais atrasado no topo).

Pra conferir os 3 niveis sem esperar um pedido envelhecer: botao direito no
icone da bandeja > **Testar alertas (3 niveis)**.

### Por que a notificacao nao e o toast nativo do Windows

O toast nativo nao aceita cor nem nome de app customizado sem um instalador
que registre o `AppUserModelID` — aparecia como "electron", preto e sem
distincao de nivel. Trocado por uma `BrowserWindow` propria no canto inferior
direito, com CSS proprio (faixa colorida por nivel, o critico pulsando).

Armadilha achada aqui: `transparent: true` combinado com
`focusable: false`/`showInactive()` renderiza **janela invisivel** no Windows
— a janela reporta `isVisible() === true`, o renderer roda sem erro, e nada
aparece na tela. Usar janela opaca com `backgroundColor` (o Windows 11
arredonda as bordas sozinho). Nao voltar pra `transparent: true`.

A logica de niveis vive em `escalation.js` (sem dependencia de Electron, pra
ser testavel). Rodar os testes:

```bash
npm test
```

## Estrutura

```
Notificador/
  main.js            # processo principal Electron: tray, polling, toast, janela
  escalation.js      # niveis de urgencia por tempo de espera (logica pura)
  escalation.test.js # testes da escalonamento (npm test)
  preload.js         # ponte IPC segura (contextBridge) pro painel e notificacao
  renderer/
    index.html       # painel de pedidos
    style.css
    renderer.js
    toast.html       # notificacao propria (substitui o toast do Windows)
    toast.css
    toast.js
  package.json       # dependencia: electron
  .env               # credenciais (gitignored)
  .env.example       # template de credenciais
  install.bat        # instala deps + registra no Startup do Windows
  uninstall.bat       # remove do Startup
  launcher.vbs       # gerado pelo install.bat (gitignored)
```

## Instalação do zero (PC novo)

Esta pasta **não está no git** (`Notificador/` é gitignored de propósito, ver
`.gitignore` na raiz do repo) — não tem como clonar/`git pull` ela. Pra rodar
em outro computador, copie a pasta manualmente (pendrive, rede, WeTransfer,
o que for mais fácil).

### 1. Pré-requisito: Node.js

Instale o Node.js LTS (18 ou mais novo) em **https://nodejs.org** — baixe o
instalador Windows, execute, "Next" em tudo. Confirme no Prompt de Comando:

```bash
node --version
```

### 2. Copie a pasta

Copie a pasta `Notificador/` inteira pro PC novo (em qualquer lugar, ex:
`C:\Notificador\`). **Não precisa copiar `node_modules/`** — se copiar sem
querer, sem problema, mas ele é reconstruído no passo 4; copiar só deixa a
transferência mais pesada (o Electron sozinho tem ~200MB).

Arquivos que **precisam** ir: tudo exceto `node_modules/`, `.env` e
`launcher.vbs` (esses dois últimos são específicos de cada máquina — o
`.env` principalmente, tem senha).

### 3. Configure o `.env`

Copie `.env.example` para `.env` nesse PC novo e preencha:

```bash
copy .env.example .env
```

Edite o `.env` com um editor de texto (Bloco de Notas serve) e preencha
`NOTIFIER_EMAIL`/`NOTIFIER_PASSWORD` com uma conta `role=picker` válida —
ver [Configuracao (.env)](#configuracao-env) abaixo. **Nunca** copie o `.env` de
outra máquina por rede/nuvem sem necessidade — é a senha em texto puro.

### 4. Instale e registre no Windows

Dê duplo-clique em `install.bat`. Ele:
- roda `npm install` (baixa o Electron e as dependências — precisa de
  internet nesse passo, ~5min na primeira vez)
- cria `launcher.vbs` (roda o app sem janela de console)
- registra esse `.vbs` na pasta Startup do Windows (inicia sozinho no login)

### 5. Pronto

O app já inicia agora e vai iniciar sozinho em todo login do Windows. Ícone
novo deve aparecer na bandeja do sistema (perto do relógio, pode estar
escondido na seta "^" de ícones ocultos).

## Uso manual

```bash
npm start
```

## Desinstalar

Execute `uninstall.bat` ou delete `AntenorNotifier.vbs` da pasta Startup:
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`

## Dependencias

- **Node.js 18+**
- **Electron** — janela, bandeja e notificacoes nativas num so processo

## API

Autentica via `/auth/login` com credenciais do `.env`. Use uma conta
`role=picker` dedicada (menor privilegio — so precisa acessar
`/picker/orders`), nao a conta admin.

## Configuracao (.env)

| Variavel | Descricao | Exemplo |
|---|---|---|
| `NOTIFIER_API_URL` | URL da API | `https://api.antenorefilhos.com.br` (producao) |
| `NOTIFIER_EMAIL` | Email de login (conta picker) | `separador@antenorefilhos.com.br` |
| `NOTIFIER_PASSWORD` | Senha de login | (a mesma senha usada em todo o sistema) |
| `DORSAL_DB_HOST` | SQL Server da loja | `10.13.0.2` |
| `DORSAL_DB_PORT` | Porta | `1433` (padrao) |
| `DORSAL_DB_NAME` | Base | `DORSAL` |
| `DORSAL_DB_USER` | Usuario **somente leitura** | ver abaixo |
| `DORSAL_DB_PASSWORD` | Senha do usuario | (nunca em doc versionada) |

### Gatilho de faturamento do PDV

As quatro variaveis `DORSAL_*` ligam a segunda funcao deste app: **liberar o
pedido pro entregador depois que o PDV fecha a venda**. Sem elas o Notificador
continua funcionando normal, so avisando sobre separacao.

Por que aqui e nao na API: a VPS **nao tem rota** para `10.13.0.2`. E a rede,
nao escolha de arquitetura.

A cada minuto o agente pergunta a nossa API quem esta em `READY_FOR_CHECKOUT`,
consulta no `DORSAL` quais desses DAVs ja tem `hrRegistro` preenchido (o sinal
de venda fechada — 386/386 dos fechados tem, nenhum nao-fechado tem) e avisa a
API. Fila vazia nao abre conexao com o banco deles.

**Use um usuario SQL somente leitura**, nao o `dash`. Este agente so precisa de
`SELECT` em `tbPedido`, e roda num PC de loja — credencial com poder de escrita
ali e risco sem contrapartida. O codigo (`dorsal.js`) nunca escreve.


Sistema em producao na VPS (`https://api.antenorefilhos.com.br`) desde
17/08/2026 — ver [docs/infraestrutura.md](../docs/infraestrutura.md). Rodando
localmente contra o Docker de dev, use `http://localhost:3001`.
