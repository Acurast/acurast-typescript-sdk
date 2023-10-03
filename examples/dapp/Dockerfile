FROM node:18-alpine

RUN npm install -g serve

WORKDIR /sdk

RUN mkdir -p ./packages/acurast-dapp
RUN mkdir -p ./packages/acurast-transport-websocket

COPY packages/acurast-dapp/package.json ./packages/acurast-dapp/package.json
COPY packages/acurast-transport-websocket/package.json ./packages/acurast-transport-websocket/package.json

COPY package.json .
COPY yarn.lock .

COPY lerna.json .

RUN yarn install

COPY . .

RUN yarn build

RUN mkdir -p ./examples/dapp
WORKDIR /sdk/examples/dapp

COPY examples/dapp/package.json .
COPY examples/dapp/package-lock.json .

RUN npm install

COPY examples/dapp .

RUN npm run build:dev

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]