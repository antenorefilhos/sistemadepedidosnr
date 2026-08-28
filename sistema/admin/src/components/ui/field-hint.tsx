import { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Ícone de ajuda ao lado do rótulo de um campo, com a explicação em balão.
 *
 * Abre no hover (mouse) e no foco (teclado) -- `title` nativo do HTML nao
 * aparece no foco e some rapido demais pra texto de duas linhas, que e' o caso
 * aqui. O balao e' ligado ao botao por aria-describedby, entao leitor de tela
 * le a explicacao junto com o campo.
 *
 * Usar quando a duvida for "o que isso faz / quando eu mexo nisso". Quando a
 * informacao for curta e todo mundo precisa ver sempre (ex.: "Enter quebra a
 * linha"), continua valendo o texto embaixo do campo -- os dois no mesmo lugar
 * viram redundancia.
 */
export function FieldHint({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Ajuda sobre este campo"
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        // Toque nao tem hover: no celular o clique abre e fecha.
        onClick={(e) => {
          e.preventDefault();
          setAberto((v) => !v);
        }}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1"
      >
        <HelpCircle size={13} />
      </button>

      {aberto && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-normal leading-relaxed text-white shadow-lg"
        >
          {children}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-gray-900" />
        </span>
      )}
    </span>
  );
}
