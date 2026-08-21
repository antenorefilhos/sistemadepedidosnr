import { Link } from 'react-router-dom'
import { Instagram, MessageCircle, MapPin, Phone, Mail, Clock, CreditCard, QrCode, Banknote, Ticket, ShieldCheck, Lock } from 'lucide-react'
import { useBrand } from '../hooks/useBrand'

const PAYMENT_METHODS = [
  { label: 'Cartão de Crédito', icon: CreditCard },
  { label: 'Cartão de Débito', icon: CreditCard },
  { label: 'PIX', icon: QrCode },
  { label: 'Dinheiro', icon: Banknote },
  { label: 'Ticket, VR, Sodexo, Alelo', icon: Ticket },
]

const INSTITUTIONAL_LINKS = [
  { label: 'Políticas de Privacidade', to: '/privacidade' },
  { label: 'Termos de Uso', to: '/termos' },
  { label: 'LGPD & Privacidade de Dados', to: '/privacidade' },
  { label: 'Mapa do Site', href: '/sitemap.xml' },
]

function formatCnpj(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 14) return raw
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

/** Rodape institucional do storefront -- identidade, links, redes, pagamento e horario. */
export function Footer() {
  const brand = useBrand()
  const whatsappDigits = (brand.contactWhatsapp || '').replace(/\D/g, '')
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null
  const whatsappSecondaryDigits = (brand.whatsappSecondary || '').replace(/\D/g, '')
  const whatsappSecondaryUrl = whatsappSecondaryDigits ? `https://wa.me/${whatsappSecondaryDigits}` : null

  return (
    <footer className="border-t border-[#E8D7B0]/60 bg-[#FBF7F0] pb-28 text-[#5d4f33] md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4 md:gap-8">
          {/* Coluna 1: Identidade & Localização */}
          <div className="rounded-xl border border-[#E8D7B0]/60 bg-white/60 p-4 md:border-0 md:bg-transparent md:p-0">
            <h3 className="text-base font-bold text-[#231F20]">Antenor & Filhos</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#8A6A3A]">
              Desde 1979 · 47 anos de tradição
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#5D082A]" />
              Estrada União e Indústria, {brand.addressNumber ? `nº ${brand.addressNumber}` : ''} Pedro do Rio,
              Petrópolis - RJ{brand.addressCep ? ` - CEP ${brand.addressCep}` : ''}
            </p>
            {brand.phoneFixed && (
              <p className="mt-2 flex items-center gap-2 text-sm leading-relaxed">
                <Phone size={15} className="shrink-0 text-[#5D082A]" />
                {brand.phoneFixed}
              </p>
            )}
            <div className="mt-3 space-y-0.5 text-xs text-[#8A6A3A]">
              {brand.legalName && <p>{brand.legalName}</p>}
              <p>
                {brand.cnpj ? `CNPJ ${formatCnpj(brand.cnpj)}` : 'CNPJ disponível na nota fiscal'}
                {brand.stateRegistration ? ` · IE ${brand.stateRegistration}` : ''}
              </p>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#D2BB8A]/50 bg-[#F3E7C9]/50 px-3 py-1 text-label font-semibold text-[#8A6A3A]">
              <ShieldCheck size={13} className="text-[#5D082A]" />
              47 anos de tradição em Pedro do Rio
            </div>
          </div>

          {/* Coluna 2: Institucional & Ajuda */}
          <div className="rounded-xl border border-[#E8D7B0]/60 bg-white/60 p-4 md:border-0 md:bg-transparent md:p-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Institucional</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {INSTITUTIONAL_LINKS.map((link) => (
                <li key={link.label}>
                  {'to' in link && link.to ? (
                    <Link to={link.to} className="inline-block py-0.5 hover:text-[#5D082A] hover:underline">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="inline-block py-0.5 hover:text-[#5D082A] hover:underline">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3: Atendimento & Redes */}
          <div className="rounded-xl border border-[#E8D7B0]/60 bg-white/60 p-4 md:border-0 md:bg-transparent md:p-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Fale Conosco</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-sm font-semibold text-[#1c8f4d] transition-colors hover:bg-[#25D366]/20"
                >
                  <MessageCircle size={16} className="shrink-0" />
                  WhatsApp
                </a>
              )}
              {whatsappSecondaryUrl && (
                <a
                  href={whatsappSecondaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-sm font-semibold text-[#1c8f4d] transition-colors hover:bg-[#25D366]/20"
                >
                  <MessageCircle size={16} className="shrink-0" />
                  WhatsApp 2
                </a>
              )}
              <a
                href="https://instagram.com/antenorefilhos.pedrodorio"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D2BB8A]/50 bg-[#F3E7C9]/50 px-4 py-2 text-sm font-semibold text-[#8A6A3A] transition-colors hover:bg-[#F3E7C9]"
              >
                <Instagram size={16} className="shrink-0 text-[#5D082A]" />
                @antenorefilhos.pedrodorio
              </a>
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              {brand.emailCommercial && (
                <a href={`mailto:${brand.emailCommercial}`} className="flex items-center gap-2 hover:text-[#5D082A] hover:underline">
                  <Mail size={15} className="shrink-0 text-[#5D082A]" />
                  {brand.emailCommercial}
                </a>
              )}
              {brand.emailDpo && (
                <a href={`mailto:${brand.emailDpo}`} className="flex items-center gap-2 hover:text-[#5D082A] hover:underline">
                  <Mail size={15} className="shrink-0 text-[#5D082A]" />
                  {brand.emailDpo}
                </a>
              )}
            </div>
            {(brand.storeHoursText || brand.deliveryHoursText) && (
              <div className="mt-4 space-y-1.5 text-sm leading-relaxed">
                {brand.storeHoursText && (
                  <p className="flex items-start gap-2">
                    <Clock size={16} className="mt-0.5 shrink-0 text-[#5D082A]" />
                    {brand.storeHoursText}
                  </p>
                )}
                {brand.deliveryHoursText && (
                  <p className="flex items-start gap-2 pl-[24px] text-[#8A6A3A]">
                    {brand.deliveryHoursText}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Coluna 4: Formas de Pagamento & Segurança */}
          <div className="rounded-xl border border-[#E8D7B0]/60 bg-white/60 p-4 md:border-0 md:bg-transparent md:p-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Formas de Pagamento</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E8D7B0]/80 bg-white px-3 py-1.5 text-xs font-semibold text-[#5d4f33] shadow-sm"
                >
                  <method.icon size={14} className="shrink-0 text-[#5D082A]" />
                  {method.label}
                </span>
              ))}
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#D2BB8A]/50 bg-[#F3E7C9]/50 px-3 py-1 text-label font-semibold text-[#8A6A3A]">
              <Lock size={13} className="text-[#5D082A]" />
              Conexão segura SSL/HTTPS
            </div>
          </div>
        </div>

        {brand.traditionText && (
          <p className="mt-8 border-t border-[#E8D7B0]/60 pt-6 text-center text-sm italic leading-relaxed text-[#8A6A3A] md:mt-10">
            {brand.traditionText}
          </p>
        )}

        <div className="mt-6 border-t border-[#E8D7B0]/60 pt-6 text-center text-xs text-[#8A6A3A]">
          © {new Date().getFullYear() /* eslint-disable-line -- ano corrente, so muda uma vez por ano no build */} Antenor & Filhos. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
