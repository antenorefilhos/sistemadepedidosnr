import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, ExternalLink, Loader2, Upload } from 'lucide-react'
import { brandAPI, getApiErrorMessage, resolveApiUrl, uploadsAPI } from '../services/api'

// Identidade Visual (refeita em 30/09/2026). O que mudou:
// - o logo enviado aqui nao aparecia no cabecalho do computador (a loja
//   mostrava sempre um arquivo fixo) -- corrigido na loja; a previa agora e no
//   fundo bordo de verdade, onde o logo precisa ser claro;
// - o WhatsApp da loja (recebe a mensagem de cada pedido, aparece no rodape e
//   na ajuda) nao tinha tela em lugar nenhum;
// - "Nome da loja" dizia aparecer em e-mails, e nao aparece.

type Props = { onNavigate: (section: 'businessHours') => void }

const STORE = 'https://mercado.antenorefilhos.com.br'
const DEFAULT_DESKTOP = `${STORE}/branding/logo-horizontal-branco.png`
const DEFAULT_MOBILE = `${STORE}/branding/logo-branco.png`
const MAX_MB = 5

type Brand = {
  storeName: string
  logoDesktopUrl: string | null
  logoMobileUrl: string | null
  contactWhatsapp: string | null
  whatsappSecondary?: string | null
  phoneFixed?: string | null
  emailCommercial?: string | null
  emailDpo?: string | null
  addressNumber?: string | null
  addressCep?: string | null
  cnpj?: string | null
  legalName?: string | null
  storeHoursText?: string | null
}

const formatPhone = (digits: string) => {
  const d = digits.replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}
const logoSrc = (url: string | null, fallback: string) => (url ? resolveApiUrl(url) || url : fallback)

