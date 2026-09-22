import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, X, Pencil, Trash2, Pause, Play, Search as SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { productsAPI, sponsoredShelvesAdminAPI, type SponsoredShelfAdmin, type SponsoredShelfProduct } from '../services/api'

/**
 * JON-204 (22/09/2026): vitrine de fornecedor/parceria comercial, cadastrada
 * direto aqui -- diferente do Encarte (100% sincronizado do ERP, sem
 * criacao manual), essa e livre: nome, produtos e liga/desliga.
 */
function shelfStatus(shelf: SponsoredShelfAdmin) {
  if (!shelf.active) return { label: 'Pausada', className: 'bg-gray-100 text-gray-600' }
  const today = new Date().toISOString().slice(0, 10)
  if (shelf.startDate && shelf.startDate.slice(0, 10) > today) return { label: 'Agendada', className: 'bg-blue-100 text-blue-700' }
  if (shelf.endDate && shelf.endDate.slice(0, 10) < today) return { label: 'Expirada', className: 'bg-amber-100 text-amber-700' }
  return { label: 'Ativa', className: 'bg-green-100 text-green-700' }
}

export default function SponsoredShelves() {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<SponsoredShelfProduct[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<SponsoredShelfProduct[]>([])
  const [productSearching, setProductSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: shelves, isLoading } = useQuery({
    queryKey: ['sponsored-shelves-admin'],
    queryFn: () => sponsoredShelvesAdminAPI.list().then((r) => r.data),
  })

  // Autocomplete de produto -- mesmo padrao de debounce do StoreBannersManager.
  useEffect(() => {
    if (!productQuery.trim() || productQuery.trim().length < 2) {
      setProductResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        setProductSearching(true)
        const res = await productsAPI.getAdmin({ page: 1, limit: 8, search: productQuery.trim() })
        const list = ((res.data as any)?.data || []) as Array<{ id: string; name: string; ean: string }>
        setProductResults(list.map((p) => ({ id: p.id, name: p.name, ean: p.ean })))
      } catch {
        setProductResults([])
      } finally {
        setProductSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [productQuery])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setSponsorName('')
    setStartDate('')
    setEndDate('')
    setSelectedProducts([])
    setProductQuery('')
    setProductResults([])
    setError(null)
  }

  const startCreate = () => { resetForm(); setOpen(true) }

  const startEdit = (shelf: SponsoredShelfAdmin) => {
    setEditingId(shelf.id)
    setTitle(shelf.title)
    setSponsorName(shelf.sponsorName || '')
    setStartDate(shelf.startDate ? shelf.startDate.slice(0, 10) : '')
    setEndDate(shelf.endDate ? shelf.endDate.slice(0, 10) : '')
    setSelectedProducts(shelf.items.map((item) => item.product))
    setProductQuery('')
    setProductResults([])
    setError(null)
    setOpen(true)
  }

  const addProduct = (product: SponsoredShelfProduct) => {
    if (selectedProducts.some((p) => p.id === product.id)) return
    setSelectedProducts((prev) => [...prev, product])
    setProductQuery('')
    setProductResults([])
  }

  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        sponsorName: sponsorName.trim() || undefined,
        startDate: startDate || null,
        endDate: endDate || null,
        productIds: selectedProducts.map((p) => p.id),
      }
      return editingId ? sponsoredShelvesAdminAPI.update(editingId, payload) : sponsoredShelvesAdminAPI.create({ ...payload, active: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsored-shelves-admin'] })
      setOpen(false)
      resetForm()
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Erro ao salvar vitrine.'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (shelf: SponsoredShelfAdmin) => sponsoredShelvesAdminAPI.update(shelf.id, { active: !shelf.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sponsored-shelves-admin'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sponsoredShelvesAdminAPI.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sponsored-shelves-admin'] }); setDeleteError(null) },
    onError: (err: any) => setDeleteError(err?.response?.data?.message || 'Erro ao apagar vitrine.'),
  })

  const datesValid = !startDate || !endDate || startDate <= endDate
  const canSubmit = title.trim().length > 0 && selectedProducts.length > 0 && datesValid
  const searchResults = useMemo(
    () => productResults.filter((p) => !selectedProducts.some((s) => s.id === p.id)),
    [productResults, selectedProducts],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Megaphone size={22} /> Vitrines Patrocinadas
          </h1>
          <p className="text-sm text-gray-500">Vitrine dedicada a um fornecedor/parceria -- aparece na Home, desktop e mobile.</p>
        </div>
        <Button onClick={startCreate}>
          <Plus size={16} className="mr-1" /> Nova vitrine
        </Button>
      </div>

      {open && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Editar vitrine' : 'Criar vitrine patrocinada'}</h2>
            <button onClick={() => { setOpen(false); resetForm() }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-sm font-semibold text-gray-800">Título da vitrine</Label>
                <p className="mb-2 text-xs text-gray-500">O que o cliente vê na Home. Ex: "Semana Nestlé".</p>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Semana Nestlé" />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-semibold text-gray-800">Nome do fornecedor (opcional)</Label>
                <p className="mb-2 text-xs text-gray-500">Aparece como "Parceria [nome]" acima do título.</p>
                <Input value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="Ex: Nestlé" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-sm font-semibold text-gray-800">Início da vigência (opcional)</Label>
                <p className="mb-2 text-xs text-gray-500">Vazio = ativa desde já.</p>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-semibold text-gray-800">Fim da vigência (opcional)</Label>
                <p className="mb-2 text-xs text-gray-500">Vazio = sem data pra sair do ar.</p>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {!datesValid && <p className="sm:col-span-2 text-sm font-medium text-red-600">Data de início não pode ser depois da data de fim.</p>}
            </div>

            <div>
              <Label className="mb-1 block text-sm font-semibold text-gray-800">Produtos da vitrine</Label>
              <p className="mb-2 text-xs text-gray-500">Busque pelo nome ou EAN e clique pra adicionar. A ordem aqui é a ordem na vitrine.</p>
              <div className="relative">
                <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
              </div>
              {productSearching && <p className="mt-1 text-xs text-gray-400">Buscando...</p>}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-400">{p.ean}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-1.5">
                {selectedProducts.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum produto adicionado ainda.</p>
                ) : (
                  selectedProducts.map((p, index) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                      <span>{index + 1}. {p.name}</span>
                      <button type="button" onClick={() => removeProduct(p.id)} className="text-gray-400 hover:text-red-600">
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancelar</Button>
            <Button disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="px-6 text-base">
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar vitrine'}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Carregando...</p>
        ) : !shelves?.length ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-gray-400">
            <Megaphone size={32} />
            <p className="text-sm">Nenhuma vitrine patrocinada criada ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Vitrine</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Produtos</th>
                <th className="px-4 py-3">Vigência</th>
                <th className="px-4 py-3">Está ativa?</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shelves.map((shelf) => (
                <tr key={shelf.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-semibold">{shelf.title}</td>
                  <td className="px-4 py-3">{shelf.sponsorName || '—'}</td>
                  <td className="px-4 py-3">{shelf.items.length}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {shelf.startDate ? new Date(shelf.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                    {' até '}
                    {shelf.endDate ? new Date(shelf.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${shelfStatus(shelf).className}`}>
                      {shelfStatus(shelf).label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" title="Editar" onClick={() => startEdit(shelf)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        title={shelf.active ? 'Pausar' : 'Ativar'}
                        onClick={() => toggleActiveMutation.mutate(shelf)}
                        disabled={toggleActiveMutation.isPending}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                      >
                        {shelf.active ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        type="button"
                        title="Apagar"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Apagar a vitrine "${shelf.title}"? Essa ação não pode ser desfeita.`)) {
                            deleteMutation.mutate(shelf.id)
                          }
                        }}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {deleteError && <p className="border-t border-gray-100 p-3 text-sm font-medium text-red-600">{deleteError}</p>}
      </div>
    </div>
  )
}
