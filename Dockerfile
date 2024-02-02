FROM node:lts-alpine 
RUN apk add vim
RUN mkdir /lab
COPY ./lavalab-1.0.0.tgz /lab/lavalab.tgz
RUN npm i -g /lab/lavalab.tgz
RUN chown -R node:node /lab
USER node
WORKDIR /lab