FROM node:22-alpine
WORKDIR /app
COPY dist/game/core ./dist/game/core
COPY dist/config ./dist/config
COPY backend/server.mjs backend/security.mjs ./backend/
COPY package.json ./
USER node
ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787
CMD ["node", "backend/server.mjs"]
