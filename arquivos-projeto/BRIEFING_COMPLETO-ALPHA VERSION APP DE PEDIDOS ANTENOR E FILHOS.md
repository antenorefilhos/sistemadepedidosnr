# BRIEFING COMPLETO DO PROJETO — MercaZap / Antenor & Filhos

> **Tipo:** Documento de transferência de contexto
> **Destinatário:** Qualquer IA ou desenvolvedor que herde este projeto
> **Data:** Março 2026
> **Versão em inglês:** `COMPLETE_BRIEFING.md`

---

> ## O que é este documento
>
> Este documento recorta **tudo** que o cliente pediu, explicou e decidiu
> ao longo das sessões de planejamento. Está escrito como um briefing direto,
> como se você nunca tivesse visto este projeto antes.
> Leia do início ao fim antes de qualquer ação.

---

## 1. Quem é o cliente

O cliente é o proprietário do **Mercado Antenor & Filhos**, localizado em
**Pedro do Rio, Rio de Janeiro**. O mercado existe há **47 anos** e é um negócio
familiar com forte presença local. Eles operam:

- Mercado (mercearia completa)
- Açougue (especialidade principal — carnes frescas selecionadas)
- Padaria
- Tabacaria
- Adega (vinhos)

O relacionamento com os clientes é feito principalmente pelo **WhatsApp**.
O público é majoritariamente composto por **pessoas mais velhas ou com baixa
familiaridade tecnológica** — isso impacta diretamente todas as decisões de UX.

**Contatos:**
- WhatsApp: (24) 99218-6056
- Instagram: @antenorefilhos.pedrodorio
- Domínio: antenorefilhos.com.br (Hostinger Business)

---

## 2. O que o cliente pediu — visão geral

O cliente quer um **sistema de e-commerce próprio** para o mercado. Não quer
depender de plataformas prontas como MercaFácil (que os concorrentes usam).
Quer controle total da operação digital sem precisar abrir o ERP todos os dias.

O sistema se chama **MercaZap** (nome da plataforma). A marca exibida ao cliente
final é **Antenor & Filhos**. Essa distinção é importante — o cliente fez questão
de separar o nome técnico da plataforma do nome comercial da empresa.

---

## 3. O ERP atual — Solidcon

O mercado usa o **ERP/CRM da empresa Solidcon**. O cliente mostrou a tela do
sistema durante o planejamento. A Solidcon disponibiliza uma **API REST** para
integração com e-commerce, documentada em OpenAPI 3.0.1.

### 3.1 O que a API Solidcon permite fazer

O cliente colou a especificação OpenAPI completa. Os endpoints disponíveis são:

**Produtos:**
- `GET /api/Produto/GetProdutos` — retorna todos os produtos cadastrados
- `GET /api/Produto/GetProdutosAlterados?data={datetime}` — retorna apenas produtos alterados a partir de uma data
- `GET /api/Produto/GetProdutosCadastro?data={datetime}` — produtos cadastrados a partir de uma data
- `GET /api/Produto/GetProdutosEAN?EAN={ean}` — busca produto por código EAN
- `GET /api/Produto/GetProdutosComMenorEAN` — produtos com menor EAN

**Pedidos:**
- `POST /api/Pedido/PostPedido` — envia um pedido para o ERP
- `POST /api/Pedido/PostPedidoInterno` — envia pedido interno (usa código interno em vez de EAN)
- `GET /api/Pedido/{cdPedido}/CNPJ/{CNPJ}/Ecom/{cdEcom}/GetPedido` — consulta pedido específico
- `GET /api/Pedido/CNPJ/{CNPJ}/Ecom/{cdEcom}/GetPedidoPeriodo` — pedidos por período
- `GET /api/Pedido/GetModeloPagamento` — modelos de pagamento disponíveis
- `PUT /api/Pedido/{cdPedido}/Ecom/{cdEcom}/PutCancelamentoPedido` — cancela pedido

