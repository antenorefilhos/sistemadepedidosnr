import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { SEO } from '../components/SEO'
import { Footer } from '../components/Footer'
import { MobileBottomNav } from '../components/MobileBottomNav'

const SECTIONS = [
  { id: 'apresentacao', label: 'Apresentação' },
  { id: 'cadastro', label: 'Cadastro do usuário' },
  { id: 'maioridade', label: 'Maioridade e restrição etária' },
  { id: 'compras', label: 'Compras e pedidos' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'entregas', label: 'Entregas e retiradas' },
  { id: 'promocoes', label: 'Promoções e benefícios' },
  { id: 'antifraude', label: 'Política antifraude e múltiplos cadastros' },
  { id: 'propriedade', label: 'Propriedade intelectual' },
  { id: 'responsabilidade', label: 'Limitação de responsabilidade' },
  { id: 'licenca', label: 'Licença de uso do aplicativo' },
  { id: 'foro', label: 'Legislação aplicável e foro' },
]

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Termos e Condições de Uso"
        description="Termos e condições de uso do aplicativo e site Antenor & Filhos: cadastro, pedidos, entregas, pagamentos e antifraude."
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
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A6A3A]">
          Aplicativo e site Antenor & Filhos · Última atualização: junho de 2026
        </p>

        <nav className="my-6 rounded-xl border border-[#E8D7B0]/60 bg-[#FBF7F0] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#8A6A3A]">Sumário</p>
          <ol className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[#5D082A] hover:underline">
                  {i + 1}. {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <h2 id="apresentacao" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">1. Apresentação</h2>
        <p>
          Bem-vindo ao aplicativo e site Antenor & Filhos. Este documento estabelece os Termos de Uso
          aplicáveis à utilização da plataforma, em conformidade com a Lei Geral de Proteção de Dados
          Pessoais (Lei nº 13.709/2018 – LGPD) no que se refere ao tratamento de dados. Ao realizar seu
          cadastro, acessar ou utilizar o aplicativo, o usuário declara ter lido, compreendido e concordado
          com todas as disposições deste documento.
        </p>
        <p className="mt-2 text-xs text-[#8A6A3A]">
          Razão Social: Nova Real Comércio de Produtos Alimentícios LTDA · Nome Fantasia: Antenor & Filhos ·
          CNPJ 05.147.995/0001-31 · Estrada União e Indústria, nº 22.099, Pedro do Rio, Petrópolis/RJ, CEP
          25750-222 · Telefone (24) 2237-7205
        </p>

        <h2 id="cadastro" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">2. Cadastro do usuário</h2>
        <p>
          Para utilizar determinadas funcionalidades do aplicativo, o usuário deverá realizar cadastro
          fornecendo informações verdadeiras, completas e atualizadas. O cadastro poderá exigir:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Nome completo;</li><li>CPF;</li><li>Data de nascimento;</li><li>Telefone;</li>
          <li>E-mail;</li><li>Endereço de entrega;</li>
          <li>Outras informações necessárias para a prestação dos serviços.</li>
        </ul>
        <p className="mt-2">
          O usuário é responsável pela guarda de suas credenciais de acesso e por todas as atividades
          realizadas em sua conta.
        </p>

        <h2 id="maioridade" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">3. Maioridade e produtos com restrição etária</h2>
        <p>
          O aplicativo destina-se exclusivamente a pessoas maiores de 18 (dezoito) anos. A comercialização
          de bebidas alcoólicas somente será realizada para maiores de 18 anos. A empresa poderá exigir
          documento oficial de identificação no momento da entrega ou retirada dos produtos. Caso sejam
          identificadas informações falsas sobre idade ou identidade, a conta poderá ser suspensa ou
          cancelada imediatamente.
        </p>

        <h2 id="compras" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">4. Compras e pedidos</h2>
        <p>
          Os produtos disponibilizados no aplicativo estão sujeitos à disponibilidade de estoque. A
          confirmação do pedido dependerá da aprovação do pagamento quando aplicável. A Antenor & Filhos
          reserva-se o direito de cancelar pedidos em situações excepcionais, incluindo:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>indisponibilidade de estoque;</li><li>falhas sistêmicas;</li>
          <li>inconsistências cadastrais;</li><li>suspeitas de fraude;</li>
          <li>erros evidentes de precificação.</li>
        </ul>
        <p className="mt-2">Nesses casos, o cliente será comunicado pelos canais cadastrados.</p>
        <p className="mt-2">
          Itens vendidos por peso (hortifrúti, açougue, padaria) têm o valor calculado com base numa porção
          estimada no momento do pedido, ajustado pela nossa equipe conforme o peso real na separação.
        </p>

        <h2 id="pagamentos" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">5. Pagamentos</h2>
        <p>O aplicativo poderá aceitar, entre outros:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>PIX;</li><li>Cartões de crédito;</li><li>Cartões de débito;</li><li>Dinheiro.</li>
        </ul>
        <p className="mt-2">
          O processamento dos pagamentos poderá ocorrer por intermédio de instituições financeiras,
          adquirentes ou parceiros autorizados. A empresa não armazena integralmente os dados dos cartões
          utilizados nas transações.
        </p>

        <h2 id="entregas" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">6. Entregas e retiradas</h2>
        <p>
          Os pedidos poderão ser recebidos por entrega ou retirada na loja, conforme disponibilidade, para
          a região de Pedro do Rio e Petrópolis/RJ. Os prazos de entrega informados são estimativas e
          poderão sofrer alterações por fatores externos, incluindo:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>condições climáticas;</li><li>trânsito;</li>
          <li>indisponibilidade operacional;</li><li>eventos de força maior.</li>
        </ul>
        <p className="mt-2">
          É responsabilidade do cliente fornecer endereço correto e atualizado. A ausência de pessoa apta
          para receber a entrega poderá gerar necessidade de reagendamento ou cancelamento.
        </p>

        <h2 id="promocoes" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">7. Promoções e benefícios</h2>
        <p>
          Promoções, descontos, cupons e benefícios poderão possuir regras específicas divulgadas pela
          empresa. A Antenor & Filhos poderá limitar promoções por CPF, endereço, telefone, conta cadastrada
          ou período promocional. O descumprimento dessas regras poderá resultar no cancelamento do
          benefício ou do pedido.
        </p>

        <h2 id="antifraude" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">8. Política antifraude e múltiplos cadastros</h2>
        <p>
          O usuário declara que todas as informações fornecidas são verdadeiras. A empresa reserva-se o
          direito de limitar, suspender ou cancelar pedidos, promoções, benefícios, cupons, descontos ou
          cadastros quando identificar indícios de fraude ou uso indevido da plataforma. Considera-se uso
          indevido, entre outras hipóteses:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>utilização de múltiplos cadastros;</li>
          <li>utilização de dados de terceiros sem autorização;</li>
          <li>tentativa de obtenção indevida de promoções;</li>
          <li>manipulação de regras comerciais;</li>
          <li>fornecimento de informações falsas.</li>
        </ul>
        <p className="mt-2">
          A utilização de múltiplos cadastros vinculados à mesma pessoa, residência, endereço ou grupo
          familiar para obtenção de vantagens comerciais poderá resultar no cancelamento dos pedidos e
          benefícios relacionados. O cancelamento de pedidos por descumprimento destas regras não impede
          futuras compras legítimas pelos canais da empresa, desde que observadas as condições comerciais
          vigentes.
        </p>

        <h2 id="propriedade" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">9. Propriedade intelectual</h2>
        <p>
          Todos os conteúdos do aplicativo, incluindo textos, imagens, logotipos, marcas, layouts e
          sistemas, são protegidos pela legislação aplicável. É proibida sua reprodução, cópia, distribuição
          ou utilização sem autorização prévia da empresa.
        </p>

        <h2 id="responsabilidade" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">10. Limitação de responsabilidade</h2>
        <p>A Antenor & Filhos não será responsável por:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>falhas causadas por terceiros;</li>
          <li>indisponibilidades temporárias de internet;</li>
          <li>danos decorrentes de uso inadequado do aplicativo;</li>
          <li>informações incorretas fornecidas pelo usuário.</li>
        </ul>

        <h2 id="licenca" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">11. Licença de uso do aplicativo</h2>
        <p>
          Ao baixar este aplicativo, você concorda em cumprir estes termos. Se você for menor de idade ou
          declarado incapaz, precisará da permissão de seus pais ou responsáveis, que também deverão
          concordar com estes termos.
        </p>
        <p className="mt-2">
          Você recebe uma licença limitada, não transferível, não exclusiva, livre de royalties e revogável
          para baixar, instalar, executar e utilizar este aplicativo em seu dispositivo — sem que isso
          transfira a você qualquer direito sobre o produto. É expressamente proibida a venda,
          transferência, modificação, engenharia reversa, distribuição ou cópia de textos, imagens ou
          quaisquer partes do aplicativo.
        </p>
        <p className="mt-2">
          A Antenor & Filhos reserva-se o direito de, a qualquer tempo, modificar estes termos, incluindo,
          removendo ou alterando cláusulas, com efeito imediato após a publicação. A empresa pode também
          modificar ou descontinuar (temporária ou permanentemente) a distribuição ou atualização deste
          aplicativo, sem obrigação de fornecer suporte, e sem responsabilização por tais modificações,
          suspensões ou descontinuidade.
        </p>
        <p className="mt-2">
          O aplicativo é fornecido "no estado em que se encontra", podendo conter erros, sem garantia de uso
          ininterrupto ou livre de falhas, vírus ou outra invasão de segurança. O usuário é responsável pelo
          backup do próprio dispositivo. Todas as informações fornecidas são tratadas sob a mais absoluta
          confidencialidade, usadas apenas para efetivar compras e enviar novidades pelo aplicativo — em
          hipótese alguma repassadas a terceiros fora do previsto na nossa{' '}
          <Link to="/privacidade" className="font-semibold text-[#5D082A] hover:underline">Política de Privacidade</Link>.
        </p>

        <h2 id="foro" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">12. Legislação aplicável e foro</h2>
        <p>
          Este documento será regido pelas leis da República Federativa do Brasil. Fica eleito o Foro da
          Comarca de Petrópolis/RJ para dirimir quaisquer controvérsias decorrentes da utilização do
          aplicativo, ressalvadas as hipóteses previstas na legislação de proteção ao consumidor.
        </p>
        <p className="mt-2">
          Ao utilizar o aplicativo Antenor & Filhos, o usuário declara que leu, compreendeu e concorda
          integralmente com os presentes Termos de Uso e com a{' '}
          <Link to="/privacidade" className="font-semibold text-[#5D082A] hover:underline">Política de Privacidade</Link>.
        </p>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
