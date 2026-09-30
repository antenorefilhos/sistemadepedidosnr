import { departmentCategories } from './products.service'

describe('departmentCategories', () => {
  it('"Adega e Cervejas" (arvore v3) cobre vinho, cerveja e destilado, sem suco', () => {
    expect(departmentCategories('Adega e Cervejas')?.sort()).toEqual(['ADEGA_VINHOS_ESPUMANTES', 'CERVEJAS_CHOPP', 'DESTILADOS_COQUETEIS'])
  })
  it('departamento v3 simples vira a categoria dele', () => {
    expect(departmentCategories('Bebidas')).toEqual(['SUCOS_REFRIGERANTES'])
    expect(departmentCategories('Hortifrúti')).toEqual(['HORTIFRUTI_ORGANICOS'])
  })
  it('departamento antigo continua igual; nome desconhecido devolve null', () => {
    expect(departmentCategories('Bebidas & Adega')).toContain('SUCOS_REFRIGERANTES')
    expect(departmentCategories('Pet Shop')).toEqual(['PET_SHOP'])
    expect(departmentCategories('Inexistente')).toBeNull()
  })
})