**Clientes:**
- `POST /api/Cliente/PostCliente` — cadastra ou atualiza cliente
- `GET /api/Cliente/GetClientes` — lista todos os clientes
- `GET /api/Cliente/{CPF}/GetClientes` — busca cliente por CPF

**Vendas:**
- `GET /api/Vendas/CNPJ/{cnpj}/INICIO/{inicio}/FIM/{fim}/GetVendasResumo` — resumo de vendas por período
- `GET /api/Vendas/.../GetVendasResumoChave` — resumo por chave NFC-e

**Teste:**
- `GET /api/Teste` — endpoint de health check da API

### 3.2 Estruturas de dados da API Solidcon

O cliente forneceu o schema completo. Os modelos principais são:

**`vmCliente`** (cadastro de cliente):
```
cpf (int64, obrigatório)
nome (string, max 150)
telefone (string, max 12)
endereco (vmEndereco)
cdCNP_ (string)
dtNascimento (datetime)
dtCadastro (datetime)
sexo (string)
nrDependentes (int)
email (string)
celular (string)
```

**`vmEndereco`**:
```
logradouro (string, max 100)
numero (string, max 30)
complemento (string, max 60)
bairro (string, max 25)
cidade (string, max 25)
cdMunicipio (int)
cep (string, max 8)
estado (string, max 2)
```

**`vmPedido`** (campos obrigatórios: cliente, cnpj, codEcom, data, itens, numero):
```
cnpj (int64)
numero (int64)
data (datetime)
valorDesconto (double, opcional)
obs (string, max 500)
ecommerceSolidcon (boolean)
ecommerceSolidconStatus (StatusPedido enum)
cdEcomPedido (int64)
codEcom (Ecommerce enum — valores 1 a 14)
valorFrete (double)
aceitaTroca (int)
hrCombinada (datetime)
hrEntrega (datetime)
cancelado (boolean)
retiraNaLoja (boolean)
dav (int64)
hrRegistro (datetime)
pdv (int)
cupom (int)
valorRegistrado (double)
cep (string, max 8)
cdTransportadora (int)
itens (array de vmPedidoItem)
pagamentoPIX (boolean)
inEntregaExpressa (boolean)
prDesconto (double)
prDescontoPagamento (double)
itensSubstituto (array de vmPedidoItemSubstituto)
cliente (vmCliente)
pagamento (vmPagamento)
```

**`vmPedidoItem`**:
```
numero (int)
ean (int64)
quantidade (double)
quantidadeAtendida (double)
valorUnitario (double)
valorDesconto (double, opcional)
obs (string, max 100)
```

**`vmPedidoItemInterno`** (usa código interno em vez de EAN):
```
numero (int)
codigoInterno (int, obrigatório)
quantidade (double)
quantidadeAtendida (double)
valorUnitario (double)
valorDesconto (double, opcional)
obs (string, max 100)
```

**`vmPagamento`**:
```
formaPagamento (string)
tef (vmPagamentoTEF)
```

**`StatusPedido`** (enum): valores 1, 2, 3, 4, 5, 6, 7, 8, 99

**`Ecommerce`** (enum): valores 1 a 14

### 3.3 O campo `internet` da Solidcon — ponto crucial

O cliente mostrou print da tela do ERP Solidcon, na tela de cadastro de produto.
Existe um campo chamado **"Internet"** com três opções:

- **ESTOQUE** — produto aparece no site somente se tiver quantidade em estoque > 0
- **SEMPRE** — produto sempre aparece, independente do estoque
- **NUNCA** — produto nunca aparece no site

O cliente explicou que quer usar esse recurso no MercaZap também. A regra do
campo `internet` da Solidcon deve ser espelhada no sistema, **mas o gestor
deve poder sobrescrever essa regra por produto no Admin do MercaZap** — sem
precisar alterar o ERP.

