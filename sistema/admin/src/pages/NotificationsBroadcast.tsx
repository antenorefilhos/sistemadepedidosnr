import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Send, RefreshCw, Sparkles, Play, History, Search, X, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notificationsAdminAPI, productsAPI } from '../services/api'

export default function NotificationsBroadcast() {
  const [type, setType] = useState<'PROMO' | 'CAMPAIGN'>('PROMO')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [customerId, setCustomerId] = useState('')
  // Produto vinculado: define o destino do clique e a foto grande do balao.
  // A API ja aceitava productId/imageUrl desde sempre -- faltava a tela.
  const [produto, setProduto] = useState<{ id: string; name: string; imageUrl?: string } | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [aiCycleResult, setAiCycleResult] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-notification-status'],
    queryFn: async () => (await notificationsAdminAPI.getAiCycleStatus()).data,
  })

  const toggleAiMut = useMutation({
    mutationFn: (enabled: boolean) => notificationsAdminAPI.toggleAiCycle(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-notification-status'] }),
  })

  const runAiCycleMut = useMutation({
    mutationFn: () => notificationsAdminAPI.runAiCycleNow(),
    onSuccess: (res) => {
      const data = res.data as { candidates?: number; notified?: number; skipped?: number; reason?: string }
      if (data.reason) {
        setAiCycleResult(`Nao rodou: ${data.reason}`)
      } else {
        setAiCycleResult(`${data.candidates ?? 0} candidato(s) avaliados, ${data.notified ?? 0} notificado(s).`)
      }
      queryClient.invalidateQueries({ queryKey: ['notification-history'] })
    },
    onError: () => setAiCycleResult('Falha ao rodar o ciclo. Tente novamente.'),
  })

  // Busca so dispara com 3+ caracteres: a lista tem ~15 mil produtos e uma
  // query por tecla digitada e desperdicio puro.
  const { data: resultadosBusca = [] } = useQuery({
    queryKey: ['broadcast-produtos', buscaProduto],
    enabled: buscaProduto.trim().length >= 3,
    queryFn: async () => {
      const res = await productsAPI.getAdmin({ search: buscaProduto.trim(), limit: 8 })
      const d = res.data as { products?: Array<{ id: string; name: string; imageUrl?: string; image?: string }> }
      return (d.products ?? []).map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl || p.image }))
    },
  })

  const { data: historico = [], isLoading: carregandoHistorico } = useQuery({
    queryKey: ['notification-history'],
    queryFn: async () => (await notificationsAdminAPI.history({ limit: 40 })).data,
  })

  const broadcastMut = useMutation({
    mutationFn: () =>
      notificationsAdminAPI.broadcast({
        type,
        title: title.trim(),
        body: body.trim(),
        customerId: customerId.trim() || undefined,
        productId: produto?.id,
        imageUrl: produto?.imageUrl,
      }),
    onSuccess: (res) => {
      const count = (res.data as { count?: number })?.count ?? 0
      setResult({ type: 'success', message: `Notificação enviada para ${count} cliente(s).` })
      setTitle('')
      setBody('')
      setCustomerId('')
      setProduto(null)
      setBuscaProduto('')
      queryClient.invalidateQueries({ queryKey: ['notification-history'] })
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

      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="text-[#5D082A] mt-0.5 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-gray-800">Notificação automática por IA</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Quando ligado, a IA olha as promoções ativas 3x por dia e decide sozinha quando vale notificar os clientes.
              </p>
            </div>
          </div>
          <Switch
            checked={Boolean(aiStatus?.enabled)}
            onChange={(checked) => toggleAiMut.mutate(checked)}
            disabled={toggleAiMut.isPending}
            aria-label="Ligar notificação automática por IA"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setAiCycleResult(null); runAiCycleMut.mutate() }}
            disabled={runAiCycleMut.isPending}
          >
            {runAiCycleMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {runAiCycleMut.isPending ? 'Rodando...' : 'Rodar agora (teste)'}
          </Button>
          {aiCycleResult && <span className="text-xs text-gray-500">{aiCycleResult}</span>}
        </div>
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
          <Label htmlFor="notification-customer" className="block text-xs font-semibold text-gray-600 mb-1">ID do Cliente (opcional)</Label>
          <Input
            id="notification-customer"
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="Se vazio, envia para todos os clientes ativos"
            className="font-mono"
          />
        </div>

        <div>
          <Label htmlFor="notification-produto" className="block text-xs font-semibold text-gray-600 mb-1">
            Produto (opcional)
          </Label>
          {produto ? (
            <div className="flex items-center gap-3 rounded-lg border border-[#E8D7B0] bg-[#FDF8F0] px-3 py-2">
              {produto.imageUrl ? (
                <img src={produto.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white text-gray-300">
                  <Package size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{produto.name}</p>
                <p className="text-xs text-gray-500">Ao tocar no aviso, o cliente abre este produto.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setProduto(null)} aria-label="Remover produto">
                <X size={14} />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="notification-produto"
                  type="text"
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  placeholder="Busque por nome para anexar foto e link do produto"
                  className="pl-9"
                />
              </div>
              {resultadosBusca.length > 0 && (
                <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  {resultadosBusca.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => { setProduto(p); setBuscaProduto('') }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#FDF8F0]"
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-50 text-gray-300"><Package size={14} /></div>
                        )}
                        <span className="truncate text-sm text-gray-700">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Sem produto, o aviso abre a página inicial da loja.
              </p>
            </>
          )}
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

      {/* Auditoria. Nao existe entidade "disparo" no banco -- cada envio grava
          uma linha por cliente, e o agrupamento e reconstruido por titulo,
          corpo e minuto no backend. Serve pra responder "o que ja saiu e
          quando", que era impossivel sem consultar o banco na mao. */}
      <div className="mt-6 rounded-xl border border-[#f1dbe3] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <History size={18} className="text-[#5D082A]" />
          <h2 className="text-lg font-bold text-gray-800">Histórico de disparos</h2>
        </div>

        {carregandoHistorico ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum disparo registrado ainda.</p>
        ) : (
          <ul className="space-y-4">
            {historico.map((d, i) => (
              <li key={`${d.title}-${d.sentAt}-${i}`}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Enviado {new Date(d.sentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {d.type === 'PROMO' && (
                    <span className="rounded-full bg-[#FDF8F0] px-2 py-0.5 text-[10px] font-bold text-[#5D082A]">PROMOÇÃO</span>
                  )}
                  {d.type === 'CAMPAIGN' && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">CAMPANHA</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {d.recipients} cliente(s) · {d.reads} leram
                  </span>
                </div>
                {/* A barra à esquerda é o formato que o Jonathan desenhou:
                    a leitura vertical rápida importa mais que a tabela. */}
                <div className="mt-1 border-l-2 border-[#E8D7B0] pl-3">
                  <p className="text-sm font-semibold text-gray-800">{d.title}</p>
                  <p className="text-sm text-gray-600">{d.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          "Leram" conta quem abriu o aviso dentro da loja. Não é o mesmo que entrega:
          o sistema ainda não registra se o push chegou ao aparelho.
        </p>
      </div>
    </div>
  )
}
