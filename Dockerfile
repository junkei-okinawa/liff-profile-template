# Build stage
FROM node:20-alpine as build

# npm をメジャーバージョン 11 へアップデート（issue #14）
# lockfileVersion は npm 7+ 以降すべて v3 のため再生成不要
RUN npm install -g npm@11

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
