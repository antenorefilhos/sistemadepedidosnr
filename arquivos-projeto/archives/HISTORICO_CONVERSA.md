# HISTORICO_CONVERSA.md - Linha de Evolucao Recente

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Periodo consolidado desde a ultima atualizacao historica

### Fase 18 - Restore PostgreSQL e integridade de build
- migrate deploy e sync validados em Docker
- build do admin estabilizado por correcoes de tipagem

### Fase 19 - RBAC, CI e operacao do admin
- roles reforcados nas rotas criticas
- workflow CI publicado
- listas, filtros, kanban e modais operacionais no admin

### Fase 20 - UX polish do admin
- dashboard estabilizado sem loop de analytics
- cards e charts ajustados para consistencia visual
- modais padronizados com blur
- sidebar refinada, sem borda branca indesejada
- menu Inteligencia IA movido para bloco Ferramentas, com linguagem visual coerente

### Diretriz futura adicionada por Jonathan
- desenvolver API propria de negocio como camada principal do sistema
- manter a Solidcom como integracao secundaria para envio minimo e controlado ao ERP

### Formalizacao posterior
- API propria registrada como Fase 21 formal do roadmap ativo

### Fase 25 - Classificacao mercadologica no admin
- investigacao completa de filtro por classificacao retornando zero na tela de produtos
- validacao em query Prisma com contagens positivas e identificacao de build antigo no runtime
- correcao de tipagem da query no backend e rebuild da API
- validacao funcional em cascata: classificacao01, classificacao02 e classificacao03

### Ajustes UX e operacionais no admin (continuidade da Fase 25)
- organizacao das labels de classificacao para remover numeracao duplicada
- trilha de classificacao formatada de modo consistente na tabela de produtos
- ajuste de paginação para permitir avanco de pagina sem reset para a primeira pagina

### Governanca documental em 4 passos (Jonathan)
- passo 1: leitura integral de docs e codigo real
- passo 2: diagnostico de discrepancias sem editar
- passo 3: atualizacao dos documentos canonicos apos autorizacao explicita
- passo 4: consolidacao final com versao 1.5.1-alpha

### Hotfix de conversao e navegacao no storefront
- remocao de bloqueio de login obrigatorio na Home e no Carrinho
- implementacao de checkout convidado com endpoint backend dedicado
- correcao de redirecionamento de link Entrar para `/login`
- adicao de retorno para loja nas telas Login e Register
- proxy de imagens em `/uploads/` no Nginx do storefront para evitar ORB/CORS
- fallback visual para imagem ausente com `placeholder-product.svg`

### Correcao de estabilidade de produtos
- erro 500 em `/products` por coluna `fractionStep` ausente no banco
- ajuste aplicado no banco e pendencia registrada para migration Prisma formal

### Atualizacao documental consolidada
- versao canonica promovida para 1.5.2-alpha
- sincronizacao de STATUS, referencia tecnica, configuracoes, memoria, erros, quickstart e comandos