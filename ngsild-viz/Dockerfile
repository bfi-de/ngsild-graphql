FROM node:18-slim
LABEL org.opencontainers.image.source=https://github.com/bfi-de/ngsild-graphql
LABEL org.opencontainers.image.description="A visulization for the NGSI-LD GraphQL interface"
LABEL org.opencontainers.image.licenses=MIT
WORKDIR /usr/src/app
COPY package.json ./
# why is that required?
RUN apt-get update && apt-get install -y git  
RUN npm install
COPY . .
ENV PORT=${PORT:-8080}
EXPOSE ${PORT:-8080}
ARG SERVER=http://localhost:4000/graphql
ARG GROUPS="[[\"Building\"], [\"Storey\"], [\"Room\"]]"
ARG QUERY="{__n  Rooms {__n    id__n    type__n    isRoomOf {__n      id__n      type__n      ceilingHeight__n      isStoreyOf {__n        id__n        type__n        constructed__n      }__n    }__n  }__n}"
ARG _CONFIG_FILE_CONTENT=" \
{ \
    \"server\": \"${SERVER}\", \
    \"initialLayout\": \"custom\", \
    \"initialQuery\": \"${QUERY}\", \
    \"initialGroups\": ${GROUPS} \
} \
"
RUN echo "${_CONFIG_FILE_CONTENT}" > /usr/src/app/assets/config.json
# not working due to css imports ; TODO better use webpack for building only and serve via some prod web server
#CMD node --loader ts-node/esm src/index.ts
#RUN ./node_modules/webpack/bin/webpack.js build
CMD ./node_modules/webpack/bin/webpack.js serve --mode development
