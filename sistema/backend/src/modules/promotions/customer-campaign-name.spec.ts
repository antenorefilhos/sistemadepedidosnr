import { customerCampaignName } from './promotions.service'

describe('customerCampaignName', () => {
  it.each([
    ['TERÇA HORTIFRUTI NR', 'Terça Hortifruti'],
    ['SEGUNDA DA CARNE NV', 'Segunda da Carne'],
    ['ENCARTE FINAL SEMANA NR', 'Encarte Final Semana'],
    ['VALIDADE', 'Validade'],
    ['ENCARTE VOLTA AS AULAS', 'Encarte Volta as Aulas'],
  ])('%s -> %s', (raw, nome) => {
    expect(customerCampaignName(raw)).toBe(nome)
  })
})

describe('regra de nome do encarte (02/10/2026)', () => {
  const { encarteKey, campaignDisplayName } = require('./promotions.service')

  it('a chave ignora filial, caixa e acento: o mesmo encarte toda semana cai na mesma regra', () => {
    expect(encarteKey('VALIDADE NR')).toBe('VALIDADE')
    expect(encarteKey('Validade nv')).toBe('VALIDADE')
    expect(encarteKey('  TERÇA   HORTIFRUTI NR ')).toBe('TERCA HORTIFRUTI')
  })

  it('o cliente ve o nome da regra; sem regra, o nome do ERP arrumado', () => {
    expect(campaignDisplayName({ name: 'VALIDADE NR', customerName: 'Ofertas Relâmpago' })).toBe('Ofertas Relâmpago')
    expect(campaignDisplayName({ name: 'TERÇA HORTIFRUTI NR', customerName: null })).toBe('Terça Hortifruti')
    expect(campaignDisplayName({ name: 'TERÇA HORTIFRUTI NR', customerName: '  ' })).toBe('Terça Hortifruti')
  })
})
