# Skill: Organizador de Wiki Obsidian com Memória Contínua

Esta habilidade ajuda qualquer IA ou automação a organizar uma wiki, base de conhecimento ou cofre de memória sob o formato do Obsidian.

## Objetivo

Manter a wiki organizada, contendo:
- Contexto atualizado do projeto
- Ponto exato onde o trabalho foi interrompido
- Histórico de alterações e changelog
- Área de agentes e responsabilidades
- Documentos de Roadmap e pendências organizados

## Estrutura Recomendada

A wiki é organizada nas seguintes categorias/pastas:
- **00 - Dashboard/**: Contém a página Home e resumos visuais de status.
- **01 - Projeto/**: Visão geral de metas, objetivos, roadmap e decisões técnicas.
- **02 - Contexto/**: Contexto ativo, onde parei e histórico recente de edições.
- **03 - Agentes/**: Definições de papéis de agentes ativados no projeto.
- **04 - Skills/**: Catálogo de habilidades e padrões de automação.
- **05 - Referências/**: Documentos externos, documentação técnica legada e links.
- **99 - Sistema/**: Templates Obsidian, manutenção de índices de arquivos.

## Modos de Operação

### Modo Econômico
Reduz o uso de cota operando com o mínimo de leituras/escritas e gerando resumos curtos:
- Atualiza preferencialmente seções demarcadas por `<!-- AUTO START -->` e `<!-- AUTO END -->`.
- Preserva anotações humanas demarcadas por `<!-- MANUAL START -->` e `<!-- MANUAL END -->`.
- Fornece respostas resumidas focadas em apontar os links atualizados.
