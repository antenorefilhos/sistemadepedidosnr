import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { SEO } from '../components/SEO'
import { Footer } from '../components/Footer'
import { MobileBottomNav } from '../components/MobileBottomNav'

const SECTIONS = [
  { id: 'identificacao', label: 'Identificação da empresa' },
  { id: 'dados-coletados', label: 'Dados pessoais coletados' },
  { id: 'finalidades', label: 'Finalidades do tratamento' },
  { id: 'bases-legais', label: 'Bases legais' },
  { id: 'notificacoes', label: 'Notificações e comunicações' },
  { id: 'compartilhamento', label: 'Compartilhamento de dados' },
  { id: 'seguranca', label: 'Segurança das informações' },
  { id: 'retencao', label: 'Retenção dos dados' },
  { id: 'direitos', label: 'Direitos dos titulares' },
  { id: 'exclusao', label: 'Exclusão de conta' },
  { id: 'cookies', label: 'Cookies e tecnologias semelhantes' },
  { id: 'alteracoes', label: 'Alterações desta política' },
]

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Política de Privacidade"
        description="Como o Antenor & Filhos coleta, usa e protege seus dados pessoais, em conformidade com a LGPD (Lei 13.709/2018)."
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
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A6A3A]">
          Aplicativo e site Antenor & Filhos · Última atualização: junho de 2026
        </p>
        <p className="mt-3">
          Este documento estabelece a Política de Privacidade aplicável à utilização do aplicativo e site
          Antenor & Filhos, bem como as regras relativas ao tratamento de dados pessoais dos usuários, em
          conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD). Ao
          realizar seu cadastro, acessar ou utilizar a plataforma, o usuário declara ter lido, compreendido
          e concordado com todas as disposições deste documento.
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

        <h2 id="identificacao" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">1. Identificação da empresa</h2>
        <p><strong>Razão Social:</strong> Nova Real Comércio de Produtos Alimentícios LTDA</p>
        <p><strong>Nome Fantasia:</strong> Antenor & Filhos</p>
        <p><strong>CNPJ:</strong> 05.147.995/0001-31</p>
        <p><strong>Inscrição Estadual:</strong> 77.403.31-0</p>
        <p><strong>Endereço:</strong> Estrada União e Indústria, nº 22.099, Pedro do Rio, Petrópolis/RJ, CEP 25750-222</p>
        <p><strong>Telefone:</strong> (24) 2237-7205</p>
        <p><strong>E-mail de atendimento e privacidade:</strong> marketing@antenorefilhos.com.br</p>

        <h2 id="dados-coletados" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">2. Dados pessoais coletados</h2>
        <p>Poderão ser coletados:</p>
        <p className="mt-3 font-semibold">Dados cadastrais</p>
        <ul className="ml-5 list-disc space-y-1"><li>Nome</li><li>CPF</li><li>Data de nascimento</li><li>Telefone</li><li>E-mail</li><li>Endereço</li></ul>
        <p className="mt-3 font-semibold">Dados de compra</p>
        <ul className="ml-5 list-disc space-y-1"><li>Histórico de pedidos</li><li>Produtos adquiridos</li><li>Valores pagos</li><li>Frequência de compras</li></ul>
        <p className="mt-3 font-semibold">Dados de localização</p>
        <ul className="ml-5 list-disc space-y-1"><li>Localização geográfica</li><li>Área de atendimento</li><li>Informações necessárias para cálculo de frete e entrega</li></ul>
        <p className="mt-3 font-semibold">Dados de utilização</p>
        <ul className="ml-5 list-disc space-y-1"><li>Páginas acessadas</li><li>Produtos visualizados</li><li>Interações com o aplicativo</li><li>Informações técnicas do dispositivo</li></ul>
        <p className="mt-3">
          Você concorda que a Antenor & Filhos pode coletar e usar dados técnicos de seu dispositivo, tais
          como especificações, configurações, versões de sistema operacional, tipo de conexão à internet e
          afins.
        </p>

        <h2 id="finalidades" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">3. Finalidades do tratamento</h2>
        <p>Os dados poderão ser utilizados para:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>processamento de pedidos;</li>
          <li>realização de entregas;</li>
          <li>retirada de produtos;</li>
          <li>atendimento ao cliente;</li>
          <li>emissão de documentos fiscais;</li>
          <li>prevenção de fraudes;</li>
          <li>cumprimento de obrigações legais;</li>
          <li>melhoria dos serviços;</li>
          <li>personalização da experiência;</li>
          <li>envio de notificações;</li>
          <li>campanhas promocionais;</li>
          <li>comunicações operacionais.</li>
        </ul>

        <h2 id="bases-legais" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">4. Bases legais</h2>
        <p>O tratamento dos dados poderá ocorrer com fundamento em:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>execução de contrato;</li>
          <li>cumprimento de obrigação legal;</li>
          <li>exercício regular de direitos;</li>
          <li>legítimo interesse;</li>
          <li>consentimento do titular, quando aplicável.</li>
        </ul>

        <h2 id="notificacoes" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">5. Notificações e comunicações</h2>
        <p>O aplicativo poderá enviar notificações relacionadas a:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>pedidos;</li><li>entregas;</li><li>atualizações de cadastro;</li><li>promoções;</li>
          <li>campanhas comerciais;</li><li>novidades e ofertas.</li>
        </ul>
        <p className="mt-2">
          O usuário poderá desativar notificações diretamente nas configurações do dispositivo quando
          disponível.
        </p>

        <h2 id="compartilhamento" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">6. Compartilhamento de dados</h2>
        <p>Os dados poderão ser compartilhados com:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>processadores de pagamento;</li>
          <li>prestadores de tecnologia;</li>
          <li>empresas de logística;</li>
          <li>fornecedores de hospedagem e armazenamento;</li>
          <li>autoridades públicas quando exigido por lei.</li>
        </ul>
        <p className="mt-2">
          O compartilhamento ocorrerá apenas quando necessário para as finalidades previstas neste
          documento. Em hipótese alguma informações a seu respeito serão repassadas a terceiros para fins
          diversos dos aqui previstos.
        </p>

        <h2 id="seguranca" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">7. Segurança das informações</h2>
        <p>A empresa adota medidas técnicas e administrativas destinadas à proteção dos dados pessoais contra:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>acesso não autorizado;</li><li>vazamento;</li><li>destruição;</li><li>alteração;</li><li>divulgação indevida.</li>
        </ul>
        <p className="mt-2">Apesar dos esforços empregados, nenhum sistema é completamente imune a riscos.</p>

        <h2 id="retencao" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">8. Retenção dos dados</h2>
        <p>Os dados serão mantidos pelo período necessário para:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>execução dos serviços;</li>
          <li>cumprimento de obrigações legais;</li>
          <li>atendimento a exigências regulatórias;</li>
          <li>exercício regular de direitos da empresa.</li>
        </ul>
        <p className="mt-2">
          Após esse período, os dados poderão ser eliminados ou anonimizados conforme a legislação
          aplicável.
        </p>

        <h2 id="direitos" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">9. Direitos dos titulares</h2>
        <p>Nos termos da LGPD, o titular poderá solicitar:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>confirmação da existência de tratamento;</li>
          <li>acesso aos dados;</li>
          <li>correção de dados incompletos ou incorretos;</li>
          <li>anonimização;</li>
          <li>bloqueio ou eliminação de dados;</li>
          <li>portabilidade;</li>
          <li>informações sobre compartilhamentos;</li>
          <li>revogação de consentimento quando aplicável.</li>
        </ul>
        <p className="mt-2">
          Solicitações poderão ser encaminhadas para{' '}
          <a href="mailto:marketing@antenorefilhos.com.br" className="font-semibold text-[#5D082A] hover:underline">
            marketing@antenorefilhos.com.br
          </a>
          .
        </p>

        <h2 id="exclusao" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">10. Exclusão de conta</h2>
        <p>
          O usuário poderá solicitar a exclusão de sua conta por meio dos canais oficiais de atendimento. A
          exclusão poderá não abranger informações cuja manutenção seja exigida por obrigação legal,
          regulatória ou para exercício regular de direitos.
        </p>

        <h2 id="cookies" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">11. Cookies e tecnologias semelhantes</h2>
        <p>O aplicativo poderá utilizar cookies, identificadores e tecnologias similares para:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>funcionamento da plataforma;</li><li>autenticação;</li><li>segurança;</li>
          <li>análise de uso;</li><li>melhoria da experiência do usuário.</li>
        </ul>

        <h2 id="alteracoes" className="mb-2 mt-8 scroll-mt-20 text-lg font-bold">12. Alterações desta política</h2>
        <p>
          A empresa poderá alterar este documento a qualquer momento para adequação legal, operacional ou
          tecnológica. As alterações passarão a produzir efeitos após sua publicação no aplicativo/site.
        </p>
        <p className="mt-2">
          Este documento é regido pelas leis da República Federativa do Brasil, ficando eleito o Foro da
          Comarca de Petrópolis/RJ para dirimir controvérsias, ressalvadas as hipóteses previstas na
          legislação de proteção ao consumidor. Ver também nossos{' '}
          <Link to="/termos" className="font-semibold text-[#5D082A] hover:underline">Termos de Uso</Link>.
        </p>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
