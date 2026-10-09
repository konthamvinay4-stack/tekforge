FROM node:22-alpine
RUN apk add --no-cache kubectl
WORKDIR /app
COPY package.json ./
COPY index.mjs ./
USER 1000:1000
CMD ["node", "index.mjs"]