Motivo do override: o estoque da Solidcon pode ser impreciso (sistema marca
como zerado mas ainda tem produto, ou vice-versa). O override garante controle
manual quando necessário.

### 3.4 Perguntas enviadas à Solidcon (aguardando resposta)

O cliente enviou e-mail para a Solidcon com as seguintes perguntas:
- URL base da API
- Método de autenticação (Bearer Token, API Key, Basic Auth?)
- `cdEcom` atribuído ao Antenor & Filhos
- Valor correto do enum `Ecommerce` para e-commerce próprio
- Formato exato do parâmetro `data` em `GetProdutosAlterados`
- Campo `internet` vem preenchido no retorno do `GetProdutos`?
- Produtos retornam com foto/imagem?
- `PostPedido` é síncrono ou apenas acusa recebimento?
- Existe ambiente de sandbox/homologação?
- Rate limiting — quantas requisições por minuto/hora?
- Existe webhook/evento push ou apenas polling?
- `GetVendasResumo` retorna vendas do PDV físico também?

**⛔ O SDK Solidcon não pode ser iniciado até receber essas respostas.**

---

## 4. A infraestrutura atual do cliente

O cliente tem:
- **Domínio:** antenorefilhos.com.br
- **Hospedagem:** Hostinger Business (plano pago)
- **Sistemas existentes nas subpastas:**
  - `/mercado` — sistema de pedidos para vinhos (WordPress + Elementor + JetEngine)
  - `/novo` — sistema de pedidos para carnes de outra loja (WordPress + Elementor + JetEngine)
  - `/links/mercado` — links bio do mercado
  - `/links/boutique` — links bio da boutique/outra loja

**Decisão de deploy do MercaZap:**
O MercaZap **não vai** em subpasta (evita conflito com os WordPress existentes).
Vai em **subdomínios** separados:
- `pedidos.antenorefilhos.com.br` — site do cliente
- `admin.antenorefilhos.com.br` — painel administrativo

Os subdomínios são configurados no DNS da Hostinger apontando para
Railway/VPS (o Next.js precisa de Node.js — não roda na hospedagem compartilhada
do WordPress).

---

## 5. O modelo de negócio do sistema

### 5.1 Como o pedido funciona (decisão crítica)

**Não há pagamento online no MVP.** Essa foi uma decisão intencional do cliente,
explicada por dois motivos:

1. **Estoque inconsistente:** o sistema às vezes marca 2 unidades disponíveis quando
   já zerou. Com pagamento online, o cliente pagaria por um produto indisponível.
2. **Relacionamento WhatsApp:** o cliente prefere manter o contato humano com o cliente
   final via WhatsApp para combinar pagamento, confirmar endereço e horário.

**Fluxo completo:**
1. Cliente monta carrinho no site
2. Cliente vê o total e indica preferência de pagamento (só informativo — não cobra)
3. Cliente confirma o pedido
4. Sistema registra no banco + dispara `PostPedido` na API Solidcon
5. Separador recebe notificação push
6. Separador separa os itens e marca os indisponíveis
7. Equipe entra em contato via WhatsApp para confirmar tudo
8. Entrega realizada → pagamento presencial (dinheiro, PIX, cartão)

### 5.2 Produtos da Tabacaria — regra especial de pagamento

O cliente tem uma tabacaria no mercado. Produtos como cigarros **só aceitam
dinheiro ou PIX** — não aceitam cartão. O sistema deve mostrar esse aviso
automaticamente para produtos da categoria tabacaria, tanto no card do produto
quanto no checkout.

O preço de produtos da tabacaria também pode ser ocultado pelo gestor
(motivos comerciais ou de política interna). Quando oculto, aparece um botão
"Consultar preço" que abre o WhatsApp com mensagem pré-formatada.

---

## 6. As quatro interfaces do sistema

O cliente pediu quatro interfaces distintas, todas como PWA:

