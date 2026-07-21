# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install

# Copia código fonte
COPY . .

# Build da aplicação Vite
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- Stage 2: Production ---
FROM nginx:alpine AS runner

# Copia configuração personalizada do Nginx (deve estar dentro do build context)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia assets estáticos do builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
