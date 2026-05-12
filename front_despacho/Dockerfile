# STAGE 1 - BUILD: compilar React con Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# STAGE 2 - PRODUCTION: servir con Nginx
FROM nginx:alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /var/cache/apk/* /tmp/*
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
