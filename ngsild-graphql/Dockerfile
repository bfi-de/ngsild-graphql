FROM node:18-slim
LABEL org.opencontainers.image.source=https://github.com/bfi-de/ngsild-graphql
LABEL org.opencontainers.image.description="A GraphQL interface for Fiware context brokers"
LABEL org.opencontainers.image.licenses=MIT
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.json 
COPY voyager voyager
COPY src src
ENV PORT=${PORT:-4000}
EXPOSE ${4000}
CMD node --loader ts-node/esm src/index.ts
