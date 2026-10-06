FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
# In a container the server must listen beyond loopback, so MCP_AUTH_TOKEN is required at run time.
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "dist/index.js"]
