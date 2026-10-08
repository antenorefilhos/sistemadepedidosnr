import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { AuthHelp, AuthShell } from '../components/AuthShell'
import { Input } from '../components/ui/input'
import { PasswordInput } from '../components/ui/password-input'
import { Select } from '../components/ui/select'
import { cn } from '../lib/cn'

// 07/10/2026: mesmo layout das telas de entrada (AuthShell) e volta para onde
// o cliente estava ao terminar -- vindo do checkout, o cadastro caia na Home.

function fieldClass(touched: boolean, error: string | undefined) {
  const base = 'mt-1.5 h-12 rounded-xl px-4 text-base placeholder:text-gray-400'
  if (!touched) return cn(base, 'border-gray-300')
  return error
    ? cn(base, 'border-red-400 bg-red-50 focus-visible:ring-red-400')
    : cn(base, 'border-green-400 bg-green-50/30 focus-visible:ring-green-400')
}

// JON-166 (Auditoria 360): aria-describedby apontava pra um id que
// FieldError nunca criava (ou nem existia, nos demais campos) -- o alerta
// aparecia visualmente mas nao se reconstituia como descricao do campo pra
// quem usa leitor de tela.
function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null
  return <p id={id} className="mt-1 text-xs text-red-600" role="alert">{msg}</p>
}