### 6.1 Site do cliente (PWA mobile-first)
URL: `pedidos.antenorefilhos.com.br`

O cliente deixou claro: **o foco é mobile**. A maioria dos clientes usa celular.
Como o relacionamento é via WhatsApp, o cliente vai clicar em links enviados no
WhatsApp e abrir no celular. A experiência desktop é secundária mas necessária.

Funcionalidades que o cliente pediu:
- Catálogo de produtos com busca inteligente
- Busca com tolerância a erros de digitação (público é idoso/baixa tech)
- Categorias, badges, filtros
- Cestas especiais com desconto
- Carrinho persistente
- Checkout com seleção de entrega/retirada
- Agendamento de horário de entrega
- Indicação de forma de pagamento (informativo)
- Acompanhamento de pedido com status
- Notificações push (pediu que fossem solicitadas logo após o cliente confirmar o pedido)

### 6.2 Admin (desktop-first)
URL: `admin.antenorefilhos.com.br`

O cliente quer **controle total sem precisar abrir o ERP Solidcon**. Tudo que
for necessário para operar o e-commerce deve estar no Admin.

Funcionalidades que o cliente pediu:
- Gestão completa de produtos (fotos, descrição, categorias, badges)
- Controle do campo Internet (ESTOQUE/SEMPRE/NUNCA) com override
- Controle de exibição de preços (global + por produto)
- Cadastro de produto direto no MercaZap (sem depender da Solidcon)
- Cestas: montar combinações de produtos com precificação flexível
- Pedidos: lista, filtros, impressão para separação, cancelamento
- **Relatórios e estatísticas** (o cliente pediu especificamente isso)
- Botão de sync manual com Solidcon
- Gestão de funcionários do Separador (usuário/senha ou PIN)
- **Seção de Integrações** — o cliente pediu que a Solidcon ficasse numa seção
  específica de integrações, pois no futuro terão outras (WhatsApp Business API,
  contabilidade, marketplaces). A Solidcon inaugura essa seção.
- Notificações push: toggle configurável por usuário admin (ligar/desligar)
- Links e URLs para campanhas WhatsApp

### 6.3 App Separador (PWA mobile/tablet — obrigatório no MVP)
URL: `pedidos.antenorefilhos.com.br/separador`

O cliente pediu uma interface específica para o funcionário que separa os pedidos
fisicamente no estoque. Pode ser usado no celular do funcionário ou num tablet
fixado no balcão.

O cliente deixou claro: **notificação push é obrigatória** para o separador.
Quando chegar um novo pedido, o celular deve vibrar e alertar. Sem isso, o
funcionário teria que ficar olhando a tela esperando aparecer algo.

Funcionalidades:
- Login: usuário/senha ou PIN 4 dígitos (configurável por funcionário no Admin)
- Fila de pedidos em tempo real com prioridade
- Ao abrir um pedido: lista de itens com foto, quantidade e EAN
- Marcar item como: separado ✓ ou indisponível ✕
- Quando marcar indisponível: cliente recebe notificação automática
- Concluir pedido: atualiza status e notifica equipe de entrega

### 6.4 App Entregador (PWA mobile — Fase 2)
Não é MVP. O cliente pediu para a Fase 2.

O cliente quer que o cliente final consiga ver o entregador no mapa em tempo
real, igual Rappi/iFood. O entregador abre um link recebido via WhatsApp,
autoriza o GPS, e a posição é transmitida em tempo real via WebSocket.
O cliente vê no mapa.

---

## 7. Funcionalidades específicas que o cliente pediu

### 7.1 Badges de produto

O cliente pediu badges/tags visuais nos produtos. Explicou que vende desde
importados e grandes indústrias até produtos artesanais e caseiros. As badges
que pediu:

