/**
 * Texto do estado dos avisos no navegador -- o sininho e o cartao "Avise-me
 * das ofertas" (Promocoes) dizem a mesma coisa. Instrucao de desbloqueio muda
 * entre desktop e Android: mandar procurar um "cadeado" no celular e mandar
 * procurar o que nao existe.
 */
export function pushStatusMessage(pushStatus: string, pushPermission: string, idleText = 'Receba avisos de pedido e campanhas.'): string {
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  if (pushStatus === 'enabled') return 'Notificações ativas neste navegador.'
  if (pushPermission === 'granted') return 'Permissão concedida; conclua a ativação.'
  if (pushStatus === 'denied' || pushPermission === 'denied') return isAndroid
    ? 'Permissão bloqueada neste navegador. Para reativar: toque no ícone à esquerda do endereço do site, depois em Permissões e mude "Notificações" para Permitir.'
    : 'Permissão bloqueada no navegador. Para reativar: clique no cadeado/ícone ao lado do endereço do site e mude "Notificações" para Permitir.'
  // Dispensou sem escolher -- da pra perguntar de novo. No Android o aviso
  // costuma vir como um sininho discreto na barra de endereco.
  if (pushStatus === 'dismissed') return isAndroid
    ? 'O aviso foi fechado sem resposta. Toque em Ativar de novo e escolha Permitir — no Android, a pergunta pode aparecer como um sininho na barra de endereço.'
    : 'O aviso foi fechado sem resposta. Toque em Ativar notificações de novo e escolha Permitir.'
  if (pushStatus === 'ios-needs-install') return 'No iPhone/iPad, toque em Compartilhar e depois em "Adicionar à Tela de Início" para poder ativar notificações — o Safari não permite isso numa aba comum.'
  if (pushStatus === 'ios-outdated') return 'Atualize o iOS para a versão 16.4 ou mais recente para ativar notificações.'
  if (pushStatus === 'insecure-context') return 'Notificações só funcionam em conexão segura (https). Acesse o site pelo endereço oficial para ativar.'
  if (pushStatus === 'unsupported') return 'Este navegador não tem suporte a notificações push. Tente pelo Chrome, Edge ou Firefox atualizados.'
  if (pushStatus === 'missing-key') return 'Notificações push estão temporariamente desativadas neste site (configuração pendente). Não é um problema do seu navegador — tente novamente mais tarde.'
  if (pushStatus === 'error') return 'Não foi possível ativar agora.'
  return idleText
}
