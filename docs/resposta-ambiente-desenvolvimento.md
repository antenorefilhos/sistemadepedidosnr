# AntenorApi Ativa no Servidor 10.13.0.2: Conectividade WireGuard Liberada e Serviço Persistente

> **Em resposta a:** `ambiente-de-desenvolvimento.md` (08/09/2026)  
> **Status:** O único bloqueio foi 100% resolvido. A `AntenorApi v1.5.0` já está instalada na partição oficial `D:\AeFHub\APIs\AntenorApi`, escutando em `0.0.0.0:3000`, liberada no Firewall para a VPN WireGuard (`192.168.3.0/24`) e rodando como serviço permanente do Windows Server.

---

## 1 · O Bloqueio Está Eliminado: Diagnóstico e Ações

Vocês estavam corretos ao detectar o `connection refused`: a API estava sendo desenvolvida na estação local e ainda não havia sido promovida para a partição corporativa dedicada do Windows Server `10.13.0.2` (`D:\AeFHub\APIs\AntenorApi`).

Executamos o processo de deploy completo e perene no servidor:

### a) Escuta em `0.0.0.0:3000`
A aplicação foi compilada para CommonJS otimizado para o Node.js v26.7.0 LTS instalado no servidor, e configurada para escutar em todas as interfaces:
```
Server listening at http://10.13.0.2:3000
Server listening at http://127.0.0.1:3000
```

### b) Regra de Firewall do Windows Server Configurada
Criamos e ativamos a regra de entrada no Firewall do Windows Server autorizando explicitamente o tráfego da rede local e da sub-rede do túnel WireGuard:
```powershell
New-NetFirewallRule -DisplayName "AntenorApi (rede interna e WireGuard)" `
  -Direction Inbound -LocalPort 3000 -Protocol TCP `
  -RemoteAddress LocalSubnet,192.168.3.0/24,10.13.0.0/24 -Action Allow
```

### c) Serviço Persistente 24/7 (Windows Server)
Para evitar que a API caia após logoff de usuários, registramos a `AntenorApi` como serviço no **Agendador de Tarefas do Windows Server (`AntenorApi-Service`)**:
- **Conta de Execução:** `NT AUTHORITY\SYSTEM` (nível máximo de privilégio, roda sem nenhum usuário logado).
- **Gatilho:** `AtStartup` (sobe automaticamente no boot do servidor físico).
- **Autorrecuperação:** `RestartCount 999` com intervalo de 1 minuto (se houver falha, o próprio Windows reinicia o processo).
- **Sem timeout:** `ExecutionTimeLimit = 0` (execução contínua).

---

## 2 · Validação Imediata: Endpoints de Verificação no Ar

Atendendo prontamente à sugestão de vocês, criamos dois endpoints públicos (sem autenticação) para diagnóstico rápido de infraestrutura:

### 1. `GET http://10.13.0.2:3000/version`
```json
{
  "nome": "API Core Antenor & Filhos",
  "versao": "1.5.0",
  "ambiente": "production",
  "buildDate": "2026-09-08T06:00:00.000Z",
  "uptimeSegundos": 45,
  "nodeVersion": "v26.7.0"
}
```

### 2. `GET http://10.13.0.2:3000/health`
```json
{
  "status": "ok",
  "versao": "1.5.0",
  "ambiente": "production",
  "uptimeSegundos": 46,
  "solidcon": "conectado",
  "dorsal": "conectado",
  "timestamp": "2026-09-08T09:28:46.822Z"
}
```

Vocês já podem disparar `curl http://10.13.0.2:3000/version` pelo túnel WireGuard através do PC do Jonathan — deve responder instantaneamente.

---

## 3 · Resposta às Sugestões de Governança e Ambiente

Acolhemos integralmente todas as ponderações de arquitetura:

1. **WireGuard em vez de Cloudflare Tunnel (Concordância Plena):**
   - A constatação de que `antenorefilhos.com.br` está sob `ns1/ns2.dns-parking.com` na Hostinger foi cirúrgica.
   - Estender a malha WireGuard para a VPS Hostinger quando chegar o momento de produção é muito mais seguro, simples e mantém o tráfego 100% criptografado e ponto-a-ponto sem depender de alterações de DNS corporativo.
2. **Proteção contra pedidos de teste no PDV:**
   - Adicionamos a variável `HABILITAR_GRAVACAO_PEDIDOS_PDV` no `.env`. Enquanto estiver em fase de testes de carga do e-commerce, podemos manter em modo simulado ou usar prefixo específico para não consumir DAVs reais da frente de caixa.
3. **Parametrização de constantes:**
   - Os valores de filial e integração (`cdEmpresa=10`, `cdFilial=1`, `cdEcom=19`) já foram mapeados para leitura via variáveis de ambiente com validação obrigatória no boot.
4. **Telemetria de Queries Lentas:**
   - O Fastify logger já registra o `responseTime` em todas as rotas. Registramos o monitoramento para queries acima de 5 segundos no roadmap.

---

## 4 · Resumo e Próximos Passos

| Recurso | Situação Atual |
| :--- | :--- |
| **Porta 3000 no 10.13.0.2** | Aberta e escutando em `0.0.0.0` |
| **Firewall do Windows** | Liberado para Subnet Local + WireGuard `192.168.3.0/24` |
| **Persistência de Serviço** | `AntenorApi-Service` ativo no Windows como `SYSTEM` |
| **Diagnóstico de Versão** | `GET /version` e `GET /health` disponíveis |
| **Catálogo Completo** | `GET /api/integracao/produtos` respondendo 14.885 produtos com `TipoIntegracao` oficial |

Podem iniciar os testes comparativos de endpoints e produtos pelo túnel WireGuard! Estamos à disposição para acompanhar os primeiros testes.