- **Artesanal** — produção artesanal de fornecedor externo
- **Da Casa** — produção própria do Antenor & Filhos
- **Congelado**
- **Kit** — combinação de produtos
- **Veg** — vegetariano/vegano
- **Orgânico**
- **Integral**
- **Sem Glúten**
- **Sem Lactose**
- *"e etc."* — o cliente disse "e etc.", indicando que o sistema deve suportar
  mais badges no futuro além das listadas

Além dessas, o sistema também tem:
- **Tabacaria** — ativa regras especiais de pagamento
- **Promo** — produto em promoção
- **Novo** — produto recém-chegado

### 7.2 Cestas de produtos

O cliente pediu um recurso de montar "cesta" — produto composto. Explicou assim:

> "Eu seleciono os produtos por ean, nome ou código. Posso informar os preços
> já com desconto, percentual, ou só não informar nada nesse momento deixando
> os preços originais do sistema e só informo o valor final do 'cesta' e ele
> mostra um 'de R$ 00,00 por R$ 00,00'."

Ou seja, três modos de precificação:
1. Desconto percentual por item
2. Preço manual por item
3. Apenas informar o valor final da cesta (exibe "De R$ X por R$ Y")

Cada cesta tem URL própria para usar em campanhas WhatsApp.

### 7.3 URLs limpas para campanhas

O cliente explicou o caso de uso exatamente assim:

> "Assim eu posso mandar uma mensagem para o cliente dizendo 'Olá, daniel, hoje
> temos promoções no açougue, é só clicar no link abaixo que você vai direto
> para a tela de promoções do nosso app'."

O sistema deve ter URLs semânticas limpas para todas as seções:
- `/categoria/acougue`
- `/promocoes/acougue`
- `/cesta/cafe-da-manha`
- `/produto/picanha-angus`
- etc.

### 7.4 Controle de exibição de preços

O cliente pediu dois níveis:
- **Global:** um toggle que oculta todos os preços de uma vez (útil durante
  reajuste de tabela)
- **Por produto:** cada produto pode ter preço oculto individualmente

Quando preço oculto: botão "Consultar preço" que abre WhatsApp com mensagem
pré-formatada.

### 7.5 Cadastro próprio de produtos no MercaZap

O cliente quer poder cadastrar produtos diretamente no MercaZap, sem depender
de cadastrar primeiro na Solidcon. Explicou:

> "Assim eu não fico preso a ter que cadastrar o produto só pelo solidcon,
> eu posso cadastrar ele primeiro no meu sistema, aí depois que eu cadastrar
> ele no solidcon e o mercazap receber uma carga da atualização de produtos
> novos, sincroniza via os códigos disponíveis na api que podemos usar para
> essa função."

Ou seja: o produto fica disponível imediatamente no site. Quando for cadastrado
na Solidcon e o próximo sync ocorrer, o sistema vincula automaticamente pelo
EAN ou código interno.

### 7.6 Fotos de produtos

O cliente confirmou: **a Solidcon NÃO tem fotos dos produtos**. Todas as fotos
precisam ser cadastradas diretamente no MercaZap via upload no Admin.

O cliente pediu também um "importador inteligente" para facilitar o trabalho:
busca a foto automaticamente pelo EAN em bases públicas, exibe para confirmação,
e o gestor aprova ou faz upload manual.

### 7.7 Notificações push — detalhamento completo

O cliente pediu notificações em três interfaces:

**Separador:** obrigatório. Sem isso o app não funciona direito. Solicitada no
primeiro login.

**Admin:** opcional, configurável. O cliente disse:
> "quero ter a opção de cadastrar produtos direto pelo mercazap... [sobre
> notificações] no adm também mas opcional, podendo ligar ou desligar."

**Cliente:** solicitada após confirmação do pedido. O cliente disse:
> "pode ter uma solicitação para ativar as notificações assim que o cliente
> finalizar o pedido."

Motivo do timing: momento de maior engajamento, cliente tem razão concreta
para aceitar ("para acompanhar sua entrega em tempo real").

