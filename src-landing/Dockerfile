# Stage 1: Build
FROM node:18-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Serve
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback: route all requests to index.html
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
  try_files $uri $uri/ /index.html;\n\
  }\n\
  }\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
