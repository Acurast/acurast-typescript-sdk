# Shared helpers for npm-ci-publish.sh and npm-ci-publish-beta-only.sh.
# Source this file; do not execute it.
#
# - The npm token is written to a private temp userconfig outside the checkout,
#   removed on every exit path (trap), and dropped from the environment so that
#   child processes do not inherit it.
# - Packages are published with --ignore-scripts, so no lifecycle script
#   (prepublishOnly, prepack, ...) runs while the token is available. Packages
#   must therefore be built before the publish script runs (the Docker image and
#   the GitHub publish workflow both run `yarn build` first).
# - If NPM_AUTH_TOKEN is not set, npm's existing auth is used unchanged, e.g.
#   npm trusted publishing (OIDC) in GitHub Actions.

npm_publish_setup_auth() {
  if [ -z "${NPM_AUTH_TOKEN:-}" ]; then
    echo "NPM_AUTH_TOKEN not set; using existing npm auth (e.g. trusted publishing)"
    return 0
  fi

  NPM_PUBLISH_USERCONFIG=$(umask 077 && mktemp "${TMPDIR:-/tmp}/npmrc.XXXXXX")
  trap 'rm -f "$NPM_PUBLISH_USERCONFIG"' EXIT
  (umask 077 && printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_AUTH_TOKEN" >"$NPM_PUBLISH_USERCONFIG")
  export NPM_CONFIG_USERCONFIG="$NPM_PUBLISH_USERCONFIG"
  unset NPM_AUTH_TOKEN
}

# npm_publish_package <package dir> <dist-tag>
npm_publish_package() {
  local dir=$1 tag=$2

  if [ ! -d "${dir}dist" ]; then
    echo "cannot publish ${dir}: no dist/ folder, run 'yarn build' first" >&2
    return 1
  fi

  (cd "$dir" && npm publish --ignore-scripts --tag "$tag")
}
