import { Link } from 'react-router-dom'
import { Instagram, MessageCircle, MapPin, Clock, CreditCard, QrCode, Banknote, Ticket } from 'lucide-react'
import { useBrand } from '../hooks/useBrand'

const PAYMENT_METHODS = [
  { label: 'Cartão de Crédito/Débito', icon: CreditCard },
  { label: 'PIX', icon: QrCode },
  { label: 'Dinheiro', icon: Banknote },
  { label: 'Vale/Ticket Alimentação (Ticket, VR, Sodexo, Alelo)', icon: Ticket },
]

const INSTITUTIONAL_LINKS = [
  { label: 'Políticas de Privacidade', to: '/privacidade' },
  { label: 'Termos de Uso', to: '/termos' },
  { label: 'LGPD & Privacidade de Dados', to: '/privacidade' },
  { label: 'Mapa do Site', href: '/sitemap.xml' },
]

/** Rodape institucional do storefront -- identidade, links, redes, pagamento e horario. */
export function Footer() {
  const brand = useBrand()
  const whatsappDigits = (brand.contactWhatsapp || '').replace(/\D/g, '')
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null

  return (
    <footer className="border-t border-[#E8D7B0]/60 bg-[#FBF7F0] text-[#5d4f33]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Identidade & Localização */}
          <div>
            <h3 className="text-base font-bold text-[#231F20]">Antenor & Filhos</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#8A6A3A]">
              Supermercado & Adega desde 1979
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#5D082A]" />
              Estrada União e Indústria, Pedro do Rio, Petrópolis - RJ
            </p>
            <p className="mt-2 text-xs text-[#8A6A3A]">CNPJ disponível na nota fiscal</p>
          </div>

          {/* Links institucionais */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Institucional</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {INSTITUTIONAL_LINKS.map((link) => (
                <li key={link.label}>
                  {'to' in link && link.to ? (
                    <Link to={link.to} className="hover:text-[#5D082A] hover:underline">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="hover:text-[#5D082A] hover:underline">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Redes sociais + horário */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Fale Conosco</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="https://instagram.com/antenorefilhos.pedrodorio"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-[#5D082A] hover:underline"
                >
                  <Instagram size={16} className="shrink-0 text-[#5D082A]" />
                  @antenorefilhos.pedrodorio
                </a>
              </li>
              {whatsappUrl && (
                <li>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:text-[#5D082A] hover:underline"
                  >
                    <MessageCircle size={16} className="shrink-0 text-[#5D082A]" />
                    WhatsApp de Atendimento
                  </a>
                </li>
              )}
            </ul>
            {brand.businessHours && (
              <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed">
                <Clock size={16} className="mt-0.5 shrink-0 text-[#5D082A]" />
                {brand.businessHours}
              </p>
            )}
          </div>

          {/* Formas de pagamento */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Formas de Pagamento</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {PAYMENT_METHODS.map((method) => (
                <li key={method.label} className="flex items-center gap-2">
                  <method.icon size={16} className="shrink-0 text-[#5D082A]" />
                  {method.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[#E8D7B0]/60 pt-6 text-center text-xs text-[#8A6A3A]">
          © {new Date().getFullYear() /* eslint-disable-line -- ano corrente, so muda uma vez por ano no build */} Antenor & Filhos. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
