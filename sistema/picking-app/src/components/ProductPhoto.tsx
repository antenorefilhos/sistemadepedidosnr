import { useMemo, useState } from 'react'
import { Package } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''
// Mesma versao da loja (01/10/2026): URL nova na borda, cache curto no navegador.
const IMAGE_VERSION = '3'

/** Foto do produto pelo EAN (miniatura, depois a original); sem foto, o icone. */
export function ProductPhoto({ ean, className = 'h-14 w-14' }: { ean?: string | null; className?: string }) {
  const candidates = useMemo(
    () => (ean ? [`/thumbs/products/${ean}.webp`, `/uploads/products/${ean}.webp`, `/uploads/products/${ean}.jpg`].map((path) => `${API_URL}${path}?v=${IMAGE_VERSION}`) : []),
    [ean],
  )
  const [index, setIndex] = useState(0)
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white ${className}`}>
      {index < candidates.length ? (
        <img src={candidates[index]} alt="" loading="lazy" onError={() => setIndex((i) => i + 1)} className="h-full w-full object-contain p-0.5" />
      ) : (
        <Package size={18} className="text-gray-300" />
      )}
    </div>
  )
}
