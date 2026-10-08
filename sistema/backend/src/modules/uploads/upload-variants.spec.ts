import { NotFoundException } from '@nestjs/common'
import { UploadVariantsController, variantWidth } from './thumbs.controller'

describe('versao menor das imagens enviadas (08/10/2026)', () => {
  it('largura pedida vira a menor variante que cobre ela', () => {
    expect(variantWidth('278')).toBe(320)
    expect(variantWidth('556')).toBe(640)
    expect(variantWidth('800')).toBe(800)
    expect(variantWidth('5000')).toBe(1600)
    expect(variantWidth(undefined)).toBe(800)
    expect(variantWidth('abc')).toBe(800)
  })

  it('so arquivo da raiz de uploads: barra, ".." e extensao estranha dao 404', async () => {
    const controller = new UploadVariantsController()
    for (const file of ['../etc/passwd', 'products/123.webp', 'x.svg', 'a..webp', '']) {
      await expect(controller.variant(file, '480', {} as never)).rejects.toBeInstanceOf(NotFoundException)
    }
  })

  it('arquivo que nao existe: 404', async () => {
    await expect(new UploadVariantsController().variant('nao-existe-0000.webp', '480', {} as never)).rejects.toBeInstanceOf(NotFoundException)
  })
})
