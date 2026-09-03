import { useState } from 'react'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { authAPI } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import { Button } from './ui/button'
import { Input } from './ui/input'

/**
 * Oferta de virar cadastro de verdade, na tela de pedido confirmado.
 *
 * O cliente ja E reconhecido: `guestCheckout` reusa o Customer existente por
 * WhatsApp/CPF/e-mail, entao os pedidos se acumulam no cadastro certo. O que
 * faltava era o caminho de volta -- conta de convidado nasce sem senha, o
 * login falha, e "esqueci minha senha" depende de e-mail, que e opcional no
 * checkout. Sem isso o cliente e reconhecido pelo sistema e mesmo assim nunca
 * consegue entrar pra ver o proprio historico.
 *
 * Aparece aqui, e nao antes do pedido, de proposito: pedir senha no meio do
 * checkout adiciona atrito no unico momento em que ele custa venda. Depois do
 * pedido confirmado o cliente ja esta autenticado (o token saiu do
 * guest-checkout), entao definir a senha nao precisa de e-mail nem de link.
 */
export function CriarSenhaCard() {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (pronto) {
    return (
      <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-900">
          Cadastro finalizado! Da próxima vez é só entrar com seu WhatsApp, CPF ou e-mail.
        </p>
      </div>
    )
  }

  const enviar = async () => {
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    // Confere aqui e nao so no servidor: senha digitada errada duas vezes
    // iguais e problema do cliente, mas errada UMA vez o tranca fora da
    // conta sem ele saber -- e nao ha e-mail garantido pra recuperar.
    if (senha !== confirmacao) {
      setErro('As senhas não são iguais.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await authAPI.setPassword(senha)
      setPronto(true)
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Nao foi possivel criar a senha agora.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-[#E8D7B0]/60 bg-[#FBFAF7] p-4 text-left">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound size={16} className="text-[#5D082A]" />
        <p className="text-sm font-bold text-[#231F20]">Finalize seu cadastro</p>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        Agora, para acompanhar seu pedido de perto, crie uma senha. Seus dados já estão salvos — da
        próxima vez você entra com o WhatsApp, CPF ou e-mail e não preenche nada de novo.
      </p>
      <div className="space-y-2">
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Crie uma senha"
          autoComplete="new-password"
          aria-label="Crie uma senha"
        />
        <Input
          type="password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder="Confirme a senha"
          autoComplete="new-password"
          aria-label="Confirme a senha"
          onKeyDown={(e) => {
            if (e.key === 'Enter') enviar()
          }}
        />
        <Button type="button" onClick={enviar} disabled={enviando} variant="primary" className="w-full">
          {enviando ? 'Salvando...' : 'Finalizar cadastro'}
        </Button>
      </div>
      {erro && <p className="mt-2 text-xs font-semibold text-red-600">{erro}</p>}
    </div>
  )
}
