import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, Send, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { notificationsAdminAPI } from '../services/api'

export default function NotificationsBroadcast() {
  const [type, setType] = useState<'PROMO' | 'CAMPAIGN'>('PROMO')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const broadcastMut = useMutation({
    mutationFn: () =>
      notificationsAdminAPI.broadcast({
        type,
        title: title.trim(),
        body: body.trim(),
        customerId: customerId.trim() || undefined,
      }),
    onSuccess: (res) => {
      const count = (res.data as { count?: number })?.count ?? 0
      setResult({ type: 'success', message: `Notificação enviada para ${count} cliente(s).` })
      setTitle('')
      setBody('')
      setCustomerId('')
    },
    onError: () => {
      setResult({ type: 'error', message: 'Falha ao enviar notificação. Verifique os campos e tente novamente.' })
    },
  })

  const canSend = title.trim().length > 0 && body.trim().length > 0

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Notificações</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
        <p className="text-sm font-semibold text-gray-700">Broadcast de campanha</p>

        <div>
          <Label htmlFor="notification-type" className="block text-xs font-semibold text-gray-600 mb-1">Tipo</Label>
          <Select
            id="notification-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'PROMO' | 'CAMPAIGN')}
          >
            <option value="PROMO">Promoção</option>
            <option value="CAMPAIGN">Campanha</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="notification-title" className="block text-xs font-semibold text-gray-600 mb-1">Título</Label>
          <Input
            id="notification-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Oferta relâmpago na seção de carnes"
          />
        </div>

        <div>
          <Label htmlFor="notification-body" className="block text-xs font-semibold text-gray-600 mb-1">Mensagem</Label>
          <Textarea
            id="notification-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ex: Só até às 22h: 20% OFF em itens selecionados"
            rows={4}
            className="resize-y"
          />
        </div>

        <div>
          <Label htmlFor="notification-customer" className="block text-xs font-semibold text-gray-600 mb-1">Customer ID (opcional)</Label>
          <Input
            id="notification-customer"
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="Se vazio, envia para todos os clientes ativos"
            className="font-mono"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => broadcastMut.mutate()}
            disabled={!canSend || broadcastMut.isPending}
          >
            {broadcastMut.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            {broadcastMut.isPending ? 'Enviando...' : 'Enviar notificação'}
          </Button>
        </div>

        {result && (
          <p
            className={
              result.type === 'success'
                ? 'text-xs text-[#5D082A] bg-[#FDF8F0] border border-[#E8D7B0] rounded px-3 py-2'
                : 'text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2'
            }
          >
            {result.message}
          </p>
        )}
      </div>
    </div>
  )
}
