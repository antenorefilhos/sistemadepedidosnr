import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, X, Ticket, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { couponsAdminAPI, notificationsAdminAPI } from '../services/api'

function formatMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Coupons() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENT_OFF' | 'FIXED_OFF'>('PERCENT_OFF')
  const [value, setValue] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minSubtotal, setMinSubtotal] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [notifyCustomers, setNotifyCustomers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['coupons-admin'],
    queryFn: () => couponsAdminAPI.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const promo = await couponsAdminAPI.create({
        name: name.trim() || `Cupom ${code.trim().toUpperCase()}`,
        couponCode: code.trim().toUpperCase(),
        effect: {
          type: discountType,
          ...(discountType === 'PERCENT_OFF' ? { percent: Number(value) } : { amount: Number(value) }),
          ...(maxDiscount ? { maxDiscount: Number(maxDiscount) } : {}),
        },
        condition: minSubtotal ? { minSubtotal: Number(minSubtotal) } : undefined,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        maxUsesPerCustomer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : undefined,
        status: 'ACTIVE',
      })
      if (notifyCustomers) {
        const desconto = discountType === 'PERCENT_OFF' ? `${value}% de desconto` : `${formatMoney(Number(value))} de desconto`
        const dispara = startsAt ? new Date(startsAt) : null
        await notificationsAdminAPI.broadcast({
          type: 'CAMPAIGN',
          title: '🎁 Novo cupom disponível!',
          body: `Use o código ${code.trim().toUpperCase()} e garanta ${desconto} na sua compra.`,
          // Se o cupom tem inicio programado no futuro, a notificacao dispara
          // no mesmo instante -- avisar antes do cupom valer so gera erro no
          // checkout de quem correr primeiro.
          sendAt: dispara && dispara.getTime() > Date.now() ? dispara.toISOString() : undefined,
        })
      }
      return promo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-admin'] })
      setOpen(false)
      setName(''); setCode(''); setValue(''); setMaxDiscount(''); setMinSubtotal('')
      setMaxUses(''); setMaxUsesPerCustomer(''); setEndsAt(''); setNotifyCustomers(false); setError(null)
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Erro ao criar cupom.'),
  })

  const canSubmit = code.trim().length > 0 && Number(value) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Tag size={22} /> Cupons
          </h1>
          <p className="text-sm text-gray-500">Cupons de desconto que o cliente digita no checkout.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-1" /> Novo cupom
        </Button>
      </div>

      {open && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Criar cupom</h2>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Código *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: BEMVINDO10" className="font-mono uppercase" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Nome interno</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas 10%" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Tipo de desconto</Label>
              <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENT_OFF' | 'FIXED_OFF')}>
                <option value="PERCENT_OFF">Percentual (%)</option>
                <option value="FIXED_OFF">Valor fixo (R$)</option>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">
                Valor {discountType === 'PERCENT_OFF' ? '(%)' : '(R$)'} *
              </Label>
              <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            {discountType === 'PERCENT_OFF' && (
              <div>
                <Label className="mb-1 block text-xs font-semibold text-gray-600">Desconto máximo (R$, opcional)</Label>
                <Input type="number" min="0" step="0.01" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="Sem limite" />
              </div>
            )}
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Pedido mínimo (R$, opcional)</Label>
              <Input type="number" min="0" step="0.01" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="Sem mínimo" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Início (opcional, agenda pra depois)</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Validade até (opcional)</Label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Limite total de usos (opcional)</Label>
              <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Sem limite" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-gray-600">Limite por cliente (opcional)</Label>
              <Input type="number" min="1" value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} placeholder="Sem limite" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-md bg-amber-50 p-3">
            <Switch checked={notifyCustomers} onChange={setNotifyCustomers} />
            <Users size={16} className="text-amber-700" />
            <span className="text-sm text-amber-800">Notificar todos os clientes por push ao criar</span>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Criando...' : 'Criar cupom'}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Carregando...</p>
        ) : !promotions?.length ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-gray-400">
            <Ticket size={32} />
            <p className="text-sm">Nenhum cupom criado ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => {
                const effect = p.rules[0]?.effect as { type?: string; percent?: number; amount?: number } | undefined
                const coupon = p.coupons[0]
                return (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-mono font-semibold">{coupon?.code}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">
                      {effect?.type === 'PERCENT_OFF' ? `${effect.percent}%` : effect?.amount ? formatMoney(effect.amount) : '—'}
                    </td>
                    <td className="px-4 py-3">{p._count?.usages ?? 0}{coupon?.maxUses ? ` / ${coupon.maxUses}` : ''}</td>
                    <td className="px-4 py-3">{new Date(p.endsAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'ACTIVE' ? 'Ativo' : p.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