export default function BrandIdentity({ onNavigate }: Props) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['brand-config'], queryFn: async () => (await brandAPI.get()).data as Brand, staleTime: 30_000 })
  const [form, setForm] = useState<{ storeName: string; logoDesktopUrl: string | null; logoMobileUrl: string | null; whatsapp: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (data && !form) {
      setForm({
        storeName: data.storeName || 'Antenor & Filhos',
        logoDesktopUrl: data.logoDesktopUrl,
        logoMobileUrl: data.logoMobileUrl,
        whatsapp: data.contactWhatsapp ? formatPhone(data.contactWhatsapp) : '',
      })
    }
  }, [data, form])

  if (!data || !form) return <div className="mx-auto h-96 max-w-7xl animate-pulse rounded-2xl bg-white/70" />

  const whatsDigits = form.whatsapp.replace(/\D/g, '')
  const whatsFull = whatsDigits.length === 10 || whatsDigits.length === 11 ? `55${whatsDigits}` : whatsDigits
  const whatsOk = /^55\d{10,11}$/.test(whatsFull)
  const dirty =
    form.storeName.trim() !== (data.storeName || '') ||
    form.logoDesktopUrl !== data.logoDesktopUrl ||
    form.logoMobileUrl !== data.logoMobileUrl ||
    (whatsOk ? whatsFull : form.whatsapp) !== (data.contactWhatsapp || '')
  const problems = [!form.storeName.trim() && 'nome da loja', !whatsOk && 'WhatsApp com DDD'].filter(Boolean) as string[]

  const save = async () => {
    if (problems.length) return
    setSaving(true)
    setError('')
    try {
      await brandAPI.update({
        storeName: form.storeName.trim(),
        logoDesktopUrl: form.logoDesktopUrl,
        logoMobileUrl: form.logoMobileUrl,
        contactWhatsapp: whatsFull,
      })
      await qc.invalidateQueries({ queryKey: ['brand-config'] })
      setForm(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <p className="max-w-2xl text-sm text-gray-500">Como a loja se apresenta: o logo do cabeçalho, o nome e o WhatsApp que recebe os pedidos.</p>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-6">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Logo no cabeçalho</h3>
        <p className="mt-1 text-xs text-gray-500">O cabeçalho da loja é bordô: use o logo claro, com fundo transparente (PNG ou WebP, até {MAX_MB} MB).</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <LogoSlot
            label="Computador e tablet"
            hint="Logo horizontal, com o nome. Aparece com até 36 px de altura."
            src={logoSrc(form.logoDesktopUrl, DEFAULT_DESKTOP)}
            isDefault={!form.logoDesktopUrl}
            wide
            onChange={(url) => setForm({ ...form, logoDesktopUrl: url })}
            onError={setError}
          />
          <LogoSlot
            label="Celular"
            hint="Só a marca, quadrada. Aparece com 28 a 36 px."
            src={logoSrc(form.logoMobileUrl, DEFAULT_MOBILE)}
            isDefault={!form.logoMobileUrl}
            onChange={(url) => setForm({ ...form, logoMobileUrl: url })}
            onError={setError}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-6">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Nome da loja</h3>
          <p className="mt-1 text-xs text-gray-500">Vai no título da página inicial (aba do navegador e resultado do Google) e descreve o logo para leitor de tela.</p>
          <input
            value={form.storeName}
            onChange={(e) => setForm({ ...form, storeName: e.target.value })}
            className="mt-3 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900"
            aria-label="Nome da loja"
          />
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-6">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">WhatsApp da loja</h3>
          <p className="mt-1 text-xs text-gray-500">Recebe a mensagem de cada pedido feito no site e aparece no rodapé e no botão de ajuda. Troque aqui se o número da loja mudar.</p>
          <div className="mt-3 flex gap-2">
            <input
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="(24) 99218-6056"
              className={`h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm text-gray-900 ${whatsOk ? 'border-black/[0.08]' : 'border-amber-400'}`}
              aria-label="WhatsApp da loja"
            />
            <a
              href={whatsOk ? `https://wa.me/${whatsFull}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!whatsOk}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 text-sm ${whatsOk ? 'text-gray-700 hover:bg-gray-50' : 'pointer-events-none text-gray-300'}`}
            >
              Testar <ExternalLink size={13} />
            </a>
          </div>
          {!whatsOk && <p className="mt-1 text-xs text-amber-700">Coloque o DDD e o número (celular com o 9 na frente).</p>}
        </section>
      </div>

      <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-6">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">O que o rodapé mostra</h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Item label="WhatsApp">{whatsOk ? formatPhone(whatsFull) : '—'}</Item>
          <Item label="WhatsApp secundário">{data.whatsappSecondary ? formatPhone(data.whatsappSecondary) : '—'}</Item>
          <Item label="Telefone">{data.phoneFixed || '—'}</Item>
          <Item label="E-mails">{[data.emailCommercial, data.emailDpo].filter(Boolean).join(' · ') || '—'}</Item>
          <Item label="Horário da loja">{data.storeHoursText || '—'}</Item>
          <Item label="Horário de entrega">
            Sai do que está cadastrado em{' '}
            <button type="button" onClick={() => onNavigate('businessHours')} className="underline">
              Horário de entrega
            </button>
          </Item>
          <Item label="Empresa">{[data.legalName, data.cnpj && `CNPJ ${data.cnpj.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`].filter(Boolean).join(' · ') || '—'}</Item>
          <Item label="Endereço">{[data.addressNumber && `nº ${data.addressNumber}`, data.addressCep && `CEP ${data.addressCep}`].filter(Boolean).join(' · ') || '—'}</Item>
        </dl>
        <p className="mt-3 text-xs text-gray-400">Dados da empresa, telefone, e-mails e horário da loja ficam fixos no sistema (mudam raramente). Para trocar, peça no desenvolvimento.</p>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <p className="min-w-0 flex-1 text-xs text-gray-500">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check size={14} /> Salvo. A loja mostra em até 10 minutos (ou ao recarregar).
            </span>
          ) : problems.length ? (
            `Falta: ${problems.join(', ')}.`
          ) : dirty ? (
            'Alterações não salvas.'
          ) : (
            ''
          )}
        </p>
        <button type="button" onClick={save} disabled={saving || !dirty || problems.length > 0} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
          {saving && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </div>
    </div>
  )
}

function LogoSlot({
  label,
  hint,
  src,
  isDefault,
  wide,
  onChange,
  onError,
}: {
  label: string
  hint: string
  src: string
  isDefault: boolean
  wide?: boolean
  onChange: (url: string | null) => void
  onError: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    if (!/^image\/(png|webp|jpe?g|svg\+xml)$/.test(file.type)) return onError('Use PNG, WebP, JPG ou SVG.')
    if (file.size > MAX_MB * 1024 * 1024) return onError(`A imagem passa de ${MAX_MB} MB.`)
    setUploading(true)
    try {
      const res = await uploadsAPI.upload(file)
      const url = res.data?.url || res.data?.data?.url
      if (!url) throw new Error('sem url')
      onChange(url)
    } catch (e) {
      onError(getApiErrorMessage(e, 'Não foi possível enviar a imagem.'))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{hint}</p>
      {/* Mesmo fundo do cabecalho da loja: logo escuro some aqui, e la tambem. */}
      <div className="mt-2 flex h-16 items-center rounded-xl bg-[#5D082A] px-4">
        <img src={src} alt="" className={wide ? 'h-9 max-w-[180px] object-contain' : 'h-9 w-9 object-contain'} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Trocar imagem
        </button>
        {!isDefault && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-600 underline">
            Voltar ao logo padrão
          </button>
        )}
        <span className="text-xs text-gray-400">{isDefault ? 'Logo padrão da loja' : 'Imagem enviada'}</span>
      </div>
      <input ref={input} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} aria-label={`Enviar logo (${label})`} />
    </div>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="min-w-0 text-gray-900">{children}</dd>
    </div>
  )
}
