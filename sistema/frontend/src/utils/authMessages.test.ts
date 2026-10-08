import { describe, expect, it } from 'vitest'
import { loginErrorMessage } from './authMessages'

describe('erro do login', () => {
  it('dado errado ou conta sem senha: mensagem clara e saida pelo esqueci a senha', () => {
    expect(loginErrorMessage({ response: { status: 401, data: { message: 'Credenciais invalidas' } } })).toEqual({
      text: 'E-mail, CPF ou celular e senha não conferem.',
      suggestReset: true,
    })
  })

  it('limite de tentativas em portugues', () => {
    expect(loginErrorMessage({ response: { status: 429, data: { message: 'ThrottlerException: Too Many Requests' } } }).text).toMatch(/Espere um minuto/)
  })

  it('conta suspensa mostra o motivo da API', () => {
    expect(loginErrorMessage({ response: { status: 403, data: { message: 'Sua conta foi suspensa.' } } })).toEqual({ text: 'Sua conta foi suspensa.', suggestReset: false })
  })

  it('sem conexao usa a mensagem do interceptor', () => {
    expect(loginErrorMessage({ userMessage: 'Sem conexão com o servidor.' }).text).toBe('Sem conexão com o servidor.')
  })
})
