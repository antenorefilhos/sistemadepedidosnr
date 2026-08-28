/**
 * Le uma variavel de ambiente obrigatoria, estourando se ela nao existir.
 *
 * Existe pra um caso especifico: identificador que NAO pode ter valor embutido
 * no codigo -- CNPJ da loja, CPF de balcao, endereco do ERP. Antes de
 * 28/08/2026 os tres tinham fallback hardcoded no fonte, o que juntava dois
 * problemas: dado que a regra do projeto proibe commitar (ver CLAUDE.md) e,
 * pior, um default que silenciosamente virava a configuracao real de producao
 * -- o docker-compose.yml nao repassava nenhuma dessas variaveis, entao o
 * valor do codigo era o unico que valia, e mexer no .env nao mudava nada.
 *
 * Falhar no boot e' deliberado. A alternativa (default) transforma erro de
 * configuracao em comportamento errado silencioso, que foi a familia de bug
 * mais cara desta base de codigo: sincronizar contra o CNPJ errado nao levanta
 * excecao nenhuma, so grava dado errado ate alguem reparar.
 */
export function requireEnv(name: string, fallbackEnv?: string): string {
  const value = process.env[name] || fallbackEnv
  if (!value || !value.trim()) {
    throw new Error(
      `Variavel de ambiente ${name} nao configurada. ` +
        `Ela nao tem valor padrao de proposito -- ver sistema/.env.example e o comentario em common/require-env.ts.`,
    )
  }
  return value.trim()
}
