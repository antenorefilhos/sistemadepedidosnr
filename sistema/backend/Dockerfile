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

# Remove deps de dev para economizar espaço
RUN npm prune --production

# --- Stage 2: Production ---
FROM node:20-alpine AS runner

WORKDIR /app

# Configura ambiente
ENV NODE_ENV=production

# Prisma em Alpine requer OpenSSL disponível no runtime
RUN apk add --no-cache libc6-compat openssl

# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copia arquivos necessários do builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/scripts ./scripts

# Cria pasta de uploads e define permissões
RUN mkdir -p uploads && chown -R nestjs:nodejs uploads

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main"]
