# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências necessárias para compilação (ex: python para node-gyp se necessário)
RUN apk add --no-cache libc6-compat

# Copia arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala todas as dependências (incluindo dev)
RUN npm install

# Copia código fonte
COPY . .

# Gera o Prisma Client e faz o build do NestJS
RUN npx prisma generate
RUN npm run build

# NAO faz "npm prune --production": "prisma db seed" roda via ts-node em
# runtime (prisma.seed no package.json), que precisa de ts-node/typescript/
# @types/* -- prune quebrava o seed com TS7016 (bcrypt sem .d.ts) na primeira
# vez que rodou de verdade contra uma imagem de producao real. Disco nao e o
# gargalo aqui.

# --- Stage 2: Production ---
FROM node:20-alpine AS runner

WORKDIR /app

# Configura ambiente
ENV NODE_ENV=production

# Prisma em Alpine requer OpenSSL disponível no runtime
RUN apk add --no-cache libc6-compat openssl unzip

# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copia arquivos necessários do builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/scripts ./scripts
# JSON de dados lido por scripts/seed-delivery-zones.ts em runtime (nao e
# TS compilado, "dist" nao carrega ele sozinho)
COPY --from=builder --chown=nestjs:nodejs /app/src/modules/delivery/data ./src/modules/delivery/data
# Fotos-fonte lidas por scripts/seed-banner-templates.js em runtime (mesmo
# motivo do delivery/data acima -- nao faz parte do "dist" compilado)
COPY --from=builder --chown=nestjs:nodejs /app/assets ./assets

# Cria pasta de uploads e define permissões
RUN mkdir -p uploads && chown -R nestjs:nodejs uploads

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main"]
