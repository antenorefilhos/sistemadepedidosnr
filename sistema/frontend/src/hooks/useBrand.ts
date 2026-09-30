import { useQuery } from '@tanstack/react-query'
import { brandAPI } from '../services/api'

export interface BrandConfig {
  storeName: string
  logoDesktopUrl: string | null
  logoMobileUrl: string | null
  primaryColor: string
  secondaryColor: string
  contactWhatsapp: string | null
  freeShippingThreshold: number | null
  businessHours: string | null
  /** JSON SpecialDate[] (utils/deliveryOperation.ts): feriados e horario reduzido. */
  specialDates: string | null
  cnpj: string | null
  legalName: string | null
  stateRegistration: string | null
  addressNumber: string | null
  addressCep: string | null
  phoneFixed: string | null
  whatsappSecondary: string | null
  emailCommercial: string | null
  emailDpo: string | null
  traditionText: string | null
  storeHoursText: string | null
  deliveryHoursText: string | null
  /** JSON { hidden: string[] }: blocos da pagina inicial ocultos no admin (Layout do Site). */
  homeLayout?: string | null
}

const DEFAULTS: BrandConfig = {
  storeName: 'Antenor & Filhos',
  logoDesktopUrl: '/branding/logo-horizontal-bordo.png',
  logoMobileUrl: '/branding/logo-branco.png',
  primaryColor: '#5D082A',
  secondaryColor: '#D2BB8A',
  contactWhatsapp: null,
  freeShippingThreshold: null,
  businessHours: null,
  specialDates: null,
  cnpj: null,
  legalName: null,
  stateRegistration: null,
  addressNumber: null,
  addressCep: null,
  phoneFixed: null,
  whatsappSecondary: null,
  emailCommercial: null,
  emailDpo: null,
  traditionText: null,
  storeHoursText: null,
  deliveryHoursText: null,
}

export function useBrand() {
  const { data, isFetched } = useQuery({
    queryKey: ['brand-config'],
    queryFn: async () => {
      const res = await brandAPI.get()
      return res.data as BrandConfig
    },
    staleTime: 1000 * 60 * 10,
  })

  return {
    storeName: data?.storeName ?? DEFAULTS.storeName,
    logoDesktopUrl: data?.logoDesktopUrl ?? DEFAULTS.logoDesktopUrl,
    logoMobileUrl: data?.logoMobileUrl ?? DEFAULTS.logoMobileUrl,
    primaryColor: data?.primaryColor ?? DEFAULTS.primaryColor,
    secondaryColor: data?.secondaryColor ?? DEFAULTS.secondaryColor,
    contactWhatsapp: data?.contactWhatsapp ?? DEFAULTS.contactWhatsapp,
    freeShippingThreshold: data?.freeShippingThreshold ?? null,
    businessHours: data?.businessHours ?? null,
    specialDates: data?.specialDates ?? null,
    cnpj: data?.cnpj ?? null,
    legalName: data?.legalName ?? null,
    stateRegistration: data?.stateRegistration ?? null,
    addressNumber: data?.addressNumber ?? null,
    addressCep: data?.addressCep ?? null,
    phoneFixed: data?.phoneFixed ?? null,
    whatsappSecondary: data?.whatsappSecondary ?? null,
    emailCommercial: data?.emailCommercial ?? null,
    emailDpo: data?.emailDpo ?? null,
    traditionText: data?.traditionText ?? null,
    storeHoursText: data?.storeHoursText ?? null,
    deliveryHoursText: data?.deliveryHoursText ?? null,
    /** null enquanto a config nao chegou -- a Home segura os blocos ocultaveis. */
    homeHidden: isFetched ? parseHomeHidden(data?.homeLayout) : null,
  }
}

function parseHomeHidden(raw?: string | null): Set<string> {
  try {
    const hidden = raw ? (JSON.parse(raw) as { hidden?: unknown }).hidden : []
    return new Set(Array.isArray(hidden) ? hidden.filter((h): h is string => typeof h === 'string') : [])
  } catch {
    return new Set()
  }
}
