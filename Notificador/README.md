# Notificador de Pedidos — Windows

Aplicacao que roda em segundo plano no Windows e exibe notificacoes toast
na tela sempre que existirem pedidos novos ou pendentes de separacao.

## Comportamento

- Polling a cada **2 minutos** na API do backend
- **"Novo Pedido"** — pedidos com status `PENDING` ou `CONFIRMED`
- **"Pedido Pendente"** — pedidos com status `PICKING_PENDING`
- Continua notificando ate que a separacao seja iniciada (status muda para `PICKING`)
- Roda sem janela de console (VBS launcher)
- Inicia automaticamente com o Windows (pasta Startup)

## Estrutura

```
Notificador/
  notifier.js       # script principal (polling + toast)
  package.json      # dependencias (node-notifier)
  .env              # credenciais (gitignored)
  .env.example      # template de credenciais
  install.bat       # instala deps + registra no Startup do Windows
  uninstall.bat     # remove do Startup
  launcher.vbs      # gerado pelo install.bat (gitignored)
```

## Instalacao

1. Copie `.env.example` para `.env` e preencha as credenciais
2. Execute `install.bat` (duplo-clique)
3. Pronto — ja comeca a notificar

## Uso manual

```bash
npm start
```

## Desinstalar

Execute `uninstall.bat` ou delete `AntenorNotifier.vbs` da pasta Startup:
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`

## Dependencias

- **Node.js 18+** (usa `fetch` nativo)
- **node-notifier** — toast notifications Windows

## API

Autentica via `/auth/login` com credenciais do `.env` (admin ou picker).
Consulta `/picker/orders` e filtra por status.

## Configuracao (.env)

| Variavel | Descricao | Exemplo |
|---|---|---|
| `NOTIFIER_API_URL` | URL da API backend | `http://localhost:3005` |
| `NOTIFIER_EMAIL` | Email de login | `admin@antenor.com.br` |
| `NOTIFIER_PASSWORD` | Senha de login | (definida no .env do backend) |

> Em producao, aponte `NOTIFIER_API_URL` para o host do Docker/servidor (ex: `http://localhost:3001`).
