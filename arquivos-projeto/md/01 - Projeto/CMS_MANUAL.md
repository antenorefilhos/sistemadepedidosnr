# CMS_MANUAL.md - Manual de Uso do CMS

Data: 6 de junho de 2026
Versao de referencia: 1.24.122-alpha

## Layout do site

No admin, use a secao de layout para manter hero slides e banners de categoria.

## Banners da Loja (novo editor)

No admin, use a secao `Banners da Loja` para controlar banners gerais com preview e painel de configuracao.

Fluxo:

- clique em `Novo banner`
- preencha `Nome do banner` (ALT/SEO)
- escolha `Tipo`: `full`, `tarja`, `vitrine`, `mini` ou `lateral`
- selecione `Pagina de publicacao`: `home`, `all`, `category` ou `product`
- configure link opcional e destino (`mesma janela` ou `nova janela`)
- envie `Imagem desktop` (obrigatoria)
- envie `Imagem mobile` (opcional; usada em telas abaixo de 767px)
- opcional: configure janela de agendamento (`inicio` e `fim`)
- salve

Operacao:

- reordene com setas `cima/baixo`
- ative/desative com icone de visibilidade
- edite e remova sem sair da tela

Regras:

- sem imagem mobile, a loja usa imagem desktop redimensionada
- agendamento exige fim maior que inicio
- pode haver pequeno delay por cache entre alteracao e exibicao

Diretriz visual vigente:

- priorizar leitura, contraste e consistencia operacional
- evitar efeitos de blur/transparencia como linguagem principal
- manter raios moderados e padronizados entre blocos

### Vitrines da Home (ordem e composicao)

A composicao das vitrines agora e feita pelo cadastro de categorias do CMS com tres campos de negocio:

- `active`: liga/desliga a secao na Home
- `priority`: define a ordem de exibicao (menor valor sobe)
- `limit`: define quantos produtos aparecem na vitrine
- `curatedProductIds`: lista opcional de IDs para curadoria manual da secao

Regra hibrida da vitrine:

- se houver `curatedProductIds`, a Home exibe esses produtos primeiro
- se a quantidade curada for menor que o `limit`, a Home completa automaticamente por taxonomia comercial
- sem `curatedProductIds`, a secao segue 100% automatica

Fluxo recomendado:

- abra Layout do Site no Admin
- localize a categoria comercial (ex.: CARNES_DIA_A_DIA)
- ajuste `priority` conforme estrategia da semana
- ajuste `limit` (faixa sugerida: 6 a 8)
- opcional: preencha `curatedProductIds` (separados por virgula, espaco ou quebra de linha)
- salve e recarregue a Home para validacao visual

Exemplo de configuracao comercial:

- CARNES_DIA_A_DIA: priority 0, limit 8
- CHURRASCO: priority 1, limit 8
- BEBIDAS: priority 2, limit 6
- PADARIA: priority 3, limit 6

### Hero slides
- clique em Novo Slide
- informe titulo, tag, link e imagem
- use o toggle de ativo para controlar exibicao sem apagar o item

### Banners promocionais com produto exaltado

- em cada banner promocional, use a busca assistida para localizar o produto exaltado
- opcionalmente preencha `Nota do destaque` para contextualizar o produto
- quando o ID existir e for valido, a Home exibe o produto exaltado dentro do banner
- mantenha badge/subtitulo e nota alinhados com a campanha da semana

### Banners de categoria
- localize a categoria desejada
- envie a imagem pelo fluxo de upload
- o sistema aplica o tratamento visual necessario para leitura do texto

## Uploads

- os arquivos ficam em sistema/backend/uploads
- o backend serve os arquivos estaticos dessa pasta
- nomes sao gerados automaticamente para evitar colisao

## Imagens de produto no storefront

- o storefront busca imagens em `/uploads/products/{ean}.webp`
- quando nao houver arquivo para o EAN, o card mostra fallback visual

## Solidcom e taxonomia do CMS

O Solidcom alimenta o catalogo operacional, mas nao e a fonte final da navegacao comercial do ecommerce. A regra vigente e:

- Solidcom fornece produto, EAN, preco, estoque, status, regra de sincronizacao e classificacoes mercadologicas `classification01..04`
- o CMS organiza a navegacao em categorias N1/N2
- o vinculo principal entre produto e categoria do ecommerce e o EAN em `product_category_mappings`
- o handoff `arquivos-projeto/handoff_ecommerce_v3_n1_n2.csv` e a fonte preferencial para mapear EAN -> N1/N2
- `classification01..04` serve como apoio operacional e fallback controlado, nao como verdade final quando existir mapeamento por EAN

### Ordem de precedencia

