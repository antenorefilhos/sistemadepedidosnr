import { withVerifiedCustomerId } from './checkout.controller'

/**
 * JON-132 (Auditoria 360, High): customerId vinha cru do corpo, sem checar
 * contra o JWT -- cliente logado (ou corpo adulterado) podia atribuir
 * sessao/pedido a QUALQUER outra conta so citando o id dela. Cobre a
 * funcao que decide qual customerId realmente vale.
 */
describe('withVerifiedCustomerId (JON-132)', () => {
  it('ignora customerId do corpo e usa o do token quando o cliente esta logado', () => {
    const dto = { customerId: 'vitima-id' }
    const req = { user: { id: 'atacante-logado-id', role: 'customer' } } as never

    const result = withVerifiedCustomerId(dto, req)

    expect(result.customerId).toBe('atacante-logado-id')
  })

  it('mantem o customerId do corpo quando nao ha token (guest checkout continua igual)', () => {
    const dto = { customerId: 'algum-id-informado-pelo-guest' }

    const result = withVerifiedCustomerId(dto, undefined)

    expect(result.customerId).toBe('algum-id-informado-pelo-guest')
  })

  it('ignora token de equipe (admin/picker/driver) -- so cliente autenticado sobrescreve', () => {
    const dto = { customerId: 'algum-id' }
    const req = { user: { id: 'admin-id', role: 'admin' } } as never

    const result = withVerifiedCustomerId(dto, req)

    expect(result.customerId).toBe('algum-id')
  })
})
