#!/bin/bash
set -e

echo "//registry.npmjs.org/:_authToken=$NPM_AUTH_TOKEN" > .npmrc

git update-index --assume-unchanged npm-ci-publish.sh
git update-index --assume-unchanged npm-ci-publish-beta-only.sh

HAS_BETA=$(node -e "
const fs = require('fs');
const path = require('path');
const pkgs = fs.readdirSync('packages').filter(d => fs.existsSync(path.join('packages', d, 'package.json')));
const beta = pkgs.some(d => {
  const v = JSON.parse(fs.readFileSync(path.join('packages', d, 'package.json'))).version;
  return v.includes('beta');
});
console.log(beta ? '1' : '0');
")

if [ "$HAS_BETA" = "1" ]
then
  echo "beta version detected, using --dist-tag next"
  npx lerna publish from-package --contents ./ --dist-tag next --yes
else
  echo "cannot publish non-beta version with beta-only script"
  rm .npmrc
  exit 1
fi

rm .npmrc
