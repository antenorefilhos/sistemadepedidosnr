import { getApiErrorMessage } from './apiError'

type HttpErrorLike = { response?: { status?: number } }

/**
 * Erro do login em portugues de gente (07/10/2026). A API responde
 * "Credenciais invalidas" (sem acento) para dado errado e tambem para conta
 * sem senha -- a de quem comprou como convidado --, de proposito, para nao
 * contar quem tem conta. A dica do "Esqueci minha senha" cobre os dois casos.
 */
export function loginErrorMessage(error: unknown): { text: string; suggestReset: boolean } {
  const status = (error as HttpErrorLike)?.response?.status
  if (status === 401) return { text: 'E-mail, CPF ou celular e senha não conferem.', suggestReset: true }
  if (status === 429) return { text: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.', suggestReset: false }
  return { text: getApiErrorMessage(error, 'Não foi possível entrar agora. Tente de novo.'), suggestReset: false }
}
