import { type FormEvent, useEffect, useRef, useState } from 'react'
import { X, Package, Tag, BarChart2, Save, Camera, UploadCloud, Loader2, Store, CheckCircle2, AlertCircle, Scale, Trash2, ExternalLink, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { type AdminProduct, type CmsCategory, type CmsProductCategoryMapping, type ProductAvailabilityMetricsResponse, resolveApiUrl, productsAPI, cmsAPI } from '../../services/api'

type ProductFormState = {
  ean: string
  name: string
  titleMask: string
  titleMaskShort: string
  alternativeDescription: string
  classification01: string
  classification02: string
  classification03: string
  classification04: string
  price: string
  promotionalPrice: string
  stock: string
  unit: string
  badges: string
  origin: string
  videoUrl: string
  manualIsFractional: boolean
  manualFractionStep: string
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>
type SelectOption = { value: string }

type Props = {
  isOpen: boolean
  editingProduct: AdminProduct | null
  productForm: ProductFormState
  productFormErrors: ProductFormErrors
  onProductFormChange: (updates: Partial<ProductFormState>) => void
  onSaveProduct: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  savingProduct: boolean
  groupedMercadologicalTree: SelectOption[]
  formLevel2Options: SelectOption[]
  formLevel3Options: SelectOption[]
  formLevel4Options: SelectOption[]
  formatClassificationOptionLabel: (value: string) => string
  availabilityMetrics: ProductAvailabilityMetricsResponse | null
}

function FloatingInput({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
  error,
  className = '',
  step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
  error?: string
  className?: string
  step?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        disabled={disabled}
        className={`peer h-14 w-full rounded-xl border bg-white px-4 pb-2 pt-5 text-sm text-[#2e2226] shadow-none outline-none transition-all duration-200
          placeholder-transparent
          focus:ring-2 focus:ring-[#5d082a]/20 focus:bg-[#fffcfd]
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error ? 'border-red-400 focus:border-red-500' : 'border-[#e6d5de] focus:border-[#5d082a]'}`}
      />
      <label className="pointer-events-none absolute left-4 top-2 z-10 text-[10px] font-semibold uppercase tracking-wider text-[#9e7080] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-[#5d082a]">
        {label}
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function FloatingSelect({
  label,
  value,
  onChange,
  disabled,
  children,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="peer h-14 w-full appearance-none rounded-xl border-[#e6d5de] bg-white px-4 pb-2 pt-5 text-sm text-[#2e2226] shadow-none focus:border-[#5d082a] focus-visible:ring-[#5d082a]/20 disabled:bg-gray-50 disabled:text-gray-400"
      >
        {children}
      </Select>
      <label className="pointer-events-none absolute left-4 top-2 z-10 text-[10px] font-semibold uppercase tracking-wider text-[#9e7080]">
        {label}
      </label>
    </div>
  )
}

const BADGE_OPTIONS = ['Mais Vendido', 'Importado', 'Premium', 'Luxo', 'Exclusivo', 'Especialidade']

const SYNC_OPTION_LABEL: Record<string, string> = {
  SEMPRE: 'Sempre à venda (ignora estoque)',
  ESTOQUE: 'À venda só com estoque',
  NUNCA: 'Nunca no site',
}

const brl = (value?: number | null) =>
  value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const slugify = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const categoryLabel = (code?: string | null) =>
  code ? code.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : ''

/** Linha somente leitura: rotulo + valor + (opcional) de onde vem. */
function ReadOnlyField({ label, value, source, mono }: { label: string; value?: React.ReactNode; source?: string; mono?: boolean }) {
  const empty = value == null || value === ''
  return (
    <div className="rounded-xl border border-[#efe3e8] bg-white px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9e7080]">{label}</span>
        {source && <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{source}</span>}
      </div>
      <p className={`mt-0.5 text-sm break-words ${empty ? 'italic text-gray-400' : 'text-[#2e2226]'} ${mono ? 'font-mono' : ''}`}>
        {empty ? 'não informado' : value}
      </p>
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-[#f1dbe3]/60">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff0f5] text-[#5d082a]">{icon}</div>
      <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a]">{children}</span>
    </div>
  )
}

export default function ProductSlideOver({
  isOpen,
  editingProduct,
  productForm,
  productFormErrors,
  onProductFormChange,
  onSaveProduct,
  onClose,
  savingProduct,
  groupedMercadologicalTree,
  formLevel2Options,
  formLevel3Options,
  formLevel4Options,
  formatClassificationOptionLabel,
}: Props) {
  const isEditing = Boolean(editingProduct)
  const panelRef = useRef<HTMLDivElement>(null)

  const [uploading, setUploading] = useState(false)
  const [uploading2, setUploading2] = useState(false)
  const [imageVersion, setImageVersion] = useState(0)
  const [imageVersion2, setImageVersion2] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadError2, setUploadError2] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [imgError2, setImgError2] = useState(false)

  // Categoria do Storefront
  const [cmsCategories, setCmsCategories] = useState<CmsCategory[]>([])
  const [currentMapping, setCurrentMapping] = useState<CmsProductCategoryMapping | null>(null)
  const [selectedN1, setSelectedN1] = useState('')
  const [selectedN2, setSelectedN2] = useState('')
  const [savingMapping, setSavingMapping] = useState(false)
  const [mappingSuccess, setMappingSuccess] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)

  // Reset imgError and update version when product EAN changes or modal opens
  useEffect(() => {
    setImgError(false)
    setImgError2(false)
    setUploadError(null)
    setUploadError2(null)
    setImageVersion(Date.now())
    setImageVersion2(Date.now())
    setMappingSuccess(false)
    setMappingError(null)
  }, [productForm.ean, isOpen])

  // Carrega categorias CMS e mapping atual ao abrir para edição
  useEffect(() => {
    if (!isOpen || !isEditing) return

    cmsAPI.categories.getAll().then((res) => {
      const data: CmsCategory[] = (res.data as any)?.data ?? res.data ?? []
      setCmsCategories(Array.isArray(data) ? data : [])
    }).catch(() => setCmsCategories([]))

    if (productForm.ean) {
      cmsAPI.categories.getMappingByEan(productForm.ean).then((res) => {
        const mapping = res.data?.data ?? null
        setCurrentMapping(mapping)
        if (mapping) {
          // Se o mapeamento aponta para N2, o categoryId registrado é o N1
          setSelectedN1(mapping.categoryId)
          setSelectedN2(mapping.subCategoryId ?? '')
        } else {
          setSelectedN1('')
          setSelectedN2('')
        }
      }).catch(() => {
        setCurrentMapping(null)
        setSelectedN1('')
        setSelectedN2('')
      })
    }
  }, [isOpen, isEditing, productForm.ean])

  // Limpa N2 quando N1 muda
  const handleN1Change = (n1Id: string) => {
    setSelectedN1(n1Id)
    setSelectedN2('')
    setMappingSuccess(false)
    setMappingError(null)
  }

  const handleSaveMapping = async () => {
    if (!selectedN1) return
    setSavingMapping(true)
    setMappingSuccess(false)
    setMappingError(null)
    try {
      await cmsAPI.categories.upsertMapping(productForm.ean, {
        categoryId: selectedN1,
        subcategoryId: selectedN2 || null,
      })
      setMappingSuccess(true)
      // Recarrega o mapping atual
      const res = await cmsAPI.categories.getMappingByEan(productForm.ean)
      setCurrentMapping(res.data?.data ?? null)
      setTimeout(() => setMappingSuccess(false), 3000)
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Erro ao salvar categoria'
      setMappingError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setSavingMapping(false)
    }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, slot: '1' | '2') => {
    const file = e.target.files?.[0]
    if (!file) return

    const setUpload = slot === '1' ? setUploading : setUploading2
    const setError = slot === '1' ? setUploadError : setUploadError2
    const setImgErr = slot === '1' ? setImgError : setImgError2
    const setVer = slot === '1' ? setImageVersion : setImageVersion2

    setUpload(true)
    setError(null)

    try {
      await productsAPI.uploadImage(productForm.ean, file, slot)
      setVer(Date.now())
      setImgErr(false)
    } catch (err: any) {
      console.error(err)
      const msg = err.response?.data?.message || err.message || 'Erro ao fazer upload da imagem'
      setError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setUpload(false)
      e.target.value = ''
    }
  }

  const handleImageDelete = async (slot: '1' | '2') => {
    const setUpload = slot === '1' ? setUploading : setUploading2
    const setError = slot === '1' ? setUploadError : setUploadError2
    const setImgErr = slot === '1' ? setImgError : setImgError2

    setUpload(true)
    setError(null)

    try {
      await productsAPI.deleteImage(productForm.ean, slot)
      setImgErr(true)
    } catch (err: any) {
      console.error(err)
      const msg = err.response?.data?.message || err.message || 'Erro ao apagar a imagem'
      setError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setUpload(false)
    }
  }

  const formatFriendlyCategoryLabel = (value: string) =>
    formatClassificationOptionLabel(value)
      .replace(/^\d+\s*-\s*/, '')
      .replace(/_/g, ' ')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])


  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[6px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Centered Premium Modal Panel */}
      <div
        ref={panelRef}
        className={`fixed left-1/2 top-1/2 z-50 flex w-[92vw] max-w-4xl h-[90vh] max-h-[800px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(93,8,42,0.18)] border border-[#f1dbe3]/65 transition-all duration-300 ease-out ${
          isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#f1dbe3] bg-[linear-gradient(135deg,#fff7fa_0%,#fff_100%)] px-6 py-5 rounded-t-2xl">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9e7080]">
              {isEditing ? 'Editar produto' : 'Novo produto'}
              {editingProduct?.erpProductId ? ` · Cód. ERP ${editingProduct.erpProductId}` : ''}
              {editingProduct ? ` · EAN ${editingProduct.ean}` : ''}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-gray-900 break-words">
              {isEditing ? editingProduct?.name : 'Preencha os dados do novo produto'}
            </h2>
            {editingProduct && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${editingProduct.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                  {editingProduct.active ? 'Ativo' : 'Inativo'}
                </Badge>
                {editingProduct.syncOption && (
                  <Badge variant="outline" className="rounded-full border-[#ead7df] bg-white px-2 py-0.5 text-[10px] font-bold text-[#5d082a]">
                    {SYNC_OPTION_LABEL[editingProduct.syncOption] ?? editingProduct.syncOption}
                  </Badge>
                )}
                {editingProduct.erpProductId && editingProduct.active && (
                  <a
                    href={`https://mercado.antenorefilhos.com.br/p/${slugify(editingProduct.name)}-${editingProduct.erpProductId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5d082a] underline-offset-2 hover:underline"
                  >
                    <ExternalLink size={11} /> Ver no site
                  </a>
                )}
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl border-[#ead7df] text-gray-400 hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Scrollable Form Body */}
        <form id="product-slide-form" onSubmit={onSaveProduct} className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          {isEditing && editingProduct ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Esquerda: o que se edita aqui (so afeta o site, nunca o ERP) */}
            <div className="space-y-5">
              <SectionTitle icon={<Camera size={14} />}>Fotos</SectionTitle>
                <div className="rounded-xl border border-[#ead7df] bg-white p-4 space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9e7080] block">Mídia do Produto</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Foto 1: Principal */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block text-center">Foto 1 (Principal)</span>
                      <div className="relative flex aspect-square w-full items-center justify-center rounded-xl border border-[#ead7df] bg-gray-50 overflow-hidden">
                        {!imgError ? (
                          <img
                            src={resolveApiUrl(`/uploads/products/${productForm.ean}.webp?v=${imageVersion}`)}
                            alt={`${productForm.name} - Foto 1`}
                            className="h-full w-full object-contain p-1"
                            onError={() => setImgError(true)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <Camera size={24} />
                            <span className="text-[10px] mt-1 font-semibold">Sem foto</span>
                          </div>
                        )}
                        
                        {uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white backdrop-blur-[1px]">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-1.5">
                        <label className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#5d082a] bg-[#fff0f5] border border-[#ead7df] hover:border-[#5d082a] cursor-pointer transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          <UploadCloud size={13} />
                          Carregar
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleImageChange(e, '1')}
                            disabled={uploading}
                            aria-label="Carregar foto principal do produto"
                          />
                        </label>
                        {!imgError && (
                          <button
                            type="button"
                            onClick={() => handleImageDelete('1')}
                            disabled={uploading}
                            aria-label="Apagar foto principal do produto"
                            className="flex items-center justify-center rounded-lg px-2.5 py-1.5 text-red-600 bg-red-50 border border-red-100 hover:border-red-400 transition disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {uploadError && (
                        <p className="text-[10px] text-red-500 text-center leading-tight">{uploadError}</p>
                      )}
                    </div>

                    {/* Foto 2: Auxiliar */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block text-center">Foto 2 (Auxiliar)</span>
                      <div className="relative flex aspect-square w-full items-center justify-center rounded-xl border border-[#ead7df] bg-gray-50 overflow-hidden">
                        {!imgError2 ? (
                          <img
                            src={resolveApiUrl(`/uploads/products/${productForm.ean}_2.webp?v=${imageVersion2}`)}
                            alt={`${productForm.name} - Foto 2`}
                            className="h-full w-full object-contain p-1"
                            onError={() => setImgError2(true)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <Camera size={24} />
                            <span className="text-[10px] mt-1 font-semibold">Sem foto</span>
                          </div>
                        )}
                        
                        {uploading2 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white backdrop-blur-[1px]">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-1.5">
                        <label className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#5d082a] bg-[#fff0f5] border border-[#ead7df] hover:border-[#5d082a] cursor-pointer transition ${uploading2 ? 'opacity-50 pointer-events-none' : ''}`}>
                          <UploadCloud size={13} />
                          Carregar
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleImageChange(e, '2')}
                            disabled={uploading2}
                            aria-label="Carregar foto auxiliar do produto"
                          />
                        </label>
                        {!imgError2 && (
                          <button
                            type="button"
                            onClick={() => handleImageDelete('2')}
                            disabled={uploading2}
                            aria-label="Apagar foto auxiliar do produto"
                            className="flex items-center justify-center rounded-lg px-2.5 py-1.5 text-red-600 bg-red-50 border border-red-100 hover:border-red-400 transition disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {uploadError2 && (
                        <p className="text-[10px] text-red-500 text-center leading-tight">{uploadError2}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-[9px] text-gray-400 text-center leading-normal pt-1 border-t border-[#f1dbe3]/60">
                    Formatos aceitos: JPG, PNG ou WebP. Limite de 5MB por arquivo. As fotos serão convertidas para WebP e redimensionadas automaticamente.
                  </p>
                </div>

              <SectionTitle icon={<Store size={14} />}>Na loja virtual (editável)</SectionTitle>
                  <div className="rounded-xl border border-[#ead7df] bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Store size={12} className="text-[#5d082a]" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#5d082a]">Categoria do Storefront</span>
                      </div>
                      {/* Badge com categoria atual */}
                      {currentMapping ? (
                        <Badge variant="success" className="rounded-full px-2 py-0.5 text-[9px] font-bold">
                          {currentMapping.category.name}{currentMapping.subCategory ? ` › ${currentMapping.subCategory.name}` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                          Sem categoria
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Select N1 */}
                      <div className="relative col-span-2">
                        <Select
                          value={selectedN1}
                          onChange={(e) => handleN1Change(e.target.value)}
                          disabled={savingMapping}
                          className="peer h-12 rounded-xl border-[#e6d5de] bg-white px-3 pb-1 pt-4 text-xs text-[#2e2226] shadow-none focus:border-[#5d082a] focus-visible:ring-[#5d082a]/20 disabled:opacity-50"
                        >
                          <option value="">— Selecione o Departamento N1 —</option>
                          {cmsCategories
                            .filter((c) => !c.parentId)
                            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </Select>
                        <label className="pointer-events-none absolute left-3 top-1.5 z-10 text-[9px] font-bold uppercase tracking-wider text-[#9e7080]">Departamento (N1)</label>
                      </div>

                      {/* Select N2 — filho do N1 selecionado */}
                      {selectedN1 && (() => {
                        const parent = cmsCategories.find((c) => c.id === selectedN1)
                        const subcats = (parent?.children ?? cmsCategories.filter((c) => c.parentId === selectedN1))
                          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                        if (subcats.length === 0) return null
                        return (
                          <div className="relative col-span-2">
                            <Select
                              value={selectedN2}
                              onChange={(e) => { setSelectedN2(e.target.value); setMappingSuccess(false); setMappingError(null) }}
                              disabled={savingMapping}
                              className="peer h-12 rounded-xl border-[#e6d5de] bg-white px-3 pb-1 pt-4 text-xs text-[#2e2226] shadow-none focus:border-[#5d082a] focus-visible:ring-[#5d082a]/20 disabled:opacity-50"
                            >
                              <option value="">— Nenhuma subcategoria —</option>
                              {subcats.map((sub) => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                              ))}
                            </Select>
                            <label className="pointer-events-none absolute left-3 top-1.5 z-10 text-[9px] font-bold uppercase tracking-wider text-[#9e7080]">Subcategoria (N2)</label>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Feedback + Botão Salvar Categoria */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {mappingSuccess && (
                          <><CheckCircle2 size={12} className="text-emerald-600" /><span className="text-emerald-600 font-semibold">Categoria salva!</span></>
                        )}
                        {mappingError && (
                          <><AlertCircle size={12} className="text-red-500" /><span className="text-red-500">{mappingError}</span></>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={handleSaveMapping}
                        disabled={!selectedN1 || savingMapping}
                        size="sm"
                        className="rounded-lg bg-[#5d082a] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-[#4a0622]"
                      >
                        {savingMapping ? <Loader2 size={10} className="animate-spin" /> : <Store size={10} />}
                        Salvar Categoria
                      </Button>
                    </div>
                  </div>

              <div className="grid grid-cols-1 gap-3.5">
                <FloatingSelect label="Etiqueta no card" value={productForm.badges} onChange={(v) => onProductFormChange({ badges: v })}>
                  <option value="">Nenhuma</option>
                  {productForm.badges && !BADGE_OPTIONS.includes(productForm.badges) && <option value={productForm.badges}>{productForm.badges}</option>}
                  {BADGE_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </FloatingSelect>
                <FloatingInput
                  label="Vídeo na página do produto (YouTube, Instagram, TikTok)"
                  value={productForm.videoUrl}
                  onChange={(v) => onProductFormChange({ videoUrl: v })}
                  type="url"
                />
              </div>

              <details className="rounded-xl border border-[#ead7df] bg-white p-3 text-xs" open={Boolean(productForm.titleMask)}>
                <summary className="cursor-pointer font-semibold text-[#5d082a]">Avançado: trocar o nome exibido no site</summary>
                <p className="mt-2 mb-3 text-[11px] text-gray-500">
                  Substitui a descrição e-commerce do ERP só no site. Use só em exceção: o certo é corrigir o nome no ERP, que vale para todos os canais.
                </p>
                <FloatingInput
                  label="Nome no site (vazio = usa a descrição e-commerce)"
                  value={productForm.titleMask}
                  onChange={(v) => onProductFormChange({ titleMask: v })}
                />
              </details>
            </div>

            {/* Direita: o que vem do ERP (somente leitura; corrija no cadastro do ERP) */}
            <div className="space-y-5">
              <SectionTitle icon={<FileText size={14} />}>Descrições (vêm do ERP)</SectionTitle>
              <div className="space-y-2.5">
                <ReadOnlyField label="Descrição e-commerce" source="usada no site" value={editingProduct.name} />
                <ReadOnlyField label="Descrição do cadastro" source="nome cadastral" value={editingProduct.erpDescription || ''} />
                <ReadOnlyField label="Descrição do caixa" source="PDV · até 24 caracteres" value={editingProduct.pdvDescription || ''} />
                {editingProduct.alternativeDescription && (
                  <ReadOnlyField label="Texto de fracionamento" source="aparece no carrinho" value={editingProduct.alternativeDescription.replace(/^Fracionamento:\s*/, '')} />
                )}
              </div>

              <SectionTitle icon={<BarChart2 size={14} />}>Preço e estoque (ERP)</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <ReadOnlyField label="Preço" value={`${brl(editingProduct.price)}${editingProduct.isFractional ? ` / ${(editingProduct.unit || 'kg').toLowerCase()}` : ''}`} />
                <ReadOnlyField
                  label="Promoção"
                  value={editingProduct.promotionalPrice && editingProduct.promotionalPrice < editingProduct.price
                    ? `${brl(editingProduct.promotionalPrice)}${editingProduct.promotionalPriceValidUntil ? ` até ${new Date(editingProduct.promotionalPriceValidUntil).toLocaleDateString('pt-BR')}` : ''}`
                    : 'sem promoção'}
                />
                <ReadOnlyField label="Estoque no ERP" value={editingProduct.stock != null ? String(editingProduct.stock) : ''} />
                <ReadOnlyField label="Unidade" value={editingProduct.unit || ''} />
              </div>

              {/* Vendido por peso — override manual (fallback quando o ERP nao informa) */}
              <div className="pt-4 border-t border-dashed border-[#f1dbe3]/60 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Scale size={12} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-650">Vendido por peso</span>
                </div>

                {editingProduct?.isFractional ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    Fracionamento vem do ERP: passo mínimo de {editingProduct.fractionStep} {editingProduct.unit || 'un'}. Não é possível sobrepor um valor manual enquanto o ERP informar este dado.
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#ead7df] bg-white p-3 space-y-3">
                    <p className="text-[11px] text-gray-500">
                      O ERP não está enviando fracionamento para este produto. Defina manualmente para liberar a compra por peso no storefront — isso não altera nem envia nada de volta para o ERP.
                    </p>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#2e2226]">
                      <input
                        type="checkbox"
                        checked={productForm.manualIsFractional}
                        onChange={(e) => onProductFormChange({ manualIsFractional: e.target.checked, ...(e.target.checked ? {} : { manualFractionStep: '' }) })}
                        className="h-4 w-4 rounded border-[#e6d5de] text-[#5d082a] focus:ring-[#5d082a]/30"
                      />
                      Vendido por peso (manual)
                    </label>
                    {productForm.manualIsFractional && (
                      <FloatingInput
                        label={`Fracionamento mínimo (${productForm.unit || 'kg'}) *`}
                        value={productForm.manualFractionStep}
                        onChange={(v) => onProductFormChange({ manualFractionStep: v })}
                        type="number"
                        step="0.001"
                        className="col-span-1"
                      />
                    )}
                  </div>
                )}
              </div>

              <SectionTitle icon={<Tag size={14} />}>Códigos e classificação (ERP)</SectionTitle>
              <div className="space-y-2.5">
                <ReadOnlyField
                  label="Códigos de barras"
                  mono
                  value={[editingProduct.ean, ...(editingProduct.secondaryEans || [])].join(' · ')}
                />
                <ReadOnlyField
                  label="Departamento e-commerce"
                  value={[categoryLabel(editingProduct.category), editingProduct.ecommerceCategory].filter(Boolean).join(' › ')}
                />
                <ReadOnlyField
                  label="Árvore do cadastro"
                  value={[editingProduct.classification01, editingProduct.classification02, editingProduct.classification03, editingProduct.classification04]
                    .filter(Boolean)
                    .map((v) => formatFriendlyCategoryLabel(String(v)))
                    .join(' › ')}
                />
              </div>
            </div>
          </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <SectionTitle icon={<Package size={14} />}>Dados do produto</SectionTitle>
              <div className="grid grid-cols-2 gap-3.5">
                <FloatingInput label="EAN *" value={productForm.ean} onChange={(v) => onProductFormChange({ ean: v })} disabled={isEditing} error={productFormErrors.ean} className="col-span-1" />
                <FloatingInput label="Nome *" value={productForm.name} onChange={(v) => onProductFormChange({ name: v })} disabled={isEditing} error={productFormErrors.name} className="col-span-1" />
                
                <FloatingInput label="Preço *" value={productForm.price} onChange={(v) => onProductFormChange({ price: v })} type="number" step="0.01" disabled={isEditing} error={productFormErrors.price} className="col-span-1" />
                <FloatingInput label="Preço Promocional" value={productForm.promotionalPrice} onChange={(v) => onProductFormChange({ promotionalPrice: v })} type="number" step="0.01" className="col-span-1" />
                
                <FloatingInput label="Estoque" value={productForm.stock} onChange={(v) => onProductFormChange({ stock: v })} type="number" disabled={isEditing} className="col-span-1" />
                <FloatingInput label="Unidade" value={productForm.unit} onChange={(v) => onProductFormChange({ unit: v })} disabled={isEditing} className="col-span-1" />
                
                <FloatingInput label="Descrição Alternativa" value={productForm.alternativeDescription} onChange={(v) => onProductFormChange({ alternativeDescription: v })} disabled={isEditing} className="col-span-2" />
              </div>
              <p className="text-xs text-gray-400">Fotos e vídeo podem ser configurados depois de criar o produto.</p>
            </div>
            <div className="space-y-5">
              <SectionTitle icon={<Tag size={14} />}>Estrutura mercadológica</SectionTitle>
                <div className="grid grid-cols-2 gap-3.5">
                  <FloatingSelect
                    label="Departamento"
                    value={productForm.classification01}
                    onChange={(v) => onProductFormChange({ classification01: v, classification02: '', classification03: '', classification04: '' })}
                    disabled={isEditing}
                    className="col-span-2"
                  >
                    <option value=""></option>
                    {groupedMercadologicalTree.map((item) => (
                      <option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>
                    ))}
                  </FloatingSelect>

                  <FloatingSelect
                    label="Seção"
                    value={productForm.classification02}
                    onChange={(v) => onProductFormChange({ classification02: v, classification03: '', classification04: '' })}
                    disabled={isEditing || !productForm.classification01}
                    className="col-span-2"
                  >
                    <option value=""></option>
                    {productForm.classification02 && !formLevel2Options.some((i) => i.value === productForm.classification02) && (
                      <option value={productForm.classification02}>{productForm.classification02}</option>
                    )}
                    {formLevel2Options.map((item) => (
                      <option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>
                    ))}
                  </FloatingSelect>

                  <FloatingSelect
                    label="Refino N3"
                    value={productForm.classification03}
                    onChange={(v) => onProductFormChange({ classification03: v, classification04: '' })}
                    disabled={isEditing || !productForm.classification02}
                    className="col-span-1"
                  >
                    <option value=""></option>
                    {productForm.classification03 && !formLevel3Options.some((i) => i.value === productForm.classification03) && (
                      <option value={productForm.classification03}>{productForm.classification03}</option>
                    )}
                    {formLevel3Options.map((item) => (
                      <option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>
                    ))}
                  </FloatingSelect>

                  <FloatingSelect
                    label="Refino N4"
                    value={productForm.classification04}
                    onChange={(v) => onProductFormChange({ classification04: v })}
                    disabled={isEditing || !productForm.classification03}
                    className="col-span-1"
                  >
                    <option value=""></option>
                    {productForm.classification04 && !formLevel4Options.some((i) => i.value === productForm.classification04) && (
                      <option value={productForm.classification04}>{productForm.classification04}</option>
                    )}
                    {formLevel4Options.map((item) => (
                      <option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>
                    ))}
                  </FloatingSelect>
                </div>
            </div>
          </div>
          )}
        </form>

        {/* Footer fixo */}
        <div className="flex items-center justify-between gap-3 border-t border-[#f1dbe3] bg-white px-6 py-4 rounded-b-2xl">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="min-h-11 rounded-xl border-[#ead7df] px-5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="product-slide-form"
            disabled={savingProduct}
            className="min-h-11 rounded-xl bg-[#5d082a] px-6 text-sm font-bold text-white shadow-lg shadow-[#5d082a]/20 hover:bg-[#4a0622]"
          >
            <Save size={15} />
            {savingProduct ? 'Salvando...' : 'Salvar Produto'}
          </Button>
        </div>
      </div>
    </>
  )
}