### 7.8 Relatórios e estatísticas no Admin

O cliente pediu especificamente:
> "a versão admin, vai ter relatórios e estatísticas."

O que foi definido para os relatórios:
- Cards de resumo: pedidos hoje, faturamento, ticket médio, aguardando
- Gráfico de barras: pedidos por dia (últimos 14 dias)
- Gráfico donut: entrega vs retirada
- Top produtos mais vendidos
- Faturamento por categoria
- Horários de pico (quando os pedidos chegam mais)
- Seletor de período e exportação CSV

### 7.9 Seção de Integrações no Admin

O cliente pediu:
> "essa configuração pode ser em uma seção específica para integrações e
> conectividades com outros sistemas, vamos inaugurar o sistema com a
> integração da solidcon mas futuramente teremos outras integrações e ficarão
> todas nessa sessão de integrações."

Integrações mapeadas para o futuro (além da Solidcon):
- WhatsApp Business API (Fase 2/3)
- Sistema de contabilidade
- Marketplaces (iFood, Rappi)

---

## 8. Decisões de design e UX

### 8.1 Foco mobile

O cliente disse explicitamente:
> "nosso foco tem que ser a experiencia mobile, todo mundo usa celular hoje e
> como o cliente está em contato com a gente pelo whatsapp o tempo todo, o
> nosso foco é o mobile. Ainda que seja importante também a experiência em
> computador."

Isso significa: **mobile-first obrigatório**. Todo componente é desenhado
primeiro para 390px e depois adaptado para desktop.

### 8.2 Identidade visual — Antenor & Filhos

O cliente enviou:
- Logo em 4 versões: bordô, branco, palha/dourado, preto
- Paleta de cores oficial

**Paleta definida pelo cliente:**
- **Bordô:** `#5D082A` — cor primária da marca
- **Palha/Dourado:** `#D2BB8A` — cor de acento
- **Preto:** `#231F20` — texto e fundos escuros
- **Off-white/Creme:** fundo claro (não branco puro)

**Uso do logo por contexto:**
- Fundo branco/claro → logo bordô (uso mais comum)
- Fundo escuro → logo branco
- Fundo escuro com toque luxuoso → logo palha/dourado
- Monocromático → logo preto ou branco dependendo do fundo

### 8.3 Tipografia

O cliente avaliou o rascunho inicial e pediu ajuste:
> "Essa fonte eu até gostei, só há um problema nela: a versão mais pesada dela,
> fica muito estendido os caracteres, o ideal é uma fonte que tenha a largura
> mais contida. Tipo a Google Sans Flex, Roboto, inclusive a Fira Sans é bem
> interessante também."

Ficou definido:
- **Fira Sans** — para tudo: corpo, labels, botões, navegação, **preços**
- **Cormorant Garamond** — apenas para títulos editoriais decorativos

**Regra absoluta:** Fira Sans em preços. Nunca Cormorant Garamond em valores
monetários. O cliente pediu especificamente:
> "não gostei da escolha dessa fonte 'serifada' para os preços, mas somente
> dos preços. Acho melhor usar a Fira Sans também nos preços."

### 8.4 Referências visuais

O cliente forneceu 3 sites de referência para análise:
- `emporiomultimix.com.br/comestiveis-matriz` (usa MercaFácil)
- `armazemdograo.com.br` (plataforma própria)
- `princesasupermercados.com.br/cabo-frio-1` (usa MercaFácil)

Todos os três são concorrentes ou similares ao que ele quer construir.
O objetivo não é copiar, mas entender o padrão do mercado e fazer melhor.

---

## 9. Decisões técnicas tomadas

### 9.1 Stack definida pelo planejamento

