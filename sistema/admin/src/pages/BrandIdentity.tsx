import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { brandAPI, uploadsAPI, getApiErrorMessage, resolveApiUrl } from '../services/api'
import { Palette, Save, RefreshCw, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BrandConfig {
  storeName: string
  logoDesktopUrl: string | null
  logoMobileUrl: string | null
  primaryColor: string
  secondaryColor: string
}

const DEFAULTS: BrandConfig = {
  storeName: 'Antenor & Filhos',
  logoDesktopUrl: '/branding/logo-horizontal-bordo.png',
  logoMobileUrl: '/branding/logo-bordo.png',
  primaryColor: '#5D082A',
  secondaryColor: '#D2BB8A',
}

function LogoUploader({
  label,
  hint,
  currentUrl,
  onUploaded,
}: {
  label: string
  hint: string
  currentUrl: string | null
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const res = await uploadsAPI.upload(file)
      onUploaded(res.data.url as string)
    } catch (err) {
      setUploadError(getApiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-gray-600">{label}</Label>
      <p className="text-xs text-gray-400">{hint}</p>

      <Button
        type="button"
        variant="outline"
        className="relative flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 cursor-pointer hover:border-[#5D082A]/40 transition-colors"
        style={{ minHeight: 96 }}
        onClick={() => inputRef.current?.click()}
      >
        {currentUrl ? (
          <img
            src={resolveApiUrl(currentUrl) ?? currentUrl}
            alt="logo preview"
            className="max-h-20 max-w-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center text-gray-400 py-4 gap-1">
            <Image size={24} />
            <span className="text-xs">Clique para selecionar</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
            <RefreshCw size={20} className="animate-spin text-[#5D082A]" />
          </div>
        )}
      </Button>

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

      {currentUrl && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onUploaded('')
          }}
          className="h-auto justify-start px-0 py-0 text-xs text-red-500"
        >
          Remover logo
        </Button>
      )}

      <Input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`Enviar ${label.toLowerCase()}`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function BrandIdentity() {
  const qc = useQueryClient()
  const [form, setForm] = useState<BrandConfig | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isLoading } = useQuery({
    queryKey: ['brand-config'],
    queryFn: async () => {
      const res = await brandAPI.get()
      const data = res.data as BrandConfig
      setForm({
        storeName: data.storeName ?? DEFAULTS.storeName,
        logoDesktopUrl: data.logoDesktopUrl ?? DEFAULTS.logoDesktopUrl,
        logoMobileUrl: data.logoMobileUrl ?? DEFAULTS.logoMobileUrl,
        primaryColor: data.primaryColor ?? DEFAULTS.primaryColor,
        secondaryColor: data.secondaryColor ?? DEFAULTS.secondaryColor,
      })
      return data
    },
    staleTime: 30_000,
  })

  const updateMut = useMutation({
    mutationFn: (payload: Partial<BrandConfig>) => brandAPI.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  })

  const handleSave = () => {
    if (!form) return
    setError(null)
    updateMut.mutate({
      storeName: form.storeName,
      logoDesktopUrl: form.logoDesktopUrl || null,
      logoMobileUrl: form.logoMobileUrl || null,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
    })
  }

  const set = (field: keyof BrandConfig, value: string | null) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))

  if (isLoading || !form) {
    return (
      <div className="p-6">
        <div className="space-y-4 max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Identidade Visual</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          Configurações salvas com sucesso.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
        {/* Nome da loja */}
        <div>
          <Label className="mb-1 block text-xs text-gray-600">Nome da loja</Label>
          <Input
            type="text"
            value={form.storeName}
            onChange={(e) => set('storeName', e.target.value)}
            placeholder="Antenor & Filhos"
          />
          <p className="text-xs text-gray-400 mt-1">Exibido no título do site e em e-mails transacionais.</p>
        </div>

        {/* Logos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <LogoUploader
            label="Logo desktop / tablet"
            hint="Recomendado: PNG/WebP 200×60 px, fundo transparente. Exibe nome + marca."
            currentUrl={form.logoDesktopUrl}
            onUploaded={(url) => set('logoDesktopUrl', url || null)}
          />
          <LogoUploader
            label="Logo mobile"
            hint="Recomendado: PNG/WebP 60×60 px quadrado. Exibe apenas a marca."
            currentUrl={form.logoMobileUrl}
            onUploaded={(url) => set('logoMobileUrl', url || null)}
          />
        </div>

        {/* Cores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <Label className="mb-1 block text-xs text-gray-600">Cor primária</Label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={form.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                aria-label="Selecionar cor primária"
              />
              <Input
                type="text"
                value={form.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                maxLength={7}
                className="flex-1 font-mono"
                placeholder="#5D082A"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Botões, destaques e links principais.</p>
          </div>

          <div>
            <Label className="mb-1 block text-xs text-gray-600">Cor secundária</Label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={form.secondaryColor}
                onChange={(e) => set('secondaryColor', e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                aria-label="Selecionar cor secundária"
              />
              <Input
                type="text"
                value={form.secondaryColor}
                onChange={(e) => set('secondaryColor', e.target.value)}
                maxLength={7}
                className="flex-1 font-mono"
                placeholder="#D2BB8A"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Acentos dourados, bordas e elementos de apoio.</p>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Previsualização do header</p>
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-3 border"
            style={{ borderColor: form.secondaryColor + '66', background: '#fff' }}
          >
            {/* Mobile: só logo mobile ou inicial */}
            <div className="sm:hidden">
              {form.logoMobileUrl ? (
                <img
                  src={resolveApiUrl(form.logoMobileUrl) ?? form.logoMobileUrl}
                  alt="logo mobile"
                  className="h-9 w-9 object-contain rounded"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: form.primaryColor }}
                >
                  {(form.storeName[0] || 'A').toUpperCase()}
                </div>
              )}
            </div>
            {/* Desktop/tablet: logo desktop ou nome */}
            <div className="hidden sm:flex items-center gap-2">
              {form.logoDesktopUrl ? (
                <img
                  src={resolveApiUrl(form.logoDesktopUrl) ?? form.logoDesktopUrl}
                  alt="logo desktop"
                  className="h-9 max-w-[160px] object-contain"
                />
              ) : (
                <span className="text-lg font-bold" style={{ color: '#231F20' }}>
                  {form.storeName.split(' ').slice(0, -1).join(' ')}{' '}
                  <span style={{ color: form.primaryColor }}>
                    {form.storeName.split(' ').slice(-1)[0]}
                  </span>
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full"
                style={{ background: form.primaryColor }}
              />
              <div
                className="w-6 h-6 rounded-full"
                style={{ background: form.secondaryColor }}
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={updateMut.isPending}
        >
          {updateMut.isPending ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {updateMut.isPending ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>

      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <p className="font-semibold mb-1">Como as logos são exibidas</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Desktop e tablet: logo desktop com nome da loja. Se não houver logo, exibe o nome em texto.</li>
          <li>Mobile: apenas a logo mobile (marca). Se não houver, exibe a inicial da loja.</li>
          <li>Formatos aceitos: JPG, PNG e WebP. Tamanho máximo: 5 MB.</li>
        </ul>
      </div>
    </div>
  )
}
