// JON-104 (Auditoria 360, Low): arquivo antes tinha sintaxe YAML dentro de um
// .js -- PM2 falhava ao carregar (nao era JavaScript valido). Corrigido pra
// module.exports de verdade em 35bd2e3c.
module.exports = {
  apps: [
    {
      name: 'mercado-antenor-backend',
      script: './dist/main.js',
      cwd: './backend',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'mercado-antenor-frontend',
      script: 'serve',
      args: '-l 3000 dist',
      cwd: './frontend',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'mercado-antenor-admin',
      script: 'serve',
      args: '-l 3002 dist',
      cwd: './admin',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
