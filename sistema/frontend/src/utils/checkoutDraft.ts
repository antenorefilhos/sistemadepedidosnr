/**
 * Rascunho do formulario de checkout, no aparelho do cliente.
 *
 * Por que existe: `Checkout.tsx` LIA o endereco salvo (`readDeliveryVerification`)
 * mas nunca SALVAVA -- `saveDeliveryAddress` so rodava no envio final do pedido.
 * Quem saisse do checkout antes disso (voltar ao carrinho pra corrigir uma
 * quantidade, por exemplo) voltava com o formulario em branco: nome, WhatsApp,
 * CPF, e-mail, endereco, CEP e a localidade escolhida, tudo de novo.
 *
 * Fica em localStorage e nao no estado da rota de proposito: o cliente pode
 * fechar a aba, atender o telefone, e voltar depois.
 *
 * Nao guarda nada de pagamento alem do metodo escolhido -- nunca houve dado de
 * cartao aqui, e nao e lugar pra isso.
 */
const KEY = 'antenor.checkoutDraft'

/** Campos aceitos de volta. Qualquer coisa fora disso no storage e ignorada. */
const CAMPOS = [
  'guestName',
  'guestWhatsapp',
  'guestCpf',
  'guestEmail',
  'street',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
  'zipCode',
  'locality',
  'deliveryPointCode',
  'notes',
  'paymentMethod',
  'needsChange',
  'changeFor',
] as const

export type CheckoutDraft = Partial<Record<(typeof CAMPOS)[number], string>>

export function readCheckoutDraft(): CheckoutDraft {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const draft: CheckoutDraft = {}
    for (const campo of CAMPOS) {
      const valor = parsed[campo]
      // So string: o rascunho e texto de formulario. Descartar o resto evita
      // que um storage corrompido (ou de uma versao antiga) injete objeto no
      // estado do React e quebre a tela na hidratacao.
      if (typeof valor === 'string') draft[campo] = valor
    }
    return draft
  } catch {
    return {}
  }
}

export function saveCheckoutDraft(draft: CheckoutDraft) {
  try {
    const limpo: CheckoutDraft = {}
    for (const campo of CAMPOS) {
      const valor = draft[campo]
      if (typeof valor === 'string' && valor !== '') limpo[campo] = valor
    }
    localStorage.setItem(KEY, JSON.stringify(limpo))
  } catch {
    // Modo anonimo ou storage cheio: perder o rascunho e aceitavel, travar o
    // checkout por causa disso nao e.
  }
}

/** Chamar quando o pedido sai: o proximo checkout comeca limpo. */
export function clearCheckoutDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* idem */
  }
}
