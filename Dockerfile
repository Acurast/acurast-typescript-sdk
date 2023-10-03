FROM node:16.19.1

RUN apt-get update && apt-get install -yq git build-essential

# create libs directory
RUN mkdir /libs
WORKDIR /libs

# copy sources
COPY . /libs

# set permissions
RUN chmod +x ./npm-ci-publish-beta-only.sh
RUN chmod +x ./npm-ci-publish.sh

# install dependencies
RUN yarn install --frozen-lockfile

# set to production
RUN export NODE_ENV=production

# build
RUN yarn build

CMD ["yarn", "test"]


