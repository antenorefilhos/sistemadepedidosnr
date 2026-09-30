import { formaDoCaixa } from './payments-overview.service'

describe('formaDoCaixa', () => {
  it.each([
    ['Dinheiro', 'CASH'],
    ['PIX', 'PIX'],
    ['Pix QR Code', 'PIX'],
    ['Cartão Débito', 'CARD'],
    ['CARTAO CREDITO', 'CARD'],
    ['Vale Alimentação', 'VOUCHER'],
    ['Ticket Refeição', 'VOUCHER'],
    ['Cheque', 'OTHER'],
  ])('%s -> %s', (descricao, forma) => {
    expect(formaDoCaixa(descricao)).toBe(forma)
  })
})
