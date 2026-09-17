FROM node:20-alpine AS builder
WORKDIR /app
# JON-66: picking-app e delivery-app compartilham @antenor/push-client
# (workspace npm) -- o build context virou a raiz de sistema/ pra que o
# Docker enxergue o workspace inteiro, nao so picking-app/ isolado. Copia so
# os manifestos primeiro (cache de camada: so reinstala se package.json
# mudar, nao a cada mudanca de codigo).
COPY package.json package-lock.json ./
COPY packages ./packages
COPY picking-app/package.json ./picking-app/package.json
COPY delivery-app/package.json ./delivery-app/package.json
RUN npm ci
COPY picking-app ./picking-app
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Chave publica do Web Push. Sem ela o app compila e roda, mas o botao de
# ativar avisos falha em 'sem-chave' -- e nada no build reclama, porque
# variavel VITE_ ausente vira undefined em silencio.
ARG VITE_VAPID_PUBLIC_KEY=
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
RUN npm run build --workspace=picking-app

FROM nginx:alpine
COPY picking-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/picking-app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
