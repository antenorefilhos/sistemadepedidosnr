import { buildSubstitutionMessage, quantityLabel, whatsappLink } from './substitution-message'

describe('mensagem de troca sugerida', () => {
  it('duas trocas: lista com marcador, produto e preco em negrito, item trocado em codigo', () => {
    const text = buildSubstitutionMessage({
      customerName: 'JONATHAN oliveira',
      orderCode: '102130',
      lines: [
        { originalName: 'Ketchup Heinz 397g', originalSubtotal: 14.99, suggestion: { name: "Ketchup Hellmann's 380g", quantityLabel: '', subtotal: 12.9 } },
        { originalName: 'Batata Palha Yoki 120g', originalSubtotal: 8.49, suggestion: { name: 'Batata Palha Elma Chips 100g', quantityLabel: '', subtotal: 9.99 } },
      ],
      totalWithout: 73.52,
      totalWith: 96.41,
      accountUrl: 'https://mercado.antenorefilhos.com.br/minha-conta',
    })
    expect(text).toBe([
      'Jonathan, durante a separação do seu pedido 102130 não encontramos os seguintes itens:',
      '',
      '* Ketchup Heinz 397g',
      '* Batata Palha Yoki 120g',
      '',
      'Podemos trocar por:',
      "* *Ketchup Hellmann's 380g R$ 12,90* `no lugar de Ketchup Heinz 397g`",
      '* *Batata Palha Elma Chips 100g R$ 9,99* `no lugar de Batata Palha Yoki 120g`',
      '',
      'Com as trocas, o pedido fica em R$ 96,41',
      'Sem as trocas, fica em R$ 73,52',
      '',
      'Aguardo sua resposta para darmos continuidade.',
      '',
      'Se preferir, escolha pelo site, em Minha conta:',
      'https://mercado.antenorefilhos.com.br/minha-conta',
    ].join('\n'))
  })

  it('uma troca, um item sem sugestao, sem nome do cliente', () => {
    const text = buildSubstitutionMessage({
      customerName: null,
      orderCode: '#AB12CD34',
      lines: [
        { originalName: 'A', originalSubtotal: 10, suggestion: { name: 'B', quantityLabel: '268 g', subtotal: 1234.5 } },
        { originalName: 'C', originalSubtotal: 5, suggestion: null },
      ],
      totalWithout: 50,
      totalWith: 1284.5,
    })
    expect(text).toContain('Durante a separação do seu pedido #AB12CD34 não encontramos os seguintes itens:')
    expect(text).toContain('* *B (268 g) R$ 1.234,50* `no lugar de A`')
    expect(text).toContain('Com a troca, o pedido fica em R$ 1.284,50')
    expect(text).not.toContain('Minha conta')
  })

  it('um item so', () => {
    const text = buildSubstitutionMessage({
      customerName: 'ana',
      orderCode: '1',
      lines: [{ originalName: 'A', originalSubtotal: 10, suggestion: { name: 'B', quantityLabel: '', subtotal: 9 } }],
      totalWithout: 50,
      totalWith: 59,
    })
    expect(text.startsWith('Ana, durante a separação do seu pedido 1 não encontramos o seguinte item:')).toBe(true)
  })

  it('link do WhatsApp aceita numero com ou sem 55 e recusa invalido', () => {
    expect(whatsappLink('(24) 99999-0000', 'oi')).toBe('https://wa.me/5524999990000?text=oi')
    expect(whatsappLink('5524999990000', 'oi')).toBe('https://wa.me/5524999990000?text=oi')
    expect(whatsappLink('9999', 'oi')).toBeNull()
  })

  it('quantidade', () => {
    expect(quantityLabel(1, false)).toBe('')
    expect(quantityLabel(2, false)).toBe('2 un')
    expect(quantityLabel(1.25, true)).toBe('1,25 kg')
    expect(quantityLabel(0.22, true)).toBe('220 g')
  })
})

describe('nome de produto com marcador do WhatsApp', () => {
  it('asterisco e crase saem do nome para nao quebrar a linha', () => {
    const text = buildSubstitutionMessage({
      customerName: 'ana',
      orderCode: '1',
      lines: [{ originalName: 'Biscoito *Recheado*', originalSubtotal: 5, suggestion: { name: 'Biscoito `Maria`', quantityLabel: '', subtotal: 4 } }],
      totalWithout: 10,
      totalWith: 14,
    })
    expect(text).toContain('* Biscoito Recheado')
    expect(text).toContain('* *Biscoito Maria R$ 4,00* `no lugar de Biscoito Recheado`')
  })
})
