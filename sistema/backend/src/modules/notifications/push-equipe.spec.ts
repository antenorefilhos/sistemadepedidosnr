/**
 * Push para a EQUIPE (separacao e entrega).
 *
 * Ate 03/09/2026 nao existia: `PushSubscription` so tinha `customerId`, entao
 * os apps que rodam no celular do funcionario nao avisavam nada -- so
 * descobria servico novo quem lembrasse de abrir e olhar a lista.
 */
process.env.VAPID_PUBLIC_KEY = 'chave-publica-de-teste'
process.env.VAPID_PRIVATE_KEY = 'chave-privada-de-teste'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}))

import { PushNotificationService } from './push-notification.service'

const build = (equipe: Array<{ id: string }>, inscricoes: Array<Record<string, unknown>>) => {
  const prisma = {
    admin: { findMany: jest.fn().mockResolvedValue(equipe) },
    pushSubscription: { findMany: jest.fn().mockResolvedValue(inscricoes), deleteMany: jest.fn() },
  }
  const service = new PushNotificationService(prisma as never)
  return { service, prisma }
}

const inscricao = (adminId: string) => ({
  id: `s-${adminId}`, adminId, customerId: null,
  endpoint: `https://push.example/${adminId}`, auth: 'a', p256dh: 'p',
})

describe('sendNotificationToModule', () => {
  it('busca quem tem o modulo E esta ativo', async () => {
    const { service, prisma } = build([{ id: 'sep1' }], [inscricao('sep1')])

    await service.sendNotificationToModule('picking', { title: 'Novo pedido', body: 'x' })

    expect(prisma.admin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    )
    const { where } = prisma.admin.findMany.mock.calls[0][0]
    // admin e master e enxerga todos os modulos (ver ModuleAccessGuard), entao
    // entra na lista junto com quem tem o modulo especifico.
    expect(where.OR).toEqual([{ role: 'admin' }, { moduleAccess: { has: 'picking' } }])
  })

  it('envia uma vez por aparelho inscrito', async () => {
    const { service } = build(
      [{ id: 'sep1' }, { id: 'sep2' }],
      [inscricao('sep1'), inscricao('sep2')],
    )

    const resultado = await service.sendNotificationToModule('picking', { title: 'Novo pedido', body: 'x' })

    expect(resultado.sent).toBe(2)
  })

  // Loja sem ninguem no modulo nao pode custar consulta de inscricao nem
  // estourar -- e o estado normal enquanto o dono nao montou a equipe.
  it('ninguem no modulo: nao consulta inscricao e nao quebra', async () => {
    const { service, prisma } = build([], [])

    const resultado = await service.sendNotificationToModule('delivery', { title: 'x', body: 'y' })

    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled()
    expect(resultado).toEqual({ sent: 0, failed: 0, skipped: 0 })
  })

  it('equipe existe mas ninguem ativou o aviso: nao envia nada', async () => {
    const { service } = build([{ id: 'sep1' }], [])

    expect(await service.sendNotificationToModule('picking', { title: 'x', body: 'y' })).toEqual({
      sent: 0, failed: 0, skipped: 0,
    })
  })
})
