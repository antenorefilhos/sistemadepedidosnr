import { readdirSync } from 'fs'
import { join } from 'path'

/**
 * EANs com foto principal salva (uploads/products/<ean>.<webp|jpg|jpeg|png>).
 * Unica regra de "tem foto" para Produtos, Departamentos e o check-up da Visao
 * geral -- em 01/10/2026 o check-up contava outro universo e outro horario e
 * mostrava 216 sem foto enquanto a tela Produtos mostrava 195.
 */
export function eansWithPhoto(): Set<string> {
  let files: string[] = []
  try {
    files = readdirSync(join(process.cwd(), 'uploads', 'products'))
  } catch {
    files = []
  }
  return new Set(files.filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).map((f) => f.replace(/\.[^.]+$/, '')))
}