| Componente | Tecnologia | Por quê |
|---|---|---|
| Framework | Next.js 14 App Router | Unifica 4 PWAs + API. Server Components reduz JS no cliente |
| Linguagem | TypeScript strict | Segurança de tipos, sem `any` implícito |
| Estilização | Tailwind CSS | Mobile-first nativo |
| Banco | PostgreSQL + Prisma | Dados persistentes, type-safe |
| Cache | Redis | Carrinho, sessões, rate limiting |
| Busca | MeiliSearch | Tolerância a erros PT-BR, sub-50ms |
| Filas | BullMQ (Redis) | Sync cron 30min, notificações batch |
| Notificações | Web Push API | Nativa do PWA, sem custo |
| Rastreamento | WebSocket (Fase 2) | GPS entregador |
| Imagens | Cloudflare R2 | S3-compatible + CDN global |
| Deploy frontend | Vercel | |
| Deploy backend | Railway | |
| CI/CD | GitHub Actions | |

### 9.2 PWA em vez de app nativo

Decisão consciente. O público tem baixa familiaridade tecnológica — App Store é
uma barreira. Com PWA, o cliente abre o Chrome, entra no site, clica em
"adicionar à tela inicial" → ícone igual a um app, funciona offline para
histórico, recebe push notifications nativas.

### 9.3 Sem pagamento online no MVP

Decisão consciente do cliente (ver item 5.1). Não implementar MercadoPago ou
qualquer gateway no MVP. O checkout é uma "reserva" — o pagamento é presencial.

### 9.4 Login do Separador

O cliente optou pelas duas opções combinadas:
> "gosto das opções 2 e 3" (usuário/senha E PIN 4 dígitos)

Significa: o Admin pode configurar por funcionário qual tipo de login usar.
Alguns funcionários terão usuário/senha, outros terão PIN.

---

## 10. Segurança e LGPD — pedido do cliente

O cliente pediu expressamente:
> "preciso também que nos resguardemos sobre a segurança dos dados, criptografia,
> e etc. importante para que não haja ataques e nem vazamentos de dados"

O sistema coleta dados pessoais cobertos pela LGPD (Lei 13.709/2018):
CPF, nome, endereço, telefone, histórico de compras.

Medidas definidas:
- Criptografia AES-256-GCM para dados pessoais em repouso
- bcrypt fator 12 para senhas
- JWT em cookie `httpOnly` (JavaScript não consegue ler)
- CPF mascarado em todos os logs (`***.***.***-XX`)
- Rate limiting: bloqueio após 5 tentativas de login
- Endpoint de login não revela se CPF/email existe ou não
- Validação de tipo real em uploads (não só extensão)
- Headers de segurança HTTP (CSP, HSTS, X-Frame-Options)
- CORS restrito aos domínios autorizados
- Consentimento explícito no cadastro (LGPD)
- Funcionalidade de exclusão/anonimização de dados
- `npm audit` automático no CI

---

## 11. Documentação e governança — pedido do cliente

O cliente tem forte consciência de que vai trocar de IA ou de equipe no futuro.
Pediu explicitamente:

> "importante tem instruções de governança na codagem para eu poder dar
> continuidade, se eu quiser, em outras IAs ou com outra equipe de desenvolvimento."

> "quero poder trabalhar com urls/links limpos para posteriormente serem
> usados em campanhas e promoções enviadas pelo whatsapp."

> "crie uma lógica de desenvolvimento para esse projeto, que será utilizada
> em outros modelos de IA. Quero já crie o arquivo de governança, skill,
> tarefas executadas e pendentes e o 'progresso até aqui', parametrização
> de tudo, sempre 1 versão em português-br e 1 versão inglês também, assim
> qualquer IA consegue interpretar, e continuar o desenvolvimento."

> "sobre o documento de governança, quero ele em formato markdown ou txt,
> o que for melhor para ser lido e interpretado por outras IAs. mas mantenha
> também a versão em docx."

### Kit de documentação criado

Todos os arquivos existem em PT-BR e inglês:

