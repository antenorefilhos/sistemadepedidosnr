import { isAxiosError } from 'axios'

/**
 * Erro do axios em forma segura para log.
 *
 * O `AxiosError` carrega a requisicao inteira em `config`: o header
 * `Authorization` (a chave da AntenorApi, em claro) e o corpo enviado (pedido
 * com CPF, telefone e endereco do cliente). Serializado como estava
 * (`JSON.stringify` chama o `toJSON` dele), tudo isso ia parar no log
 * estruturado. Achado em 17/11/2026, quando linhas truncadas de log de uma
 * queda da AntenorApi mostraram parte da chave.
 *
 * Fica so o que serve para diagnosticar: o que foi chamado, o codigo, o status
 * e o comeco da resposta de erro.
 */
export function safeAxiosError(error: unknown): unknown {
  if (!isAxiosError(error)) return error

  let resposta: string | undefined
  const data = error.response?.data
  if (data !== undefined && data !== null) {
    try {
      resposta = (typeof data === 'string' ? data : JSON.stringify(data)).slice(0, 500)
    } catch {
      resposta = undefined
    }
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.response?.status,
    method: error.config?.method?.toUpperCase(),
    url: error.config?.url,
    ...(resposta ? { resposta } : {}),
    stack: error.stack,
  }
}
