# CATALOGO_ERROS.md - Problemas Conhecidos e Solucoes

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Erros resolvidos recentes

### Build quebrado no admin por tipagem
- causa: erros TypeScript em BICharts e Intelligence
- solucao: saneamento de tipos, tooltips e contratos do admin
- status: resolvido

### Restore PostgreSQL falhando em Docker
- causa: BOM UTF-8 em migration inicial e ajustes de runtime ESM
- solucao: limpeza da migration, generate do Prisma e execucao operacional com script JS do sync
- status: resolvido

### Documentacao apontando SQLite como estado atual
- causa: configuracao legada nao removida da documentacao canonica
- solucao: consolidacao total em PostgreSQL e compose local
- status: resolvido

### Dashboard admin em loop de analytics e 429
- causa: callback instavel disparando refetch continuo
- solucao: callback memoizado e composicao visual estabilizada
- status: resolvido

### Filtro por classificacao no admin retornando zero
- causa: build do backend desatualizado por erro de tipagem em mode na query Prisma
- solucao: tipagem explicita com QueryMode e rebuild da API
- status: resolvido

### Labels de classificacao com numero duplicado
- causa: formatacao somava indice visual com prefixo numerico ja presente no dado
- solucao: normalizacao de label para formato unico (NN - DESCRICAO)
- status: resolvido

### Paginacao de produtos nao avancava no botao Proxima
- causa: callback de carga dependia de estado de pagina e forcava reset para pagina 1
- solucao: callback estabilizado com parametro padrao fixo e dependencias ajustadas
- status: resolvido

### Home travada em loading infinito
- causa: erro 500 em `/products` por coluna `products.fractionStep` ausente no banco
- solucao: ajuste da tabela e restauracao da consulta de produtos
- status: resolvido

### Imagens quebradas com ERR_BLOCKED_BY_ORB
- causa: frontend apontando imagem para origem diferente (`http://localhost:3001/uploads/...`)
- solucao: proxy Nginx do storefront em `/uploads/` e uso de URL relativa no frontend
- status: resolvido

### Imagens 404 no catalogo
- causa: itens sem arquivo fisico correspondente em `uploads/products`
- solucao: fallback no Nginx para `placeholder-product.svg`
- status: resolvido

### Checkout com erro de tipagem TS2322
- causa: `customerId` podia ser `undefined` no fluxo de convidado
- solucao: guarda explicita de nulidade antes de enviar pedido
- status: resolvido

## Problemas conhecidos ainda abertos

### Cobertura de imagens ainda incompleta para parte do catalogo
- observacao: cobertura por lote melhora baseline, mas ainda existem itens sem match ideal
- impacto: medio

### Acoplamento futuro com Solidcom
- observacao: integracao atual depende da API externa em pontos relevantes
- acao futura: criar API propria de orquestracao do dominio e deixar Solidcom em segundo plano

### Coluna fractionStep sem migration formal
- observacao: correcao aplicada diretamente no banco resolve runtime atual, mas nao garante ambiente novo
- impacto: alto em setup limpo
- acao futura: criar migration Prisma para `products.fractionStep`
