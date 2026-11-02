#!/bin/bash
set -e

echo "//registry.npmjs.org/:_authToken=$NPM_AUTH_TOKEN" > .npmrc


# Beta-only publish: publish ONLY packages whose own version is a prerelease,
# always to the "next" dist-tag. Stable packages are left untouched (they go
# out via npm-ci-publish.sh). Errors if there is no beta to publish.
#
# Versions already on the registry are skipped. prepublishOnly (build) runs via
# `npm publish`.

published=0
for dir in packages/*/; do
  pkg="${dir}package.json"
  [ -f "$pkg" ] || continue

  name=$(node -p "require('./$pkg').name")
  version=$(node -p "require('./$pkg').version")
  private=$(node -p "require('./$pkg').private === true")

  [ "$private" = "true" ] && continue

  case "$version" in
    *-*) : ;;                                  # prerelease — publish below
    *)   echo "skip $name@$version (stable, not beta-only)"; continue ;;
  esac

  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "skip $name@$version (already published)"
    continue
  fi

  echo "publish $name@$version --tag next"
  ( cd "$dir" && npm publish --tag next )
  published=$((published + 1))
done

if [ "$published" = "0" ]; then
  echo "cannot publish: no unpublished beta version found (beta-only script)"
  rm .npmrc
  exit 1
fi

echo "published $published beta package(s)"

rm .npmrc
