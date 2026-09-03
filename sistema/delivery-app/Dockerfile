FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Chave publica do Web Push. Sem ela o app compila e roda, mas o botao de
# ativar avisos falha em 'sem-chave' -- e nada no build reclama, porque
# variavel VITE_ ausente vira undefined em silencio.
ARG VITE_VAPID_PUBLIC_KEY=
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
