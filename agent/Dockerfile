FROM node:22-alpine
RUN apk add --no-cache kubectl
WORKDIR /app
COPY package.json ./
COPY index.mjs ./
USER node
CMD ["node", "index.mjs"]
