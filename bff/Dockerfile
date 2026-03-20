FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production
COPY server.js .
EXPOSE 3101
USER node
CMD ["node", "server.js"]
