import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, X, Ticket, Users, Truck, Pencil, Trash2, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { couponsAdminAPI, notificationsAdminAPI, type CouponPromotion } from '../services/api'

function formatMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Coupons() {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENT_OFF' | 'FIXED_OFF' | 'FREE_SHIPPING'>('PERCENT_OFF')
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

  const resetForm = () => {
    setEditingId(null)
    setName(''); setCode(''); setValue(''); setMaxDiscount(''); setMinSubtotal('')
    setMaxUses(''); setMaxUsesPerCustomer(''); setStartsAt(''); setEndsAt(''); setNotifyCustomers(false); setError(null)
  }

  const startCreate = () => { resetForm(); setOpen(true) }

  const startEdit = (p: CouponPromotion) => {
    const coupon = p.coupons[0]
    const effect = p.rules[0]?.effect as { type?: string; percent?: number; amount?: number; maxDiscount?: number } | undefined
    const condition = p.rules[0]?.condition as { minSubtotal?: number } | undefined
    setEditingId(p.id)
    setName(p.name)
    setCode(coupon?.code || '')
    const type = (effect?.type as typeof discountType) || 'PERCENT_OFF'
    setDiscountType(type)
    setValue(type === 'FREE_SHIPPING' ? '' : String(effect?.percent ?? effect?.amount ?? ''))
    setMaxDiscount(effect?.maxDiscount != null ? String(effect.maxDiscount) : '')
    setMinSubtotal(condition?.minSubtotal != null ? String(condition.minSubtotal) : '')
    setMaxUses(coupon?.maxUses != null ? String(coupon.maxUses) : '')
    setMaxUsesPerCustomer(coupon?.maxUsesPerCustomer != null ? String(coupon.maxUsesPerCustomer) : '')
    setStartsAt(toDatetimeLocal(p.startsAt))
    setEndsAt(p.endsAt.slice(0, 10))
    setNotifyCustomers(false)
    setError(null)
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const effect =
        discountType === 'FREE_SHIPPING'
          ? { type: 'FREE_SHIPPING' as const }
          : {
              type: discountType,
              ...(discountType === 'PERCENT_OFF' ? { percent: Number(value) } : { amount: Number(value) }),
              ...(maxDiscount ? { maxDiscount: Number(maxDiscount) } : {}),
            }
      const condition = minSubtotal ? { minSubtotal: Number(minSubtotal) } : undefined

      if (editingId) {
        return couponsAdminAPI.update(editingId, {
          name: name.trim() || `Cupom ${code.trim().toUpperCase()}`,
          couponCode: code.trim().toUpperCase(),
          effect,
          condition,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          maxUses: maxUses ? Number(maxUses) : null,
          maxUsesPerCustomer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : null,
        })
      }

      const promo = await couponsAdminAPI.create({
        name: name.trim() || `Cupom ${code.trim().toUpperCase()}`,
        couponCode: code.trim().toUpperCase(),
        effect,
        condition,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        maxUsesPerCustomer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : undefined,
        status: 'ACTIVE',
      })
      if (notifyCustomers) {
        const desconto =
          discountType === 'FREE_SHIPPING'
            ? 'frete grátis'
            : discountType === 'PERCENT_OFF'
              ? `${value}% de desconto`
              : `${formatMoney(Number(value))} de desconto`
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
      resetForm()
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Erro ao salvar cupom.'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (p: CouponPromotion) => couponsAdminAPI.update(p.id, { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons-admin'] }),
  })

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => couponsAdminAPI.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coupons-admin'] }); setDeleteError(null) },
    onError: (err: any) => setDeleteError(err?.response?.data?.message || 'Erro ao apagar cupom.'),
  })

  const canSubmit = code.trim().length > 0 && (discountType === 'FREE_SHIPPING' || Number(value) > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Tag size={22} /> Cupons
          </h1>
          <p className="text-sm text-gray-500">Cupons de desconto que o cliente digita no checkout.</p>
        </div>
        <Button onClick={startCreate}>
          <Plus size={16} className="mr-1" /> Novo cupom
        </Button>
      </div>

      {open && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Editar cupom' : 'Criar cupom'}</h2>
            <button onClick={() => { setOpen(false); resetForm() }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="mb-1 block text-sm font-semibold text-gray-800">1. Qual palavra o cliente vai digitar?</Label>
              <p className="mb-2 text-xs text-gray-500">É o código do cupom. Escolha algo fácil de lembrar e escrever.</p>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: FRETEGRATIS" className="font-mono text-lg uppercase" />
            </div>

            <div>
              <Label className="mb-1 block text-sm font-semibold text-gray-800">2. Que desconto o cliente ganha?</Label>
              <p className="mb-2 text-xs text-gray-500">Escolha um percentual (ex: "10% de desconto"), um valor em reais (ex: "R$ 20 de desconto") ou frete grátis.</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENT_OFF')}
                  className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition ${discountType === 'PERCENT_OFF' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}
                >
                  Porcentagem (%)
                  <p className="mt-0.5 text-xs font-normal text-gray-500">Ex: 10% de desconto</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('FIXED_OFF')}
                  className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition ${discountType === 'FIXED_OFF' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}
                >
                  Valor em reais (R$)
                  <p className="mt-0.5 text-xs font-normal text-gray-500">Ex: R$ 20 de desconto</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('FREE_SHIPPING')}
                  className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition ${discountType === 'FREE_SHIPPING' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}
                >
                  <span className="flex items-center gap-1"><Truck size={14} /> Frete grátis</span>
                  <p className="mt-0.5 text-xs font-normal text-gray-500">Zera a taxa de entrega</p>
                </button>
              </div>
              {discountType !== 'FREE_SHIPPING' && (
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={discountType === 'PERCENT_OFF' ? 'Ex: 10' : 'Ex: 20'}
                    className="text-lg"
                  />
                  <span className="text-lg font-bold text-gray-500">{discountType === 'PERCENT_OFF' ? '%' : 'R$'}</span>
                </div>
              )}
              {discountType === 'PERCENT_OFF' && (
                <div className="mt-2">
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Quer travar um valor máximo de desconto em reais? (não obrigatório)</Label>
                  <Input type="number" min="0" step="0.01" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="Deixe em branco = sem limite" />
                </div>
              )}
            </div>

            <div>
              <Label className="mb-1 block text-sm font-semibold text-gray-800">3. Quantas pessoas podem usar?</Label>
              <p className="mb-2 text-xs text-gray-500">Deixe em branco para "sem limite". Para uma promoção de poucas vagas (ex: "10 cupons, corre!"), coloque o número aqui.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Quantidade total de vezes</Label>
                  <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Sem limite" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Vezes por cliente</Label>
                  <Input type="number" min="1" value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} placeholder="Sem limite" />
                </div>
              </div>
            </div>

            <details className="group rounded-lg border border-gray-100 bg-gray-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">Mais opções (só se precisar)</summary>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Nome pra você lembrar (não aparece pro cliente)</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção de aniversário" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Só vale a partir de quanto no carrinho?</Label>
                  <Input type="number" min="0" step="0.01" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="Sem mínimo" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Programar pra começar depois (data e hora)</Label>
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  <p className="mt-1 text-xs text-gray-400">Deixe em branco pra valer agora mesmo.</p>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-gray-500">Até quando vale?</Label>
                  <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
              </div>
            </details>
          </div>

          {!editingId && (
            <div className="mt-5 flex items-center gap-3 rounded-md bg-amber-50 p-3">
              <Switch checked={notifyCustomers} onChange={setNotifyCustomers} />
              <Users size={18} className="shrink-0 text-amber-700" />
              <span className="text-sm text-amber-800">Avisar todos os clientes no celular quando eu criar esse cupom</span>
            </div>
          )}

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancelar</Button>
            <Button disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="px-6 text-base">
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar cupom'}
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
                <th className="px-4 py-3">Quantas vezes já foi usado</th>
                <th className="px-4 py-3">Vale até</th>
                <th className="px-4 py-3">Está ativo?</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => {
                const effect = p.rules[0]?.effect as { type?: string; percent?: number; amount?: number } | undefined
                const coupon = p.coupons[0]
                const hasUsage = (p._count?.usages ?? 0) > 0
                return (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-mono font-semibold">{coupon?.code}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">
                      {effect?.type === 'FREE_SHIPPING'
                        ? 'Frete grátis'
                        : effect?.type === 'PERCENT_OFF'
                          ? `${effect.percent}%`
                          : effect?.amount
                            ? formatMoney(effect.amount)
                            : '—'}
                    </td>
                    <td className="px-4 py-3">{p._count?.usages ?? 0}{coupon?.maxUses ? ` / ${coupon.maxUses}` : ''}</td>
                    <td className="px-4 py-3">{new Date(p.endsAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'ACTIVE' ? 'Ativo' : p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => startEdit(p)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          title={p.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}
                          onClick={() => toggleActiveMutation.mutate(p)}
                          disabled={toggleActiveMutation.isPending}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                        >
                          {p.status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button
                          type="button"
                          title={hasUsage ? 'Já foi usado em pedido real -- pause em vez de apagar' : 'Apagar'}
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (hasUsage) {
                              setDeleteError('Esse cupom já foi usado em pedidos reais -- não pode ser apagado. Pause-o em vez disso.')
                              return
                            }
                            if (window.confirm(`Apagar o cupom ${coupon?.code}? Essa ação não pode ser desfeita.`)) {
                              deleteMutation.mutate(p.id)
                            }
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {deleteError && <p className="border-t border-gray-100 p-3 text-sm font-medium text-red-600">{deleteError}</p>}
      </div>
    </div>
  )
}
