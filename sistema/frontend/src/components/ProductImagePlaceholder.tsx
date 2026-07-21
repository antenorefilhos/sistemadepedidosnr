interface ProductImagePlaceholderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: { svg: 'w-8 h-8', text: 'text-[8px]' },
  md: { svg: 'w-16 h-16', text: 'text-[9px]' },
  lg: { svg: 'w-24 h-24', text: 'text-xs' },
}

export function ProductImagePlaceholder({ size = 'md', className = '' }: ProductImagePlaceholderProps) {
  const s = sizeMap[size]
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-[#e8e8e8] ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" className={`${s.svg} opacity-60`}>
        <rect x="10" y="18" width="60" height="44" rx="4" fill="none" stroke="#aaa" strokeWidth="3"/>
        <circle cx="54" cy="30" r="5" fill="none" stroke="#aaa" strokeWidth="3"/>
        <polyline points="10,55 28,38 42,50 54,40 70,55" fill="none" stroke="#aaa" strokeWidth="3" strokeLinejoin="round"/>
        <line x1="5" y1="5" x2="75" y2="75" stroke="#aaa" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
      <span className={`${s.text} font-bold tracking-[0.12em] text-[#aaa] uppercase leading-tight text-center px-1`}>
        Produto sem foto
      </span>
    </div>
  )
}
