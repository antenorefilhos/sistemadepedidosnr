import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Send, RefreshCw, Sparkles, Play, History, Search, X, Package, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cmsAPI, notificationsAdminAPI, productsAPI, resolveApiUrl } from '../services/api'

/** <img> que esconde o quadrado quebrado quando a foto do produto nao existe
 * em /uploads/products/<ean>.webp -- so ~2/3 do catalogo tem arquivo la (uma
 * lacuna de dado, nao um bug de codigo). Sem isso a busca de produto e a
 * pre-visualizacao ficavam cheias de icone de imagem quebrada. */
function ProductThumb({ src, size = 32 }: { src?: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded bg-gray-100 text-gray-300"
        style={{ width: size, height: size }}
      >
        <Package size={Math.round(size * 0.5)} />
      </div>
    )
  }
  return (
    <img
      src={resolveApiUrl(src) ?? src}
      alt=""
      className="shrink-0 rounded object-cover"
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
    />
  )
}

export default function NotificationsBroadcast() {
  const [type, setType] = useState<'PROMO' | 'CAMPAIGN'>('PROMO')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [customerId, setCustomerId] = useState('')
  // Produto vinculado: define o destino do clique e a foto grande do balao.
  const [produto, setProduto] = useState<{ id: string; name: string; imageUrl?: string } | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  // Banner: o clique replica o destino programado nele. Exclusivo com produto --
  // escolher um limpa o outro (os dois so fazem sentido junto se a foto/link
  // combinar por acidente, o que confunde mais do que ajuda).
  const [bannerId, setBannerId] = useState('')
  // Segmentacao (JON-2): so tem efeito quando customerId estiver vazio.
  const [inactiveDays, setInactiveDays] = useState('')
  const [purchasedCategory, setPurchasedCategory] = useState('')
  const [sendAt, setSendAt] = useState('')
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
        setAiCycleResult(`Não rodou: ${data.reason}`)
      } else {
        setAiCycleResult(`${data.candidates ?? 0} candidato(s) avaliados, ${data.notified ?? 0} notificado(s).`)
      }
      queryClient.invalidateQueries({ queryKey: ['notification-history'] })
      queryClient.invalidateQueries({ queryKey: ['notification-history-counts'] })
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
      const d = res.data as { data?: Array<{ id: string; name: string; ean?: string }> }
      // O produto nao carrega campo de imagem: a foto vive por convencao em
      // /uploads/products/<ean>.webp, mesma que o ciclo da IA ja usava.
      return (d.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.ean ? `/uploads/products/${p.ean}.webp` : undefined,
      }))
    },
  })

  const { data: banners = [] } = useQuery({
    queryKey: ['broadcast-banners'],
    queryFn: async () => {
      const res = await cmsAPI.storeBanners.getAll()
      const lista = (res.data as Array<{ id: string; title?: string; name?: string; slot: string; active: boolean; linkType?: string; linkValue?: string; desktopImageUrl?: string }>) ?? []
      return lista.filter((b) => b.active)
    },
  })

  // "Todas" aqui ja significa PROMO+CAMPAIGN (o default do backend) -- so
  // "Pedidos" e "Tudo" pedem filtro explicito. Sem essa aba, ORDER_UPDATE
  // (um por mudanca de status, MUITOS por pedido) afoga a auditoria de
  // campanha assim que a loja tiver volume real -- ja tem 74 registros
  // dessas com so um punhado de pedidos de teste.
  const [abaHistorico, setAbaHistorico] = useState<'CAMPANHAS' | 'PEDIDOS' | 'TUDO'>('CAMPANHAS')
  const [paginaHistorico, setPaginaHistorico] = useState(0)
  const HISTORICO_POR_PAGINA = 20
  const tipoParaApi = abaHistorico === 'CAMPANHAS' ? undefined : abaHistorico === 'PEDIDOS' ? 'ORDER_UPDATE' : 'ALL'

  const { data: contagens } = useQuery({
    queryKey: ['notification-history-counts'],
    queryFn: async () => (await notificationsAdminAPI.historyCounts()).data,
  })
  const totalCampanhas = (contagens?.PROMO ?? 0) + (contagens?.CAMPAIGN ?? 0)
  const totalPedidos = contagens?.ORDER_UPDATE ?? 0

  const { data: historicoResp, isLoading: carregandoHistorico } = useQuery({
    queryKey: ['notification-history', abaHistorico, paginaHistorico],
    queryFn: async () =>
      (
        await notificationsAdminAPI.history({
          limit: HISTORICO_POR_PAGINA,
          offset: paginaHistorico * HISTORICO_POR_PAGINA,
          type: tipoParaApi,
        })
      ).data,
  })
  const historico = historicoResp?.items ?? []
  const temMaisHistorico = historicoResp?.hasMore ?? false

  // Contagem previa: so faz sentido quando algum filtro esta ativo e nao ha
  // customerId (que ja bypassa a segmentacao). Barato, entao mostra sempre.
  const segmentoAtivo = !customerId.trim() && (Boolean(inactiveDays) || purchasedCategory.trim().length > 0)
  const { data: segmentCount, isFetching: contandoSegmento } = useQuery({
    queryKey: ['broadcast-segment-count', inactiveDays, purchasedCategory],
    enabled: segmentoAtivo,
    queryFn: async () =>
      (
        await notificationsAdminAPI.segmentCount({
          inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
          purchasedCategory: purchasedCategory.trim() || undefined,
        })
      ).data.count,
  })

  const bannerSelecionado = banners.find((b) => b.id === bannerId)
  // O que vai de fato na notificacao: mesma regra do backend (banner vence
  // produto). Mostrar isso explicito e o que evita mandar com a imagem do
  // teste anterior sem perceber -- o motivo dos prints de "chegou com a foto
  // errada" desta sessao.
  const previewImage = bannerId ? bannerSelecionado?.desktopImageUrl : produto?.imageUrl
  const previewLabel = bannerId ? `Banner: ${bannerSelecionado?.title || bannerSelecionado?.name || 'sem título'}` : produto ? `Produto: ${produto.name}` : 'Sem imagem — abre a página inicial da loja'

  const agendando = Boolean(sendAt) && new Date(sendAt).getTime() > Date.now()

  const broadcastMut = useMutation({
    mutationFn: () =>
      notificationsAdminAPI.broadcast({
        type,
        title: title.trim(),
        body: body.trim(),
        customerId: customerId.trim() || undefined,
        productId: bannerId ? undefined : produto?.id,
        imageUrl: bannerId ? undefined : produto?.imageUrl,
        bannerId: bannerId || undefined,
        inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
        purchasedCategory: purchasedCategory.trim() || undefined,
        sendAt: sendAt ? new Date(sendAt).toISOString() : undefined,
      }),
    onSuccess: (res) => {
      const data = res.data as { count?: number; scheduled?: boolean; sendAt?: string }
      setResult(
        data.scheduled
          ? { type: 'success', message: `Notificação agendada para ${new Date(data.sendAt || sendAt).toLocaleString('pt-BR')}.` }
          : { type: 'success', message: `Notificação enviada para ${data.count ?? 0} cliente(s).` },
      )
      setTitle('')
      setBody('')
      setCustomerId('')
      setProduto(null)
      setBuscaProduto('')
      setBannerId('')
      setInactiveDays('')
      setPurchasedCategory('')
      setSendAt('')
      queryClient.invalidateQueries({ queryKey: ['notification-history'] })
      queryClient.invalidateQueries({ queryKey: ['notification-history-counts'] })
      queryClient.invalidateQueries({ queryKey: ['scheduled-broadcasts'] })
    },
    onError: () => {
      setResult({ type: 'error', message: 'Falha ao enviar notificação. Verifique os campos e tente novamente.' })
    },
  })

  const { data: agendados = [] } = useQuery({
    queryKey: ['scheduled-broadcasts'],
    queryFn: async () => (await notificationsAdminAPI.listScheduled()).data,
  })

  const cancelScheduledMut = useMutation({
    mutationFn: (id: string) => notificationsAdminAPI.cancelScheduled(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-broadcasts'] }),
  })

  const canSend = title.trim().length > 0 && body.trim().length > 0

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Notificações</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Coluna principal: o envio de verdade */}
        <div className="bg-white border-2 border-[#5D082A]/15 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Send className="text-[#5D082A]" size={18} />
            <p className="text-sm font-bold text-[#5D082A] uppercase tracking-wide">Enviar notificação</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label htmlFor="notification-customer" className="block text-xs font-semibold text-gray-600 mb-1">ID do Cliente (opcional)</Label>
              <Input
                id="notification-customer"
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Vazio = todos os clientes"
                className="font-mono"
              />
            </div>
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
              rows={3}
              className="resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="notification-produto" className="block text-xs font-semibold text-gray-600 mb-1">
                Produto (opcional)
              </Label>
              {produto ? (
                <div className="flex items-center gap-3 rounded-lg border border-[#E8D7B0] bg-[#FDF8F0] px-3 py-2">
                  <ProductThumb src={produto.imageUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{produto.name}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setProduto(null)} aria-label="Remover produto">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="notification-produto"
                    type="text"
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="pl-9"
                  />
                  {resultadosBusca.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {resultadosBusca.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setProduto(p); setBuscaProduto(''); setBannerId('') }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#FDF8F0]"
                          >
                            <ProductThumb src={p.imageUrl} size={28} />
                            <span className="truncate text-sm text-gray-700">{p.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notification-banner" className="block text-xs font-semibold text-gray-600 mb-1">
                Ou banner (opcional)
              </Label>
              <Select
                id="notification-banner"
                value={bannerId}
                onChange={(e) => { setBannerId(e.target.value); if (e.target.value) setProduto(null) }}
              >
                <option value="">Nenhum</option>
                {banners.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b.title || b.name || 'Sem título')} — {b.slot}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-400">
            Produto e banner são exclusivos: escolher um limpa o outro. Sem nenhum dos dois, o aviso abre a página inicial da loja.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <Label htmlFor="notification-inactive" className="block text-xs font-semibold text-gray-600 mb-1">Sem pedido há</Label>
              <Select
                id="notification-inactive"
                value={inactiveDays}
                onChange={(e) => setInactiveDays(e.target.value)}
                disabled={Boolean(customerId.trim())}
              >
                <option value="">Todos</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="notification-category" className="block text-xs font-semibold text-gray-600 mb-1">Categoria comprada</Label>
              <Input
                id="notification-category"
                type="text"
                value={purchasedCategory}
                onChange={(e) => setPurchasedCategory(e.target.value)}
                placeholder="Ex: Bebidas"
                disabled={Boolean(customerId.trim())}
              />
            </div>
          </div>
          {segmentoAtivo && (
            <p className="-mt-2 text-xs text-gray-500">
              {contandoSegmento ? 'Contando clientes...' : `Alcançaria ${segmentCount ?? 0} cliente(s).`}
            </p>
          )}

          <div>
            <Label htmlFor="notification-send-at" className="block text-xs font-semibold text-gray-600 mb-1">Agendar para (opcional)</Label>
            <Input
              id="notification-send-at"
              type="datetime-local"
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={() => broadcastMut.mutate()}
              disabled={!canSend || broadcastMut.isPending}
            >
              {broadcastMut.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              {broadcastMut.isPending ? (agendando ? 'Agendando...' : 'Enviando...') : agendando ? 'Agendar notificação' : 'Enviar notificação'}
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

        {/* Coluna lateral: pre-visualizacao (fixa) + ferramentas de teste (secundarias) */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Pré-visualização</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#5D082A] text-[10px] font-black text-white">AF</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{title.trim() || 'Título do aviso'}</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{body.trim() || 'Corpo da mensagem'}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">mercado.antenorefilhos.com.br</p>
                </div>
              </div>
              {previewImage !== undefined && (
                <div className="mt-2 overflow-hidden rounded">
                  <ProductThumbBanner src={previewImage} />
                </div>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
              {!previewImage && <ImageOff size={12} />}
              {previewLabel}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 shrink-0 text-gray-400" size={16} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ciclo automático por IA</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    3x/dia, decide sozinha quando notificar sobre promoções. Não usa nada do formulário ao lado.
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full text-gray-600"
              onClick={() => { setAiCycleResult(null); runAiCycleMut.mutate() }}
              disabled={runAiCycleMut.isPending}
            >
              {runAiCycleMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
              {runAiCycleMut.isPending ? 'Rodando...' : 'Testar ciclo agora'}
            </Button>
            {aiCycleResult && <p className="mt-2 text-[11px] text-gray-500">{aiCycleResult}</p>}
          </div>

          {agendados.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Agendados</p>
              <ul className="space-y-2">
                {agendados.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-800">{a.title}</p>
                      <p className="text-gray-400">{new Date(a.sendAt).toLocaleString('pt-BR')}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-gray-400 hover:text-red-600"
                      onClick={() => cancelScheduledMut.mutate(a.id)}
                      aria-label="Cancelar agendamento"
                    >
                      <X size={13} />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Auditoria. Nao existe entidade "disparo" no banco -- cada envio grava
          uma linha por cliente, e o agrupamento e reconstruido por titulo,
          corpo e minuto no backend. Serve pra responder "o que ja saiu e
          quando", que era impossivel sem consultar o banco na mao. */}
      <div className="mt-6 rounded-xl border border-[#f1dbe3] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#5D082A]" />
            <h2 className="text-lg font-bold text-gray-800">Histórico de disparos</h2>
          </div>
          {/* Tabs: CAMPANHAS e o que se ausita de marketing (default). PEDIDOS
              (ORDER_UPDATE, um aviso por mudanca de status) fica separado de
              proposito -- sem essa divisao, o volume de pedido afoga qualquer
              campanha assim que a loja tiver movimento real. */}
          <div className="flex overflow-hidden rounded-lg border border-[#E8D7B0]">
            {([
              ['CAMPANHAS', `Campanhas${totalCampanhas ? ` (${totalCampanhas})` : ''}`],
              ['PEDIDOS', `Pedidos${totalPedidos ? ` (${totalPedidos})` : ''}`],
              ['TUDO', 'Tudo'],
            ] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => { setAbaHistorico(valor); setPaginaHistorico(0) }}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  abaHistorico === valor ? 'bg-[#5D082A] text-white' : 'bg-white text-gray-600 hover:bg-[#FDF8F0]'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {carregandoHistorico ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum disparo registrado nessa aba ainda.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historico.map((d, i) => (
              <li key={`${d.title}-${d.sentAt}-${i}`} className="border-l-2 border-[#E8D7B0] pl-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {new Date(d.sentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {d.type === 'PROMO' && (
                    <span className="rounded-full bg-[#FDF8F0] px-2 py-0.5 text-[10px] font-bold text-[#5D082A]">PROMOÇÃO</span>
                  )}
                  {d.type === 'CAMPAIGN' && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">CAMPANHA</span>
                  )}
                  {d.type === 'ORDER_UPDATE' && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">PEDIDO</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {d.recipients} cliente(s) · {d.reads} leram
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-800">{d.title}</p>
                <p className="text-sm text-gray-600">{d.body}</p>
              </li>
            ))}
          </ul>
        )}

        {(paginaHistorico > 0 || temMaisHistorico) && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginaHistorico === 0}
              onClick={() => setPaginaHistorico((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-gray-400">Página {paginaHistorico + 1}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!temMaisHistorico}
              onClick={() => setPaginaHistorico((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}

        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          "Leram" conta quem abriu o aviso dentro da loja. Não é o mesmo que entrega:
          o sistema ainda não registra se o push chegou ao aparelho.
        </p>
      </div>
    </div>
  )
}

/** Imagem grande da pre-visualizacao (banner/produto) -- mesma logica de
 * fallback do ProductThumb, so que ocupando a largura toda em vez de icone. */
function ProductThumbBanner({ src }: { src?: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded bg-gray-100 text-gray-300">
        <ImageOff size={20} />
      </div>
    )
  }
  return <img src={resolveApiUrl(src) ?? src} alt="" className="h-24 w-full rounded object-cover" onError={() => setBroken(true)} />
}