| Arquivo PT-BR | Arquivo EN | Conteúdo |
|---|---|---|
| `GOVERNANCA.md` | `GOVERNANCE.md` | Fonte única de verdade — tudo sobre o projeto |
| `PROGRESSO.md` | `PROGRESS.md` | Estado atual do desenvolvimento |
| `TAREFAS.md` | `TASKS.md` | Backlog detalhado com 19 tarefas do MVP |
| `SEGURANCA.md` | `SECURITY.md` | Regras de segurança com código de exemplo |
| `FUNCIONALIDADES_DETALHADAS.md` | `FEATURES_SPEC.md` | Spec técnica completa de cada funcionalidade |
| `CHANGELOG.md` | (único, bilíngue) | Histórico de mudanças |
| `BRIEFING_COMPLETO.md` | `COMPLETE_BRIEFING.md` | Este documento |

---

## 12. Estado atual do projeto

### O que foi feito

- ✅ Planejamento completo
- ✅ Todas as decisões de negócio tomadas
- ✅ Stack tecnológica definida
- ✅ Design system completo (cores, fontes, regras)
- ✅ Protótipos HTML das 3 interfaces (vitrine, admin, separador) com identidade visual Antenor & Filhos
- ✅ Kit de documentação completo (11 arquivos MD)
- ✅ Especificação técnica detalhada de todas as funcionalidades
- ✅ E-mail enviado à Solidcon com perguntas técnicas

### O que está bloqueado

- ⛔ SDK Solidcon — aguardando credenciais e `cdEcom`
- ⏳ Repositório GitHub — não criado ainda (aguardando cliente)

### O que pode começar agora

- ✅ Estrutura base do monorepo (TAREFA-001)
  - package.json, pnpm workspaces, TypeScript, Tailwind com tokens da marca,
    ESLint, Prettier, Husky, estrutura de pastas, .env.example
  - Não depende das credenciais Solidcon

### Próxima ação imediata

1. Cliente cria repositório GitHub
2. Executar TAREFA-001 (estrutura base)
3. Aguardar resposta Solidcon para iniciar TAREFA-002 (SDK)
4. Com SDK pronto: TAREFA-003 (Admin — Produtos) em diante

---

## 13. Perguntas que o cliente NÃO respondeu ainda

Itens descobertos durante o planejamento que precisam de decisão:

- [ ] Qual o nome do repositório no GitHub?
- [ ] Verificar se Hostinger Business suporta subdomínios apontando para Railway
- [ ] Turborepo ou Nx para gerenciar o monorepo?
- [ ] Política de retenção de dados (LGPD) — quantos meses manter histórico?
- [ ] Valor mínimo de pedido (se houver)?
- [ ] Taxa de frete: por km, por bairro, frete grátis acima de X?
- [ ] Horários disponíveis para agendamento de entrega?
- [ ] Sistema opera 24h ou apenas no horário da loja?

---

## 14. Instruções para a próxima IA

Se você é uma IA recebendo este briefing:

1. **Leia `GOVERNANCA.md` completo** — é a fonte única de verdade
2. **Leia `PROGRESSO.md`** — veja o que está feito e o que está pendente
3. **Leia `TAREFAS.md`** — cada tarefa tem contexto suficiente para execução
4. **A próxima tarefa executável é TAREFA-001** — estrutura base do monorepo
5. **Não crie nada fora do design system** definido na Seção 3 da `GOVERNANCA.md`
6. **Fira Sans em preços** — nunca Cormorant Garamond em valores monetários
7. **Mobile-first obrigatório** — todo CSS começa em 390px
8. **A integração com Solidcon passa sempre pelo `/packages/solidcon-sdk`**
9. **Atualize `CHANGELOG.md` e `PROGRESSO.md`** ao encerrar qualquer sessão
10. **O cliente fala português** — commits, documentação e comentários em PT-BR

---

*Versão 1.0 — Março 2026*
*Documento de transferência de contexto — MercaZap / Antenor & Filhos*
