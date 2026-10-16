import type { CapacitorConfig } from '@capacitor/cli'

/**
 * App nativo (Android/iOS) do storefront, iniciado em 16/10/2026. `server.url`
 * aponta pro site de producao em vez de empacotar o `dist/` local -- o app
 * carrega sempre a versao ao vivo da loja, igual ao PWA. Decisao deliberada:
 * esse projeto builda e deploya varias vezes por semana (ver git log), e
 * empacotar `dist/` local exigiria reenviar o app pra Play Store/App Store a
 * cada mudanca de frontend. Com `server.url`, so muda o app nativo quando
 * algo do PROPRIO empacotamento muda (icone, splash, plugin nativo, permissao)
 * -- o resto do deploy continua identico ao que ja existe (build + rebuild do
 * container storefront, sem passo a mais).
 *
 * `webDir: 'dist'` ainda e obrigatorio pro Capacitor nao reclamar na inicializacao,
 * mesmo sem ser usado em runtime com `server.url` definido.
 */
const config: CapacitorConfig = {
  appId: 'br.com.antenorefilhos.mercado',
  appName: 'Antenor & Filhos',
  webDir: 'dist',
  server: {
    url: 'https://mercado.antenorefilhos.com.br',
    androidScheme: 'https',
    // cleartext nao habilitado de proposito -- producao e https, sempre.
  },
}

export default config
