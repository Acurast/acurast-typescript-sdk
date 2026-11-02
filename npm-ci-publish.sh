#!/bin/bash
set -e

echo "//registry.npmjs.org/:_authToken=$NPM_AUTH_TOKEN" > .npmrc
# Publish each package with a dist-tag derived from ITS OWN version:
#   prerelease version (e.g. 1.4.0-beta.0) -> next
#   stable version      (e.g. 1.4.0)        -> latest
#
# Previously a single global --dist-tag was chosen from a repo-wide "any
# package has beta" scan, so one unrelated prerelease package (e.g. vps) forced
# every package — including stable ones — onto the "next" tag. Deciding the tag
# per package removes that coupling.
#
# Versions already on the registry are skipped, mirroring `lerna publish
# from-package`. prepublishOnly (build) still runs via `npm publish`.

published=0
for dir in packages/*/; do
  pkg="${dir}package.json"
  [ -f "$pkg" ] || continue

  name=$(node -p "require('./$pkg').name")
  version=$(node -p "require('./$pkg').version")
  private=$(node -p "require('./$pkg').private === true")

  if [ "$private" = "true" ]; then
    echo "skip $name (private)"
    continue
  fi

  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "skip $name@$version (already published)"
    continue
  fi

  case "$version" in
    *-*) tag=next ;;   # any prerelease identifier
    *)   tag=latest ;;
  esac

  echo "publish $name@$version --tag $tag"
  ( cd "$dir" && npm publish --tag "$tag" )
  published=$((published + 1))
done

echo "published $published package(s)"

rm .npmrc
