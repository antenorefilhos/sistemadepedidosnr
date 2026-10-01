/**
 * CPF com digitos verificadores validos (01/10/2026). Ate aqui o servidor so
 * conferia 11 digitos: qualquer sequencia passava, e conta nova com CPF
 * inventado era o caminho mais curto para reusar beneficio de primeira compra.
 */
export function isValidCpf(raw?: string | null): boolean {
  const cpf = String(raw || '').replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}
