import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { surfaceClasses } from '../components/ui/surface'
import { cn } from '../lib/cn'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-branco.png'

function fieldClass(touched: boolean, error: string | undefined) {
  const base = 'mt-1 h-12 px-4 placeholder:text-gray-500'
  if (!touched) return cn(base, 'border-gray-300')
  return error
    ? cn(base, 'border-red-400 bg-red-50 focus-visible:ring-red-400')
    : cn(base, 'border-green-400 bg-green-50/30 focus-visible:ring-green-400')
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600" role="alert">{msg}</p>
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
  const navigate = useNavigate()
  const { register } = useAuth()

  const validate = (data: typeof formData) => {
    const errs: Record<string, string> = {}
    if (!data.name.trim()) errs.name = 'Nome é obrigatório'
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = 'Email inválido'
    const cpfDigits = data.cpf.replace(/\D/g, '')
    if (cpfDigits && cpfDigits.length < 11) errs.cpf = 'CPF deve ter 11 dígitos'
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
        whatsapp: formData.whatsapp,
        origin: formData.origin || 'DESCONHECIDO',
      })
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Falha ao criar conta'))
    } finally {
      setIsLoading(false)
    }
  }

  const pwStrength = passwordStrength(formData.password)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F0] py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <Link
        to="/"
        className={buttonVariants({ variant: 'outline', size: 'md', className: 'mb-4 self-start bg-white/80 backdrop-blur-sm sm:fixed sm:left-5 sm:top-5 sm:z-50 sm:mb-0 sm:self-auto' })}
        aria-label="Voltar para a loja"
      >
        <ArrowLeft size={15} />
        Voltar à loja
      </Link>
      <div className={surfaceClasses({ tone: 'warm', className: 'glass max-w-md w-full space-y-8 p-8 border-[#D2BB8A]/20' })}>
        <div>
          <img
            src={HORIZONTAL_LOGO_SRC}
            alt="Antenor & Filhos"
            className="mx-auto h-14 w-auto object-contain"
          />
          <h2 className="mt-6 text-center text-3xl font-bold text-[#231F20] luxury-text">
            Crie sua conta e compre melhor
          </h2>
          <p className="mt-2 text-center text-xs tracking-widest uppercase text-[#5D082A] font-bold">
            Antenor & Filhos
          </p>
          <p className="mt-3 text-center text-sm text-gray-500">
            Cadastre-se para acompanhar pedidos, salvar seus dados e comprar mais rápido.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="rounded-lg bg-red-50 p-4 border border-red-100" role="alert">
              <p className="text-sm font-medium text-red-800 whitespace-pre-line">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nome Completo
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                aria-required="true"
                aria-invalid={touched.name && !!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                className={fieldClass(!!touched.name, errors.name)}
                placeholder="João Silva"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError msg={touched.name ? errors.name : undefined} />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-required="true"
                aria-invalid={touched.email && !!errors.email}
                className={fieldClass(!!touched.email, errors.email)}
                placeholder="joao@example.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError msg={touched.email ? errors.email : undefined} />
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">
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
                className={fieldClass(!!touched.cpf, errors.cpf)}
                placeholder="12345678900"
                maxLength={14}
                value={formData.cpf}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError msg={touched.cpf ? errors.cpf : undefined} />
            </div>

            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
                WhatsApp
              </label>
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                autoComplete="tel"
                className={fieldClass(!!touched.whatsapp, undefined)}
                placeholder="11987654321"
                value={formData.whatsapp}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={touched.password && !!errors.password}
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
              <FieldError msg={touched.password ? errors.password : undefined} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Senha
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
                className={fieldClass(!!touched.confirmPassword, errors.confirmPassword)}
                placeholder="••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FieldError msg={touched.confirmPassword ? errors.confirmPassword : undefined} />
            </div>

            <div>
              <label htmlFor="origin" className="block text-sm font-medium text-gray-700">
                Como nos conheceu?
              </label>
              <Select
                id="origin"
                name="origin"
                className="mt-1 h-12 border-gray-300 px-4"
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

          <div>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Criando sua conta..."
              className="w-full py-3 text-sm rounded-lg shadow-lg"
            >
              Criar conta grátis
            </LoadingButton>
          </div>

          <div className="text-center text-sm">
            <p className="text-gray-500">
              Já tem cadastro?{' '}
              <Button
                type="button"
                onClick={() => navigate('/login')}
                variant="ghost"
                size="sm"
                className="h-auto px-1 py-0 align-baseline"
              >
                Entrar agora
              </Button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
