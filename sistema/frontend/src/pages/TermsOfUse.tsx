import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { SEO } from '../components/SEO'
import { Footer } from '../components/Footer'
import { MobileBottomNav } from '../components/MobileBottomNav'

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Termos e Condições de Uso"
        description="Termos e condições de uso da plataforma de pedidos do Antenor & Filhos: entregas, cancelamento, pesáveis e pagamento."
      />

      <header className="sticky top-0 z-40 flex items-center gap-3 bg-[#5D082A] px-4 py-4 text-white">
        <Link to="/" className="-ml-1 rounded-lg p-1 transition-colors hover:bg-white/10">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <FileText size={20} className="text-[#D2BB8A]" />
          <h1 className="text-base font-bold tracking-tight">Termos de Uso</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-[#231F20]">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.08em] text-[#8A6A3A]">
          Última atualização: agosto de 2026
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">1. Sobre esta plataforma</h2>
        <p>
          Estes termos regulam o uso do site e aplicativo de pedidos do Antenor & Filhos, supermercado e
          adega em funcionamento desde 1979 em Pedro do Rio, Petrópolis - RJ. Ao criar uma conta ou
          realizar um pedido, você concorda com as condições descritas aqui.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">2. Área de entrega e prazos</h2>
        <p>
          As entregas atendem Pedro do Rio e região de Petrópolis - RJ, conforme as zonas de entrega
          cadastradas no site. O prazo estimado é exibido no momento da confirmação do endereço e pode
          variar de acordo com o volume de pedidos e a disponibilidade da equipe de entrega. Pedidos feitos
          fora do horário de funcionamento são processados no próximo dia útil.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">3. Produtos pesáveis</h2>
        <p>
          Itens vendidos por peso (hortifrúti, açougue, padaria) têm o valor calculado com base numa
          porção estimada no momento do pedido. O valor final é ajustado pela nossa equipe conforme o peso
          real do item na separação, respeitando o passo mínimo de venda de cada produto. A diferença entre
          o valor estimado e o valor real é refletida na cobrança final.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">4. Disponibilidade de produtos</h2>
        <p>
          O estoque exibido no site é sincronizado com nosso sistema interno, mas pode haver divergências
          pontuais entre a disponibilidade mostrada e o estoque físico real no momento da separação. Caso
          um item fique indisponível após a confirmação do pedido, você será avisado e poderá optar por
          substituição, remoção do item ou reembolso do valor correspondente.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">5. Formas de pagamento</h2>
        <p>
          Aceitamos cartão de crédito/débito, PIX, dinheiro na entrega e vale/ticket alimentação (Ticket,
          VR, Sodexo, Alelo), conforme disponibilidade exibida no checkout. Pagamentos com cartão e PIX são
          processados por gateway de pagamento parceiro, com conexão segura.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">6. Cancelamento e trocas</h2>
        <p>
          Pedidos podem ser cancelados sem custo enquanto ainda não entraram em separação. Após o início
          da separação, o cancelamento fica sujeito à análise da equipe. Produtos entregues com problema de
          qualidade ou divergência do pedido podem ser reportados pelo WhatsApp de atendimento em até 24
          horas após a entrega, para troca ou reembolso.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">7. Conta e cadastro</h2>
        <p>
          Você é responsável por manter a confidencialidade da sua senha e por todas as atividades
          realizadas na sua conta. Contas identificadas com atividade fraudulenta podem ser suspensas,
          conforme critério da nossa equipe.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">8. Privacidade</h2>
        <p>
          O tratamento dos seus dados pessoais segue nossa{' '}
          <Link to="/privacidade" className="font-semibold text-[#5D082A] hover:underline">
            Política de Privacidade
          </Link>
          , em conformidade com a LGPD.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-bold">9. Alterações nestes termos</h2>
        <p>
          Estes termos podem ser atualizados periodicamente para refletir mudanças na operação ou na
          legislação aplicável. O uso contínuo da plataforma após uma atualização representa a aceitação
          dos novos termos.
        </p>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
