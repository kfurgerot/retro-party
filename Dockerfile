# Frontend: build with Node then serve with nginx
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# If you use bun, you can adapt; npm is fine here.
RUN npm config set install-links true
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

