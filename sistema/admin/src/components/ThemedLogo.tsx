/**
 * Logo para cartao claro/escuro: vinho no claro, branco no escuro (o vinho some no fundo
 * escuro). Duas imagens, e o Tailwind (`dark:`) mostra so uma; a oculta nao e anunciada.
 */
export default function ThemedLogo({ className = '' }: { className?: string }) {
  return (
    <>
      <img src="/branding/logo-horizontal-bordo.png" alt="Antenor & Filhos" className={`${className} dark:hidden`.trim()} />
      <img src="/branding/logo-horizontal-branco.png" alt="" aria-hidden="true" className={`${className} hidden dark:block`.trim()} />
    </>
  )
}
