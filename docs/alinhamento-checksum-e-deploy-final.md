# Alinhamento Final: Checksum PAF, Chaves Fora de Canal e Deploy Aprovado

> **Em resposta a:** `o-que-o-checksum-revela.md` (08/09/2026)  
> **Status:** Concordância total. Ajuste do `checksum` implementado no código, nova rotação aplicada sem exposição de chave, e sinal verde para subida do Cloudflare Tunnel.

---

## 1 · Política Definitiva de Chaves: Canal Zero

Reconhecemos e acolhemos integralmente o puxão de orelha sobre a chave ter aparecido no bloco de exemplo do documento anterior. Vocês estão cobertos de razão: **se a credencial viaja em documento, a rotação já nasce comprometida.**

Adotamos a **validação cega por comportamento**:

1. **Chave rotacionada no `.env` do servidor:** Geramos uma nova credencial criptográfica forte para a Loja 1 e a gravamos diretamente no `.env` do servidor (arquivo gitignored, inacessível via web e fora do controle de versão).
2. **Nenhuma chave em documentos:** A partir de agora, nenhum arquivo `.md`, `.html`, log ou commit receberá caracteres da chave. Todos os exemplos usam estritamente o placeholder `<chave_injetada_direto_no_env_da_vps>`.
3. **Na VPS Hostinger:** A equipe de infraestrutura/deploy insere a variável no `.env` da VPS. Se bater, a API autentica (`200 OK`); se divergir, retorna `401 Unauthorized`. Nós não precisamos vê-la trafegar.

---

## 2 · Checksum PAF: O Carimbo de Origem Revelado

A leitura que vocês fizeram da trigger `tgAlteraLinhaPedidoItem` e a correlação com os 70 itens do e-commerce foi cirúrgica e esclareceu perfeitamente o cenário:

```sql
if @PROGRAMA <> '.NET'
   update tbPedidoItem set checksum = @CheckSum ...
```

### O que isso comprova
1. **Comportamento Idêntico (Zero Regressão):** Os pedidos enviados pelo e-commerce através da API legada do Solidcon já recebiam `-2` porque a própria API deles não se conecta como `.NET`. A `AntenorApi` comporta-se exatamente igual à API original homologada.
2. **Ajuste Efetuado no Código:** Removemos a coluna `checksum` do comando `INSERT INTO tbPedidoItem` em `src/services/integracao.service.ts`. Não forçamos nem presumimos valor: deixamos a trigger do banco cumprir seu papel nativo e carimbar a integridade.
3. **Integridade da Auditoria Fiscal:** Concordamos plenamente em **não mascarar** a conexão fingindo ser `.NET` no `Application Name`. Burlar o carimbo de auditoria de um sistema regido por normas de PAF-ECF traria risco desnecessário em uma eventual auditoria contábil/fiscal. A transparência técnica é a melhor proteção jurídica.
4. **Alinhamento com a Solidcon:** O questionamento sugerido por vocês já foi registrado para consulta formal junto ao suporte técnico do ERP Solidcon para manter o histórico de governança respaldado.

---

## 3 · Validação de Build e Compilação

Após a remoção do campo `checksum` do serviço de integração, a suíte de compilação foi executada:

* **TypeScript:** `npm run build` executado com sucesso (código de saída `0`).
* **Artefatos:** Diretório `dist/` gerado e validado.
* **Versão:** `AntenorApi v1.5.0` pronta para execução em produção via Node.js na porta 3000.

---

## 4 · Checklist Consolidado para Ativação

| Item | Descrição | Status |
| :---: | :--- | :---: |
| ✅ | Chaves expostas invalidadas e tratadas como queimadas | **Concluído** |
| ✅ | Chave Master retida internamente (VPS recebe apenas Loja 1) | **Concluído** |
| ✅ | Chave definitiva gerada e isolada fora do fluxo documental | **Concluído** |
| ✅ | Efeitos colaterais e tabelas de impressão auditadas (todas zeradas) | **Concluído** |
| ✅ | Checksum removido do `INSERT` (delegado integralmente à trigger PAF) | **Concluído** |
| ✅ | Período de convivência de 1 semana do agente local homologado | **Concluído** |
| ⏳ | Iniciar túnel `cloudflared` com os 2 hostnames (`api.` e legado) | **Pronto para disparo** |
| ⏳ | Fechar o port forwarding da porta 5000 no roteador de fibra | **Pronto para disparo** |

Estamos 100% alinhados tecnicamente. O terreno está limpo e seguro para ligar o túnel e efetuar o corte.
