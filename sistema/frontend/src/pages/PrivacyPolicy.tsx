import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { SEO } from '../components/SEO'
import { Footer } from '../components/Footer'
import { MobileBottomNav } from '../components/MobileBottomNav'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Política de Privacidade"
        description="Como o Antenor & Filhos coleta, usa e protege seus dados, em conformidade com a LGPD (Lei 13.709/2018)."
      />

      <header className="sticky top-0 z-40 flex items-center gap-3 bg-[#5D082A] px-4 py-4 text-white">
        <Link to="/" className="-ml-1 rounded-lg p-1 transition-colors hover:bg-white/10">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <ShieldCheck size={20} className="text-[#D2BB8A]" />
          <h1 className="text-base font-bold tracking-tight">Política de Privacidade</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-[#231F20]">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.08em] text-[#8A6A3A]">
          Última atualização: agosto de 2026
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">1. Quem somos</h2>
        <p>
          O Antenor & Filhos é um supermercado e adega em funcionamento desde 1979, localizado na Estrada
          União e Indústria, Pedro do Rio, Petrópolis - RJ. Esta política explica como coletamos, usamos,
          armazenamos e protegemos os dados pessoais de clientes que utilizam nosso site e aplicativo de
          pedidos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">2. Quais dados coletamos</h2>
        <p>Coletamos os dados necessários para viabilizar sua compra e entrega, entre eles:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Nome, CPF, e-mail e telefone/WhatsApp para identificação e contato sobre o pedido;</li>
          <li>Endereço de entrega, para que o pedido chegue corretamente até você;</li>
          <li>Histórico de pedidos e preferências de compra, para melhorar sua experiência;</li>
          <li>Dados de pagamento, processados diretamente pelo gateway de pagamento parceiro — não armazenamos número completo de cartão em nossos servidores;</li>
          <li>Dados técnicos de navegação (IP, dispositivo, cookies), para segurança e prevenção de fraude.</li>
        </ul>

        <h2 className="mb-2 mt-6 text-lg font-bold">3. Para que usamos seus dados</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Processar e entregar seu pedido corretamente;</li>
          <li>Emitir nota fiscal e cumprir obrigações fiscais/legais;</li>
          <li>Comunicar atualizações sobre o status do pedido (WhatsApp, e-mail, notificação push);</li>
          <li>Prevenir fraudes e proteger a segurança da plataforma;</li>
          <li>Melhorar nossos produtos, ofertas e experiência de compra, com sua autorização.</li>
        </ul>

        <h2 className="mb-2 mt-6 text-lg font-bold">4. Segurança dos pagamentos</h2>
        <p>
          As transações de pagamento são processadas por um gateway de pagamento especializado, com
          conexão criptografada (SSL/HTTPS) e conformidade com os padrões de segurança do setor. O
          Antenor & Filhos não tem acesso ao número completo do seu cartão de crédito.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">5. Compartilhamento de dados</h2>
        <p>
          Compartilhamos dados somente com parceiros estritamente necessários para a operação do serviço:
          gateway de pagamento, equipe de entrega e sistemas de emissão fiscal. Não vendemos nem alugamos
          seus dados pessoais a terceiros para fins de marketing.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">6. Seus direitos como titular dos dados</h2>
        <p>Conforme a LGPD, você tem direito a:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Confirmar a existência de tratamento dos seus dados;</li>
          <li>Acessar, corrigir ou atualizar seus dados cadastrais a qualquer momento pela sua conta;</li>
          <li>Solicitar a exclusão dos seus dados, respeitadas obrigações legais de guarda fiscal;</li>
          <li>Revogar consentimentos dados anteriormente, como o recebimento de notificações promocionais;</li>
          <li>Solicitar a portabilidade dos seus dados a outro fornecedor.</li>
        </ul>
        <p className="mt-2">
          Para exercer qualquer um desses direitos, entre em contato pelo WhatsApp de atendimento indicado
          no rodapé do site.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">7. Retenção de dados</h2>
        <p>
          Mantemos seus dados pelo tempo necessário para cumprir a finalidade para a qual foram coletados,
          incluindo prazos de guarda fiscal exigidos por lei, mesmo após o encerramento da conta.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">8. Alterações nesta política</h2>
        <p>
          Esta política pode ser atualizada periodicamente. Recomendamos revisá-la de tempos em tempos.
          Mudanças relevantes serão comunicadas pelos nossos canais oficiais.
        </p>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
