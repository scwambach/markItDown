FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN cd client && npm install
RUN cd server && npm install

COPY client ./client
COPY server ./server

RUN cd client && npm run build

FROM node:22-bookworm-slim
WORKDIR /app

COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY README.md ./README.md

RUN mkdir -p /app/data /app/uploads

EXPOSE 5296

CMD ["node", "server/index.js"]
