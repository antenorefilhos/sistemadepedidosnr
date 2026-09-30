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
