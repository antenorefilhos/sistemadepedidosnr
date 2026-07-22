# Product

## Register

product

## Platform

web

## Users
Clientes finais comprando supermercado para entrega ou retirada: famílias e clientes locais resolvendo a compra da semana. O contexto típico é pressa e repetição — a pessoa já sabe boa parte do que quer e precisa fechar o pedido sem fricção, frequentemente pelo celular. O trabalho a ser feito é "resolver minha compra sem dor", não "explorar um catálogo".

A equipe interna também opera o sistema (admin, separação, integração com ERP), mas este documento trata deliberadamente do cliente final; é ele quem guia as decisões de design.

## Product Purpose
Plataforma de e-commerce e gestão de pedidos para o supermercado premium Antenor & Filhos, integrando a loja online (Storefront) com o painel de controle (Admin), separação de pedidos (Picking) e integração com ERP (Solidcom).

Sucesso é **migrar para a plataforma o volume que hoje passa por WhatsApp e telefone**, reduzindo a carga de atendimento manual da equipe. Um pedido que precisou de uma mensagem para ser concluído é um pedido que a interface não resolveu.

## Positioning
Supermercado premium de tradição familiar com entrega ágil e curadoria de produtos frescos e selecionados, direto na sua casa.

## Brand Personality
Confiança e agilidade em primeiro lugar: a promessa central é que a compra da semana se resolve rápido e sem surpresa. A tradição familiar e o acolhimento seguem presentes como pano de fundo — é um mercado de bairro, não um marketplace anônimo —, mas hoje pesam menos que a **praticidade**. O tom é direto e cordial, sem euforia promocional.

## Anti-references
- Layouts genéricos de SaaS (cinzas claros desbotados, sombras exageradas ou gradientes artificiais no texto).
- Aplicativos promocionais tradicionais excessivamente poluídos, cheios e barulhentos.
- Interfaces excessivamente técnicas que lembram painéis de controle de backend ou bancos de dados crus.

## Design Principles
- **A régua muda com a página**: Home e Adega são superfícies de desejo e podem ser editoriais e expressivas. Mercado, Produto, Carrinho e Checkout são superfícies de tarefa: previsibilidade e padrões familiares de e-commerce vencem a ousadia estética. Aplicar a régua errada em qualquer um dos lados é erro.
- **Cada fricção removida é uma mensagem a menos**: toda decisão de interface responde a "isso evita que o cliente precise chamar no WhatsApp?". Campo ambíguo, preço pouco claro ou estado de estoque escondido geram atendimento manual.
- **Repetir é mais comum que descobrir**: o cliente típico está refazendo uma compra parecida com a anterior. Recompra, busca e listas valem mais que vitrines de descoberta.
- **Destaque ao Frescor**: imagens e cores que valorizam a qualidade, o frescor e a procedência dos alimentos (feira, adega, carnes) — é o que diferencia de uma lista de SKUs.
- **Simplicidade Sem Poluição**: facilitar a jornada de compra sem sobrecarregar o usuário com banners piscantes ou poluição visual.

## Accessibility & Inclusion
Meta explícita: **WCAG 2.1 nível AA**. Vale como critério de revisão para código novo — contraste mínimo de 4.5:1 em texto corpo (3:1 em texto grande), foco visível, rótulos associados programaticamente aos campos, nome acessível em todo controle e alternativa textual em imagens de conteúdo.
