import { CheckCircle2, AlertTriangle, Banknote, QrCode, CreditCard } from 'lucide-react'
import { formatPrice } from '../utils/format'
import { PAYMENT_METHOD_LABEL } from '../utils/checkout'
import { Button, buttonVariants } from './ui/button'
import { CriarSenhaCard } from './CriarSenhaCard'
import type { Order } from '../types'
import type { WhatsAppDispatch } from '../services/api'

/** Tela final de sucesso do Checkout -- extraida (JON-65, Auditoria 360) por
 * ser autocontida (so le `createdOrder`/`whatsappDispatch`, sem estado
 * proprio de formulario/pagamento). */
export function OrderConfirmation({
  createdOrder, whatsappDispatch, contaSemSenha, onContinueShopping,
}: {
  createdOrder: Order | null;
  whatsappDispatch: WhatsAppDispatch | null;
  contaSemSenha: boolean;
  onContinueShopping: () => void;
}) {
  return (
    <div className="bg-white border border-[#D2BB8A]/40 rounded-2xl p-8 text-center shadow-[0_12px_40px_rgba(93,8,42,0.04)] animate-in fade-in zoom-in duration-300">
      <div className="w-16 h-16 rounded-full bg-[#FFF7FA] border border-[#5D082A]/15 flex items-center justify-center mx-auto mb-5 text-[#5D082A] shadow-inner">
        <CheckCircle2 size={36} className="animate-in zoom-in-50 duration-500 motion-reduce:animate-none" />
      </div>
      <h2 className="text-2xl font-bold text-[#5D082A] mb-2">Pedido Confirmado!</h2>
      <p className="text-gray-600 mb-6 text-sm">
        Seu pedido já está pronto para ser enviado no WhatsApp com todos os detalhes.
      </p>
      {createdOrder && (() => {
        const methodKey = String(createdOrder.paymentMethod || 'CASH').toUpperCase()
        const badgeLabel = PAYMENT_METHOD_LABEL[methodKey] || createdOrder.paymentMethod || 'Dinheiro'
        const badgeIcon = methodKey === 'PIX' ? <QrCode size={12} className="text-[#5D082A]" /> : methodKey === 'CARD' ? <CreditCard size={12} className="text-[#5D082A]" /> : <Banknote size={12} className="text-[#5D082A]" />
        const changeAmount = createdOrder.notes?.match(/Troco para:\s*([^)]*)/)?.[1]

        return (
          <div className="mb-6 rounded-xl border border-[#E8D7B0]/60 bg-[#FBFAF7] p-5 text-left space-y-4 shadow-sm">
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm border-b border-[#E8D7B0]/30 pb-3">
              <span className="text-gray-500 font-medium">Pedido</span>
              <span className="font-mono text-right text-gray-800 font-bold">#{createdOrder.id.slice(-8).toUpperCase()}</span>

              <span className="text-gray-500 font-medium">Pagamento</span>
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F8F0DC] px-2 py-0.5 text-xs font-semibold text-[#5D082A] border border-[#E8D7B0]/40">
                  {badgeIcon}
                  {badgeLabel}
                </span>
              </div>

              {(() => {
                const pStatus = String(createdOrder.paymentStatus || 'UNPAID').toUpperCase()
                const statusConfig: Record<string, { label: string; cls: string }> = {
                  PAID: { label: 'Pago', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                  AUTHORIZED: { label: 'Autorizado', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
                  PENDING: { label: 'Pagamento pendente', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                  FAILED: { label: 'Pagamento falhou', cls: 'bg-red-50 text-red-800 border-red-200' },
                  UNPAID: { label: 'Aguardando pagamento', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                }
                const cfg = statusConfig[pStatus] ?? { label: pStatus, cls: 'bg-gray-50 text-gray-700 border-gray-200' }
                return (
                  <>
                    <span className="text-gray-500 font-medium">Status</span>
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </>
                )
              })()}

              {methodKey === 'CASH' && changeAmount && (
                <>
                  <span className="text-gray-500 font-medium">Troco</span>
                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                      <Banknote size={12} className="text-amber-700" />
                      Troco para R$ {changeAmount}
                    </span>
                  </div>
                </>
              )}

              <span className="text-gray-500 font-semibold text-base mt-1">Total</span>
              <span className="font-bold text-right text-base text-[#5D082A] mt-1">{formatPrice(createdOrder.total)}</span>
            </div>

            <div className="rounded-xl bg-[#FFF7FA] border border-[#5D082A]/10 p-3.5 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-[#5D082A] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                O valor final será confirmado pela equipe após a separação dos itens (em função do peso real e possíveis substituições).
              </p>
            </div>
          </div>
        )
      })()}
      {contaSemSenha && <CriarSenhaCard />}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {whatsappDispatch?.url && (
          <a
            href={whatsappDispatch.url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'primary', size: 'md' })}
          >
            Enviar no WhatsApp
          </a>
        )}
        <Button onClick={onContinueShopping} variant="secondary">
          Continuar comprando
        </Button>
      </div>
    </div>
  )
}