function passwordStrength(pw: string): { label: string; width: string; color: string } {
  if (pw.length === 0) return { label: '', width: '0%', color: '' }
  if (pw.length < 6) return { label: 'Muito curta', width: '20%', color: 'bg-red-500' }
  if (pw.length < 8) return { label: 'Fraca', width: '40%', color: 'bg-orange-400' }
  const hasUpper = /[A-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw)
  const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  if (score === 0) return { label: 'Regular', width: '55%', color: 'bg-yellow-400' }
  if (score === 1) return { label: 'Boa', width: '70%', color: 'bg-lime-500' }
  return { label: 'Forte', width: '100%', color: 'bg-green-600' }
}

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    cpf: '',
    whatsapp: '',
    origin: '',
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || undefined
  const { register } = useAuth()

  const validate = (data: typeof formData) => {
    const errs: Record<string, string> = {}
    if (!data.name.trim()) errs.name = 'Nome é obrigatório'
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = 'E-mail inválido'
    const cpfDigits = data.cpf.replace(/\D/g, '')
    if (cpfDigits && cpfDigits.length < 11) errs.cpf = 'CPF deve ter 11 dígitos'
    const whatsappDigits = data.whatsapp.replace(/\D/g, '')
    if (whatsappDigits && !/^\d{10,11}$/.test(whatsappDigits)) errs.whatsapp = 'Celular inválido. Use DDD + número, ex: 11987654321'
    if (data.password && data.password.length < 6) errs.password = 'Mínimo 6 caracteres'
    if (data.confirmPassword && data.confirmPassword !== data.password) errs.confirmPassword = 'Senhas não conferem'
    return errs
  }

  const errors = validate(formData)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Touch all fields
    const allTouched = Object.fromEntries(Object.keys(formData).map((k) => [k, true]))
    setTouched(allTouched)

    if (Object.keys(errors).length > 0) return

    setIsLoading(true)
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        cpf: formData.cpf.replace(/\D/g, ''),
        whatsapp: formData.whatsapp.replace(/\D/g, ''),
        origin: formData.origin || 'DESCONHECIDO',
      }, redirect)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Falha ao criar conta'))
    } finally {
      setIsLoading(false)
    }
  }

  const pwStrength = passwordStrength(formData.password)

  return (
    <AuthShell>
      <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.06)] ring-1 ring-[#E8D7B0]/70 sm:p-8">
        <h1 className="text-2xl font-bold leading-tight text-[#231F20]">Criar conta grátis</h1>
        <p className="mt-1.5 text-sm text-[#5d4f33]">Para acompanhar pedidos, salvar seus endereços e comprar mais rápido.</p>

        <form className="mt-5 space-y-6" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="rounded-lg bg-red-50 p-4 border border-red-100" role="alert">
              <p className="text-sm font-medium text-red-800 whitespace-pre-line">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[#231F20]">
                Nome completo
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                aria-required="true"
                aria-invalid={touched.name && !!errors.name}
                aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
                className={fieldClass(!!touched.name, errors.name)}
                placeholder="Como você se chama"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError id="name-error" msg={touched.name ? errors.name : undefined} />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#231F20]">
                E-mail
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-required="true"
                aria-invalid={touched.email && !!errors.email}
                aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                className={fieldClass(!!touched.email, errors.email)}
                placeholder="voce@email.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError id="email-error" msg={touched.email ? errors.email : undefined} />
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-semibold text-[#231F20]">
                CPF
              </label>
              <Input
                id="cpf"
                name="cpf"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-required="true"
                aria-invalid={touched.cpf && !!errors.cpf}
                aria-describedby={touched.cpf && errors.cpf ? 'cpf-error' : undefined}
                className={fieldClass(!!touched.cpf, errors.cpf)}
                placeholder="Só números"
                maxLength={14}
                value={formData.cpf}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError id="cpf-error" msg={touched.cpf ? errors.cpf : undefined} />
            </div>

            <div>
              <label htmlFor="whatsapp" className="block text-sm font-semibold text-[#231F20]">
                WhatsApp
              </label>
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                aria-invalid={touched.whatsapp && !!errors.whatsapp}
                aria-describedby={touched.whatsapp && errors.whatsapp ? 'whatsapp-error' : undefined}
                className={fieldClass(!!touched.whatsapp, errors.whatsapp)}
                placeholder="DDD + número"
                maxLength={11}
                value={formData.whatsapp}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError id="whatsapp-error" msg={touched.whatsapp ? errors.whatsapp : undefined} />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#231F20]">
                Senha
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={touched.password && !!errors.password}
                aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
                className={fieldClass(!!touched.password, errors.password)}
                placeholder="••••••"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              {formData.password.length > 0 && (
                <div className="mt-1.5 space-y-1" aria-live="polite">
                  <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`}
                      style={{ width: pwStrength.width }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Força: <span className="font-medium">{pwStrength.label}</span></p>
                </div>
              )}
              <FieldError id="password-error" msg={touched.password ? errors.password : undefined} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#231F20]">
                Repita a senha
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
                aria-describedby={touched.confirmPassword && errors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={fieldClass(!!touched.confirmPassword, errors.confirmPassword)}
                placeholder="••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError id="confirmPassword-error" msg={touched.confirmPassword ? errors.confirmPassword : undefined} />
            </div>

            <div>
              <label htmlFor="origin" className="block text-sm font-semibold text-[#231F20]">
                Como nos conheceu?
              </label>
              <Select
                id="origin"
                name="origin"
                className="mt-1.5 h-12 rounded-xl border-gray-300 px-4 text-base"
                value={formData.origin}
                onChange={handleChange}
                onBlur={handleBlur}
              >
                <option value="">Como conheceu a loja?</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="WHATSAPP">Grupos de WhatsApp</option>
                <option value="GOOGLE">Pesquisa Google</option>
                <option value="INDICACAO">Indicação de Amigo</option>
                <option value="LOJA_FISICA">Passei na Loja Física</option>
                <option value="OUTROS">Outros</option>
              </Select>
            </div>
          </div>

          <LoadingButton type="submit" isLoading={isLoading} loadingText="Criando sua conta..." className="h-12 w-full rounded-xl text-[15px]">
            Criar conta grátis
          </LoadingButton>
        </form>

        <p className="mt-5 border-t border-[#E8D7B0]/60 pt-4 text-center text-sm text-[#5d4f33]">
          Já tem conta?{' '}
          <Link to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} className="font-bold text-[#5D082A] hover:underline">
            Entrar
          </Link>
        </p>
      </div>
      <div className="mt-6">
        <AuthHelp />
      </div>
    </AuthShell>
  )
}
