# APRENDIZADOS.md - Consolidado

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Padroes que funcionam

- NestJS por modulo com DTOs, guards e services bem separados
- Prisma com PostgreSQL como fonte unica de verdade de dados
- React Query para leitura e mutacao em storefront e admin
- Docker Compose como ambiente local principal e validacao operacional
- ApexCharts no admin para BI rapido e visualmente consistente
- padronizacao de modais e sidebar no admin reduz regressao visual
- guard dedicado (WebhookGuard) para endpoints que nao usam JWT, como webhooks de gateway
- AuditLog como mecanismo de idempotencia para eventos externos (mais simples que tabela dedicada)
- testes unitarios com Jest para services criticos do backend validam comportamento isolado sem Docker
- auditoria de i18n deve ser feita com validacao visual no browser, nao apenas em codigo
- filtros mercadologicos do admin devem usar normalizacao unica de label para evitar duplicidade numerica
- callback de carga paginada deve evitar dependencia ciclica de estado para nao resetar pagina
- troco no checkout deve ser guiado por opcoes validas (cédulas >= 20) para evitar entrada livre e reduzir erro operacional

## O que evitar

- usar documentos historicos como documentacao canonica
- reintroduzir SQLite em docs, exemplos ou runbooks do estado atual
- misturar roadmap futuro com status implementado
- depender do contrato da Solidcom como contrato principal do sistema
- usar foco visual com ring branco no menu premium do admin
- usar string_contains no Prisma PostgreSQL (e MongoDB); o correto e contains
- adicionar status novos no dominio sem atualizar todos os mapas (labels, cores, filtros)
- considerar deploy de ajuste sem rebuild da API apos mudanca de tipagem de query
- tratar `package.json` como fonte de verdade da versao do produto (a versao canonica e definida pelo changelog e docs canônicos)
- reintroduzir gateway/webhook como fluxo obrigatorio de negocio quando o requisito do produto e pagamento por fora (manter desativado por default)
- tratar o valor do checkout como valor definitivo quando o processo operacional admite corte, peso real e substituicao de item

## Descobertas

- callback instavel no dashboard causava loop de analytics e 429
- a maior parte das inconsistencias documentais veio da transicao SQLite para PostgreSQL
- o admin cresceu para alem de um unico Dashboard.tsx e ja demanda documentacao por superficies reais
- REQUISITOS e HISTORICO_CONVERSA ainda eram documentos necessarios, mas estavam somente em archives
- strings sem acento em portugues passam por build e TypeScript sem erro; so sao detectadas com teste visual
- prisma.auditLog.findFirst com changes: { contains: chargeId } usa LIKE internamente no PostgreSQL
- um erro de tipagem em modo case-insensitive pode impedir build e manter runtime antigo sem o comportamento esperado
- diagnostico de filtro deve comparar API HTTP com consulta Prisma direta para separar erro de dados vs erro de runtime

## Otimizacoes

- validar build e Docker antes de concluir ajuste visual evita falsos positivos
- manter a Solidcom como integracao secundaria abre caminho para API propria mais estavel
- concentrar documentos canonicos em md e snapshots em archives reduz ambiguidade
- RawBodyMiddleware deve ser registrado antes do json middleware global para que o body raw do webhook seja preservado
- atualizacao documental em passos (ler, diagnosticar, editar, consolidar) reduz risco de divergencia com o codigo real
- controlar composicao de vitrines via CMS (campos priority e limit no modelo Category) desacopla estrategia comercial de codigo
- publicar porta do PostgreSQL no compose local evita dependencia de exec de container para rodar migrations Prisma
- limpar pastas de agentes externos da raiz do repositorio elimina ruido e torna a estrutura legivel
- concatenar dados em notes antes de salvar no banco causa duplicacao quando o mesmo dado e enviado separadamente para outro servico
- testes E2E Cypress devem refletir o estado atual da aplicacao (ex: home publica vs redirecionamento para login)
- smoke tests desatualizados podem quebrar mesmo quando a aplicacao esta funcionando corretamente
- o proxy do browser preview pode falhar com conexao frontend->backend no Docker; acesso direto via localhost:3000 funciona corretamente
- `order.items.length` conta tipos de produto, não quantidade total — usar `reduce` para somar quantidades
- máscara de input deve ser aplicada no `onChange`, não apenas no `onBlur`, para feedback imediato ao usuário
- estado local de hook (`useState` + `localStorage`) em múltiplos componentes causa desincronização — usar React Context
- nomes de campos em português (logradouro/bairro) vs inglês (street/neighborhood) causam falha silenciosa de integração
- `onBlur` com `e.target.value` pode estar desincronizado do estado React — usar valor do state (`formData.campo`)
- `fractionStep` deve ser considerado em TODOS os cálculos de preço de produtos fracionados (carrinho, checkout, WhatsApp)
- validação de frete grátis pode bloquear fluxo de teste — manter desativada em dev e teste
- teclado numérico mobile requer `inputMode="numeric"` + `pattern` no input text
- opções de troco devem variar: até R$200 (incrementos de 20), acima de R$200 (incrementos de 50)
- UI de botões precisa de hierarquia visual clara: primário (bordô), secundário (dourado), terciário (texto/link)
- quando o pagamento e por fora, a UI deve explicar que o valor final sera confirmado pela equipe apos a separacao