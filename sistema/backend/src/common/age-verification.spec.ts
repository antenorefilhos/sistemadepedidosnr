import {
  buildCategoryAgeVerificationFlags,
  isAgeVerificationException,
  productRequiresAgeVerification,
  resolveCategoryAgeVerification,
} from './age-verification'

describe('age-verification (AEF-062)', () => {
  describe('isAgeVerificationException', () => {
    it('reconhece os tipos sem alcool da arvore v3, mesmo com acentuacao diferente', () => {
      expect(isAgeVerificationException('Cerveja sem Álcool')).toBe(true)
      expect(isAgeVerificationException('cerveja sem alcool')).toBe(true)
      expect(isAgeVerificationException('Mixer para Drinque')).toBe(true)
      expect(isAgeVerificationException('Bebida sem Álcool (vinho, espumante e sidra)')).toBe(true)
    })

    it('nao marca tipo alcoolico normal como excecao', () => {
      expect(isAgeVerificationException('Cerveja Tradicional')).toBe(false)
      expect(isAgeVerificationException('Drinque Pronto e Coquetel')).toBe(false)
      expect(isAgeVerificationException(null)).toBe(false)
      expect(isAgeVerificationException(undefined)).toBe(false)
    })
  })

  describe('resolveCategoryAgeVerification', () => {
    it('usa o proprio valor quando definido', () => {
      const byId = new Map([['a', { id: 'a', parentId: null, requiresAgeVerification: true }]])
      expect(resolveCategoryAgeVerification('a', byId)).toBe(true)
    })

    it('herda do pai quando o proprio valor e null', () => {
      const byId = new Map([
        ['pai', { id: 'pai', parentId: null, requiresAgeVerification: true }],
        ['filho', { id: 'filho', parentId: 'pai', requiresAgeVerification: null }],
      ])
      expect(resolveCategoryAgeVerification('filho', byId)).toBe(true)
    })

    it('filho pode desligar mesmo com o pai ligado', () => {
      const byId = new Map([
        ['pai', { id: 'pai', parentId: null, requiresAgeVerification: true }],
        ['filho', { id: 'filho', parentId: 'pai', requiresAgeVerification: false }],
      ])
      expect(resolveCategoryAgeVerification('filho', byId)).toBe(false)
    })

    it('raiz sem flag e false', () => {
      const byId = new Map([['a', { id: 'a', parentId: null, requiresAgeVerification: null }]])
      expect(resolveCategoryAgeVerification('a', byId)).toBe(false)
    })
  })

  describe('buildCategoryAgeVerificationFlags', () => {
    it('monta o mapa codigo->flag pro catalogo real de bebida/tabacaria', () => {
      const flags = buildCategoryAgeVerificationFlags([
        { id: '1', name: 'Adega, Vinhos & Espumantes', parentId: null, requiresAgeVerification: true },
        { id: '2', name: 'Cervejas & Chopp', parentId: null, requiresAgeVerification: true },
        { id: '3', name: 'Destilados & Coquetéis', parentId: null, requiresAgeVerification: true },
        { id: '4', name: 'Tabacaria', parentId: null, requiresAgeVerification: true },
        { id: '5', name: 'Hortifruti & Orgânicos', parentId: null, requiresAgeVerification: null },
      ])
      expect(flags.get('ADEGA_VINHOS_ESPUMANTES')).toBe(true)
      expect(flags.get('CERVEJAS_CHOPP')).toBe(true)
      expect(flags.get('DESTILADOS_COQUETEIS')).toBe(true)
      expect(flags.get('TABACARIA')).toBe(true)
      expect(flags.get('HORTIFRUTI_ORGANICOS')).toBe(false)
    })
  })

  describe('productRequiresAgeVerification', () => {
    const flags = new Map([
      ['CERVEJAS_CHOPP', true],
      ['HORTIFRUTI_ORGANICOS', false],
    ])

    it('exige confirmacao pra cerveja normal', () => {
      expect(productRequiresAgeVerification({ category: 'CERVEJAS_CHOPP', classification03: 'Cerveja Tradicional' }, flags)).toBe(true)
    })

    it('nao exige pra cerveja sem alcool, mesmo na categoria gatilho', () => {
      expect(productRequiresAgeVerification({ category: 'CERVEJAS_CHOPP', classification03: 'Cerveja sem Álcool' }, flags)).toBe(false)
    })

    it('nao exige fora de categoria gatilho', () => {
      expect(productRequiresAgeVerification({ category: 'HORTIFRUTI_ORGANICOS', classification03: null }, flags)).toBe(false)
    })

    it('categoria sem entrada no mapa (nunca sincronizada) nao exige', () => {
      expect(productRequiresAgeVerification({ category: 'NAO_CLASSIFICADO', classification03: null }, flags)).toBe(false)
    })
  })
})
