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
  openMessage: string | null
  closedMessage: string | null
  countdownLabel: string | null
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
  openMessage: null,
  closedMessage: null,
  countdownLabel: null,
}

export function useBrand() {
  const { data } = useQuery({
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
    freeShippingThreshold: (data as BrandConfig | undefined)?.freeShippingThreshold ?? null,
    businessHours: (data as BrandConfig | undefined)?.businessHours ?? null,
    openMessage: (data as BrandConfig | undefined)?.openMessage ?? null,
    closedMessage: (data as BrandConfig | undefined)?.closedMessage ?? null,
    countdownLabel: (data as BrandConfig | undefined)?.countdownLabel ?? null,
  }
}
