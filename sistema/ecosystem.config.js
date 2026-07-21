apps:
  - name: 'mercado-antenor-backend'
    script: './dist/main.js'
    cwd: './backend'
    instances: 2
    exec_mode: 'cluster'
    watch: false
    env:
      NODE_ENV: 'production'

  - name: 'mercado-antenor-frontend'
    script: 'serve'
    args: '-l 3000 dist'
    cwd: './frontend'
    instances: 1
    env:
      NODE_ENV: 'production'

  - name: 'mercado-antenor-admin'
    script: 'serve'
    args: '-l 3002 dist'
    cwd: './admin'
    instances: 1
    env:
      NODE_ENV: 'production'
