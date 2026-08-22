# Étape 1 : build de l'export statique Next.js 
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Étape 2 : image finale
FROM nginx:alpine

COPY --from=builder /app/out /usr/share/nginx/html

RUN sed -i 's/listen\s*80;/listen 8081;/' /etc/nginx/conf.d/default.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8081

ENTRYPOINT ["/entrypoint.sh"]