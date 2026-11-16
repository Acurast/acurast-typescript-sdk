FROM node:24

RUN apt-get update && apt-get install -yq git build-essential

# create libs directory
RUN mkdir /libs
WORKDIR /libs

# copy sources
COPY . /libs

# set permissions
RUN chmod +x ./npm-ci-publish-beta-only.sh
RUN chmod +x ./npm-ci-publish.sh

# install dependencies without running their lifecycle scripts: this image is
# also the one the publish jobs run in. No dependency needs an install script
# for the build or the tests.
RUN yarn install --frozen-lockfile --ignore-scripts

# set to production
RUN export NODE_ENV=production

# build
RUN yarn build

CMD ["yarn", "test"]


