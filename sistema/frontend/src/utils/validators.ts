/**
 * Validadores Brasileiros
 */

export class BrazilianValidators {
  /**
   * Valida CPF com algoritmo de dígito verificador
   */
  static validateCPF(cpf: string): boolean {
    const clean = cpf.replace(/\D/g, '')

    if (clean.length !== 11) return false
    if (/^(\d)\1{10}$/.test(clean)) return false

    // Primeiro dígito
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(clean[i]) * (10 - i)
    }
    let digit1 = 11 - (sum % 11)
    digit1 = digit1 >= 10 ? 0 : digit1

    if (parseInt(clean[9]) !== digit1) return false

    // Segundo dígito
    sum = 0
    for (let i = 0; i < 10; i++) {
      sum += parseInt(clean[i]) * (11 - i)
    }
    let digit2 = 11 - (sum % 11)
    digit2 = digit2 >= 10 ? 0 : digit2

    return parseInt(clean[10]) === digit2
  }

  /**
   * Valida WhatsApp brasileiro
   */
  static validateWhatsApp(phone: string): boolean {
    const clean = phone.replace(/\D/g, '')
    // DDD (2 dígitos) + 9 dígitos (celular começa com 9)
    return /^55?[1-9]{2}9[0-9]{8}$/.test(clean)
  }

  /**
   * Valida CEP
   */
  static validateCEP(cep: string): boolean {
    const clean = cep.replace(/\D/g, '')
    return clean.length === 8
  }

  /**
   * Valida CNPJ
   */
  static validateCNPJ(cnpj: string): boolean {
    const clean = cnpj.replace(/\D/g, '')

    if (clean.length !== 14) return false
    if (/^(\d)\1{13}$/.test(clean)) return false

    // Primeiro dígito
    let sum = 0
    let multiplier = 5
    for (let i = 0; i < 12; i++) {
      sum += parseInt(clean[i]) * multiplier
      multiplier = multiplier === 2 ? 9 : multiplier - 1
    }
    let digit1 = 11 - (sum % 11)
    digit1 = digit1 >= 10 ? 0 : digit1

    if (parseInt(clean[12]) !== digit1) return false

    // Segundo dígito
    sum = 0
    multiplier = 6
    for (let i = 0; i < 13; i++) {
      sum += parseInt(clean[i]) * multiplier
      multiplier = multiplier === 2 ? 9 : multiplier - 1
    }
    let digit2 = 11 - (sum % 11)
    digit2 = digit2 >= 10 ? 0 : digit2

    return parseInt(clean[13]) === digit2
  }

  /**
   * Formata CPF
   */
  static formatCPF(cpf: string): string {
    const clean = cpf.replace(/\D/g, '')
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  /**
   * Formata WhatsApp
   */
  static formatWhatsApp(phone: string): string {
    const clean = phone.replace(/\D/g, '')
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  /**
   * Formata CEP
   */
  static formatCEP(cep: string): string {
    const clean = cep.replace(/\D/g, '')
    return clean.replace(/(\d{5})(\d{3})/, '$1-$2')
  }

  /**
   * Formata CNPJ
   */
  static formatCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '')
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
}
