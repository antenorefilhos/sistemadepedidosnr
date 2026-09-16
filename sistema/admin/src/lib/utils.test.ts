import { describe, expect, it } from 'vitest'
import { escapeHtml } from './utils'

/**
 * JON-136 (Auditoria 360, High): impressao de pedido interpolava
 * nome/observacao/endereco direto numa string HTML (document.write), sem
 * escape -- cliente que digita "<img onerror=...>" no nome ou nas
 * observacoes do pedido virava HTML executavel na origem do admin.
 */
describe('escapeHtml (JON-136)', () => {
  it('escapa tags e atributos que executariam script', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(escapeHtml('<script>alert(document.cookie)</script>')).toBe(
      '&lt;script&gt;alert(document.cookie)&lt;/script&gt;',
    )
  })

  it('escapa aspas e apostrofo (fecho de atributo)', () => {
    expect(escapeHtml(`" onmouseover="alert(1)`)).toBe('&quot; onmouseover=&quot;alert(1)')
    expect(escapeHtml(`' onmouseover='alert(1)`)).toBe('&#39; onmouseover=&#39;alert(1)')
  })

  it('escapa & antes dos outros (senao dobra o escape)', () => {
    expect(escapeHtml('Tom & Jerry <b>')).toBe('Tom &amp; Jerry &lt;b&gt;')
  })

  it('texto normal sem HTML passa intacto', () => {
    expect(escapeHtml('Rua das Flores, 123')).toBe('Rua das Flores, 123')
  })

  it('nao quebra com null/undefined/numero', () => {
    expect(escapeHtml(null as unknown as string)).toBe('')
    expect(escapeHtml(undefined as unknown as string)).toBe('')
    expect(escapeHtml(42 as unknown as string)).toBe('42')
  })
})
