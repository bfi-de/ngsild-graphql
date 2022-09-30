FROM node:18
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.json 
COPY voyager voyager
COPY src src
ENV PORT=${PORT:-4000}
EXPOSE ${4000}
CMD node --loader ts-node/esm src/index.ts

