import { PrismaService } from './prisma.service'
import { fulfillmentDay, parseHoursConfig, spDay, type HoursConfig } from './delivery-hours'

/** Horario da tela Horario de entrega. Falha de leitura vira "sem horario" (dia de calendario). */
export async function loadHoursConfig(prisma: PrismaService): Promise<HoursConfig | null> {
  try {
    const brand = await prisma.brandConfig.findUnique({ where: { id: 'singleton' }, select: { businessHours: true, specialDates: true } })
    return parseHoursConfig(brand?.businessHours, brand?.specialDates)
  } catch {
    return null
  }
}

/** Dia cujo preco vale para o pedido: o dia agendado, ou o da entrega de um pedido feito agora. */
export async function promoDayFor(prisma: PrismaService, scheduledFor?: string | Date | null, now = new Date()): Promise<string> {
  if (scheduledFor) {
    const at = new Date(scheduledFor)
    if (!Number.isNaN(at.getTime())) return spDay(at)
  }
  return fulfillmentDay(await loadHoursConfig(prisma), now)
}
