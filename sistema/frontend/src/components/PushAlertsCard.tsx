import { BellRing, Check } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { pushStatusMessage } from '../utils/pushMessage'
import { buttonVariants } from './ui/button'
import { cn } from '../lib/cn'

/**
 * Cartao "ativar avisos no celular" (so para quem esta logado: a inscricao
 * fica na conta). Usado em Ofertas ("Saiba primeiro das ofertas") e na Conta
 * ("Avisos do pedido e de ofertas").
 */
export function PushAlertsCard({
  title,
  enabledTitle,
  idleText,
  enabledText,
  actionLabel = 'Ativar',
}: {
  title: string
  enabledTitle: string
  idleText: string
  enabledText: string
  actionLabel?: string
}) {
  const { pushStatus, pushPermission, requestPushPermission, isSubscribingToPush } = useNotifications()
  const enabled = pushStatus === 'enabled'
  const blocked = pushStatus === 'denied' || pushPermission === 'denied'
  return (
    <section className={cn('flex items-start gap-3 rounded-2xl border p-4', enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#E8D7B0] bg-white')}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F8F2E6] text-[#5D082A]')}>
        {enabled ? <Check size={21} /> : <BellRing size={21} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#231F20]">{enabled ? enabledTitle : title}</p>
        <p className="text-xs text-gray-500">{enabled ? enabledText : pushStatusMessage(pushStatus, pushPermission, idleText)}</p>
      </div>
      {!enabled && !blocked && (
        <button
          type="button"
          onClick={() => requestPushPermission()}
          disabled={isSubscribingToPush}
          className={buttonVariants({ size: 'sm', className: 'shrink-0 rounded-full px-4' })}
        >
          {isSubscribingToPush ? 'Ativando…' : actionLabel}
        </button>
      )}
    </section>
  )
}
