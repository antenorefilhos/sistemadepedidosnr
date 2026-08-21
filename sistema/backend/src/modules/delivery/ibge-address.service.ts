import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

const EARTH_RADIUS_M = 6371000

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

@Injectable()
export class IbgeAddressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Geocodificacao reversa local: o endereco oficial do CNEFE mais proximo
   * da coordenada do GPS. Filtra por um bounding box primeiro (usa o indice
   * lat/lng) pra nao varrer as 158 mil linhas calculando distancia real de
   * cada uma -- so entao ordena por haversine entre os poucos candidatos. */
  async findNearest(lat: number, lng: number, radiusMeters = 100) {
    const degreeDelta = radiusMeters / 111000 // ~111km por grau de latitude
    const candidates = await this.prisma.ibgeAddress.findMany({
      where: {
        latitude: { gte: lat - degreeDelta, lte: lat + degreeDelta },
        longitude: { gte: lng - degreeDelta, lte: lng + degreeDelta },
      },
      take: 200,
    })

    if (!candidates.length) return null

    let nearest = candidates[0]
    let nearestDistance = haversineMeters(lat, lng, nearest.latitude, nearest.longitude)
    for (const candidate of candidates.slice(1)) {
      const distance = haversineMeters(lat, lng, candidate.latitude, candidate.longitude)
      if (distance < nearestDistance) {
        nearest = candidate
        nearestDistance = distance
      }
    }

    if (nearestDistance > radiusMeters) return null
    return { ...nearest, distanceMeters: Math.round(nearestDistance) }
  }

  /** Logradouros distintos cadastrados num CEP -- o CEP dos Correios agrupa
   * servidoes/estradas vicinais inteiras sob um unico CEP generico. */
  async findByCep(cep: string) {
    const digits = String(cep || '').replace(/\D/g, '')
    if (digits.length !== 8) return []

    const rows = await this.prisma.ibgeAddress.findMany({
      where: { cep: digits },
      select: { logradouro: true, bairro: true, latitude: true, longitude: true },
      distinct: ['logradouro'],
      orderBy: { logradouro: 'asc' },
      take: 100,
    })
    return rows
  }

  /** Autocomplete de logradouro por nome, opcionalmente restrito a um bairro. */
  async searchLogradouros(term: string, bairro?: string) {
    const query = String(term || '').trim()
    if (query.length < 3) return []

    return this.prisma.ibgeAddress.findMany({
      where: {
        nomeLogradouro: { contains: query, mode: 'insensitive' },
        ...(bairro ? { bairro: { equals: bairro, mode: 'insensitive' } } : {}),
      },
      select: { logradouro: true, bairro: true, cep: true },
      distinct: ['logradouro'],
      orderBy: { logradouro: 'asc' },
      take: 20,
    })
  }
}