1. Mapeamento por EAN confirmado em `product_category_mappings`.
2. Fila de revisao em `category_mapping_pending`, quando o produto chegou sem mapeamento confiavel ou com politica de publicacao restritiva.
3. Classificacao mercadologica da Solidcom (`classification01..04`) apenas para sugestao, filtro auxiliar ou fallback de exibicao.
4. Categoria generica (`GERAL` ou `NAO_CLASSIFICADO`) somente quando nao houver evidência suficiente.

### Como operar uma sincronizacao

1. Sincronize/importe os produtos da Solidcom, preservando EAN e `classification01..04`.
2. Rode o handoff primeiro em modo seco:

```powershell
cd sistema/backend
node scripts/handoff-apply.js "../../arquivos-projeto/handoff_ecommerce_v3_n1_n2.csv"
```

3. Revise o resumo gerado: linhas mapeadas, pendentes e produtos nao encontrados.
4. Aplique somente depois de revisar o dry-run:

```powershell
node scripts/handoff-apply.js "../../arquivos-projeto/handoff_ecommerce_v3_n1_n2.csv" --apply
```

5. No Admin, abra `Categorias` > `Mapeamento EAN` para revisar os itens PENDING.
6. Aprove apenas quando a sugestao N1/N2 fizer sentido para a vitrine; rejeite quando a politica indicar nao publicar, produto interno/inativo ou classificacao ambigua.
7. Recarregue `/mercado` e a Home para conferir se os filtros e vitrines seguem a arvore esperada.

### Campos que a operacao deve respeitar

- `codigo_ean` / `ean`: chave de identidade do produto e do mapeamento.
- `classificacao01..04`: arvore mercadologica vinda da Solidcom.
- `categoria_ecommerce_n1`: categoria principal do CMS.
- `categoria_ecommerce_n2`: subcategoria do CMS.
- `sugestao_publicacao`: politica de publicacao do handoff.
- `tipoIntegracao` / `internet`: define `syncOption` (`ESTOQUE`, `SEMPRE` ou `NUNCA`).

### Guardrails

- nao criar categoria final por "achismo" quando o EAN existir no handoff
- nao publicar automaticamente itens marcados como `REVISAR_NUNCA`, `NAO_PUBLICAR_INATIVO` ou `NAO_PUBLICAR_INTERNO`
- nao usar `classification01..04` para sobrescrever mapeamento EAN aprovado
- nao remover categoria com produto, curadoria, pendencia, regra ou mapeamento vinculado
- depois de mudar taxonomia, validar a arvore no Admin e no storefront

### Onde cada coisa aparece

- Admin `Categorias`: arvore N1/N2, ordenacao, ativacao e edicao.
- Admin `Categorias` > `Mapeamento EAN`: revisão de pendências e ajustes produto a produto.
- Storefront `/mercado`: filtros por arvore e listagem de produtos mapeados.
- Home: vitrines comerciais com prioridade, limite e curadoria manual por categoria.
- Backend: endpoints de categorias e mapeamentos descritos em [REFERENCIA_TECNICA.md](../02%20-%20Contexto/REFERENCIA_TECNICA.md).

## Fotos de produto

A frente operacional de importacao/auditoria de fotos foi pausada em 06/06/2026 e os scripts temporarios foram removidos. As imagens ja existentes continuam sendo servidas por `/uploads/products/{ean}.webp`; quando essa frente voltar, a solucao deve ser redesenhada de forma integrada a fornecedor/ERP/CMS.

## Observacoes

- a area de layout pertence ao admin atual e conversa com o backend CMS/uploads
- a documentacao tecnica detalhada de rotas fica em [REFERENCIA_TECNICA.md](../02%20-%20Contexto/REFERENCIA_TECNICA.md)

## Fila de pendencias de categorias

- use a aba `Mapeamento EAN` em `Categorias` para revisar pendencias PENDING geradas pelo handoff e pela auto-classificacao
- cada item mostra `reason` e `notes` para auditoria rapida da politica aplicada na origem
- use `Aprovar` quando a sugestao N1/N2 estiver correta; use `Rejeitar` quando o item nao deve virar mapeamento
- a etapa `Revisão final` agora usa aprendizado do handoff e do catálogo real; confie nas sugestões somente quando a confiança exibida for alta e a categoria fizer sentido com o produto

## Ordenacao de categorias no Admin

- na tela `Categorias`, a coluna de ordem agora funciona por arrastar e soltar
- clique e arraste a linha da categoria para cima/baixo para definir a nova ordem
- a reordenacao ocorre apenas entre categorias irmas (mesmo nivel da arvore)
- ao soltar, a prioridade e salva automaticamente
