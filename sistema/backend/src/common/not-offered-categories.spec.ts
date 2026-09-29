import { categoryCodeFromName, invalidateNotOffered, notOfferedCategoryCodes } from './not-offered-categories'

describe('notOfferedCategoryCodes', () => {
  it('junta TABACARIA com os departamentos ocultos, no codigo do produto', async () => {
    invalidateNotOffered()
    const prisma = { category: { findMany: jest.fn().mockResolvedValue([{ name: 'Espaço Gourmet & Importados' }]) } } as any
    const codes = await notOfferedCategoryCodes(prisma)
    expect([...codes].sort()).toEqual(['ESPACO_GOURMET_IMPORTADOS', 'TABACARIA'])
    expect(categoryCodeFromName('Açougue & Churrasco')).toBe('ACOUGUE_CHURRASCO')
  })
})
