# MANUAL_UPDATE.md - Processo de Atualizacao Documental

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

Objetivo: manter a documentacao canonica alinhada ao codigo real e separar claramente o que e snapshot historico.

## Regra principal

- se uma mudanca altera rota, setup, dependencia obrigatoria, modelo, contrato ou fluxo operacional, atualize a documentacao canonica no mesmo ciclo

## Documentos canonicos por tipo de mudanca

- estado e versao: STATUS.md
- arquitetura e rotas: REFERENCIA_TECNICA.md
- ambiente e variaveis: CONFIGURACOES.md
- memoria e decisoes: MEMORIA_PROJETO.md
- erros e recuperacao: CATALOGO_ERROS.md
- requisitos e historico: REQUISITOS.md e HISTORICO_CONVERSA.md
- rastreio de sessoes IA: REGISTRO_IAS.md
- comandos operacionais: QUICK_COMMANDS.md
- onboarding tecnico rapido: QUICKSTART.md
- operacao de imagens: GUIA_UPLOADS_IMAGENS.md

## Fluxo atualizado

1. confirmar o comportamento no codigo real
2. identificar o documento canonico afetado
3. atualizar versao, data e fatos verificaveis
4. validar se snapshots em archives precisam apenas de referencia, nao de reescrita
5. buscar termos antigos ou incompativeis antes de encerrar
6. registrar entrada em REGISTRO_IAS.md e HISTORICO_CONVERSA.md

## Problemas conhecidos de atualizacao

- documentos historicos foram usados como fonte canonica em sessoes antigas
- houve periodo de transicao SQLite para PostgreSQL que deixou rastros inconsistentes
- arquivos ausentes na pasta md podem existir apenas em archives e precisam ser promovidos quando voltam a ser canonicos

## Validacao recomendada

```bash
rg "sqlite|file:\./prisma/dev\.db|compose com 5 servicos|compose com 6 servicos|/integrations/payments|/integrations/crm|/integrations/fiscal|/products/suggest|/uploads/products" arquivos-projeto sistema
```