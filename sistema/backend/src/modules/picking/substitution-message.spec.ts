import { buildSubstitutionMessage, quantityLabel, whatsappLink } from './substitution-message'

describe('mensagem de troca sugerida', () => {
  it('duas trocas: lista o que faltou, numera as sugestoes e mostra os dois totais', () => {
    const text = buildSubstitutionMessage({
      customerName: 'JONATHAN oliveira',
      pickerName: 'Ana Paula',
      orderCode: 'DAV 102130',
      lines: [
        { originalName: 'Ketchup Heinz 397g', originalSubtotal: 14.99, suggestion: { name: "Ketchup Hellmann's 380g", quantityLabel: '', subtotal: 12.9 } },
        { originalName: 'Batata Palha Yoki 120g', originalSubtotal: 8.49, suggestion: { name: 'Batata Palha Elma Chips 100g', quantityLabel: '', subtotal: 9.99 } },
      ],
      totalWithout: 73.52,
      totalWith: 96.41,
    })
    expect(text).toBe([
      'Olá, Jonathan! Aqui é Ana, do Antenor & Filhos, separando o seu pedido DAV 102130.',
      '',
      'Não encontramos na loja:',
      '• Ketchup Heinz 397g (R$ 14,99)',
      '• Batata Palha Yoki 120g (R$ 8,49)',
      '',
      'Podemos trocar por:',
      "1) Ketchup Hellmann's 380g: R$ 12,90 (no lugar de Ketchup Heinz 397g)",
      '2) Batata Palha Elma Chips 100g: R$ 9,99 (no lugar de Batata Palha Yoki 120g)',
      '',
      'Com as trocas, o pedido fica em R$ 96,41.',
      'Sem as trocas, fica em R$ 73,52.',
      '',
      'Responda SIM para aceitar todas, NÃO para seguir sem elas, ou os números das que aceita (ex.: 1).',
    ].join('\n'))
  })

  it('uma troca e um item sem sugestao', () => {
    const text = buildSubstitutionMessage({
      customerName: null,
      pickerName: null,
      orderCode: 'DAV 1',
      lines: [
        { originalName: 'A', originalSubtotal: 10, suggestion: { name: 'B', quantityLabel: '2 un', subtotal: 1234.5 } },
        { originalName: 'C', originalSubtotal: 5, suggestion: null },
      ],
      totalWithout: 50,
      totalWith: 1284.5,
    })
    expect(text).toContain('Olá! Aqui é do Antenor & Filhos')
    expect(text).toContain('• 2 un B: R$ 1.234,50 (no lugar de A)')
    expect(text).toContain('Responda SIM para aceitar a troca ou NÃO para seguir sem ela.')
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
  })
})
