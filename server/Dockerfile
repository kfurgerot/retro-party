FROM node:20-alpine
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY shared/ ../shared/
ENV PORT=3001
EXPOSE 3001
CMD ["node","index.js"]
