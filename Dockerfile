FROM node:24.20.0-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/tailor-frontend/browser /usr/share/nginx/html

ENV BACKEND_URL=http://host.docker.internal:3000
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1
