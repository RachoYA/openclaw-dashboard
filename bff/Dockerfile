FROM node:22-alpine
WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production
COPY server.js .

EXPOSE 3101

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3101/health || exit 1

USER node
CMD ["node", "server.js"]
