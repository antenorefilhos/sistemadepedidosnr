# SOLIDCOM_API_DORSAL.md - Referencia Consolidada da Integracao ERP

Data: 1 de maio de 2026
Versao de referencia: 1.16.1-alpha
Base URL em uso no projeto: http://45.239.193.56:5000

## Premissas validadas

- API: Conexao Dorsal v1
- autenticacao: sem token/chave
- codEcom confirmado para nosso canal: 19
- campo numero do pedido deve ser unico; pode usar timestamp
- campo dav no PostPedido deve ser enviado como 0
- cliente e obrigatorio no pedido; pode usar cliente generico de balcao

## Endpoints prioritarios

### Produto
- GET /api/Produto/GetProdutosEAN?EAN={ean}
- GET /api/Produto/GetProdutos?ativo=true

### Pedido
- POST /api/Pedido/PostPedido
- GET /api/Pedido/{cdPedido}/CNPJ/{CNPJ}/Ecom/{cdEcom}/GetPedido
- GET /api/Pedido/CNPJ/{CNPJ}/Ecom/{cdEcom}/GetPedidoPeriodo
- PUT /api/Pedido/{cdPedido}/Ecom/{cdEcom}/PutCancelamentoPedido

### Cliente
- GET /api/Cliente/{cpf}/GetClientes
- POST /api/Cliente/PostCliente

## Regras de negocio confirmadas para pedidos

- taxa de entrega nao vai em itens; vai no campo valorFrete
- item fracionado usa quantidade em kg e valorUnitario por kg
- para etiqueta de balanca iniciando com 2, o codigo carrega produto e valor total
- enviar inCodigoInterno=true sempre que cdProduto estiver disponivel

## Etiqueta de balanca

Formato validado:
- posicoes 1-6: codigo interno do produto
- posicoes 7-11: valor total em centavos
- posicao 12: digito verificador

Exemplo:
- codigo 2000516024932
- produto 516
- valor total 24,93
- quantidade calculada = valor_total / vl_produto

## Payload minimo funcional para PostPedido

Campos essenciais:
- cnpj
- numero
- data
- codEcom=19
- dav=0
- valorFrete
- valorDesconto
- itens[]
- cliente

Campos recomendados:
- ecommerceSolidcon=true
- ecommerceSolidconStatus=1
- referencia="PDV-{numero}"

## Mapeamento para a Fase 21 (API propria)

- storefront/admin enviam pedido no contrato interno
- OrderOrchestrationService transforma para vmPedido da Solidcom
- adaptador SolidcomERPService envia apenas os campos necessarios
- erros de integracao devem ser rastreados com status interno e reprocessamento
- endpoint administrativo de reprocesso: POST /integrations/solidcom/orders/:orderId/retry

## Estado de implementacao atual

- envio de pedido para Solidcom via POST /api/Pedido/PostPedido no adaptador interno
- trilha de sucesso e falha gravada em audit_logs com entity=ORDER_SYNC_SOLIDCOM
- reprocesso manual por orderId usando payload persistido na ultima falha
- parser de etiqueta de balanca ativo na orquestracao para scannedCode de 13 digitos iniciando com 2
- listagem de falhas de sync via GET /integrations/solidcom/orders/failures
- consulta de falha por pedido via GET /integrations/solidcom/orders/:orderId/failure

## Riscos tecnicos e mitigacao

- sem ambiente de homologacao: proteger com feature flag e sandbox funcional interna
- sem autenticacao nativa: restringir trafego por rede e origem
- retorno com variacao de schema em endpoints volumosos: normalizar no adaptador interno
- consulta massiva de produtos pode causar timeout: manter sincronizacao server-side paginada por lotes

## Fontes utilizadas nesta consolidacao

- historico tecnico de conversas do projeto
- recorte tecnico DOCUMENTACAO_API com esclarecimentos do suporte Solidcom
- especificacao local [sistema/api/ConexaoDorsal.json](../../../sistema/api/ConexaoDorsal.json)
- status e roadmap: [STATUS.md](./STATUS.md) e [ROADMAP.md](./ROADMAP.md)
