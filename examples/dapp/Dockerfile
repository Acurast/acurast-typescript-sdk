# Debian image like the root Dockerfile: @parcel/watcher (monorepo dependency) has no
# prebuilt binary for current Node on Alpine/musl and fails to compile there.
FROM node:24

RUN npm install -g serve

WORKDIR /sdk

# Install and build the whole monorepo first: the example links the workspace
# packages, and `lerna run build` builds all of them, so every workspace's
# package.json has to be present at install time (copying only two of them
# left the others without dependencies and the build failing).
COPY . .
RUN yarn install --frozen-lockfile
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