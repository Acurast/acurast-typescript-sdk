#!/bin/bash
set -e

# shellcheck source=npm-ci-publish-lib.sh
. "$(dirname "$0")/npm-ci-publish-lib.sh"
npm_publish_setup_auth

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
# from-package`. Lifecycle scripts do not run on publish
# (--ignore-scripts), so packages must be built first; see npm-ci-publish-lib.sh.

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
  npm_publish_package "$dir" "$tag"
  published=$((published + 1))
done

echo "published $published package(s)"
