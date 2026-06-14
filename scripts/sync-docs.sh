#!/usr/bin/env bash
#
# sync-docs.sh — re-sync the public docs from the private pharlux source repo.
#
# The site's docs/ is a CURATED MIRROR of pharlux/docs/, not a live feed. It
# drifts whenever the source advances, so it must be re-synced every time a
# release is cut. This script applies the one systematic adaptation the site
# makes (rewriting repo-tree relative links to absolute GitHub blob URLs pinned
# to the release tag) and enforces the publish decisions below.
#
# PUBLISH DECISIONS (locked 2026-06-14):
#   * docs/user/*        -> published (flattened to docs/*.md)
#   * docs/user/host-limits.md, sizing-guide.md, etc. -> all user docs publish
#   * docs/dev/architecture.md -> published (operator-relevant data-flow/ports)
#   * docs/dev/crate-map.md, testing.md -> NOT published (contributor-only)
#   * docs/enterprise/*  -> NOT published (private/commercial internals)
#
# Usage:   scripts/sync-docs.sh <path-to-pharlux-source-repo> <release-tag>
# Example: scripts/sync-docs.sh ../pharlux v1.1.0
#
# After running: review the "NEW user docs" warning (add any to sidebars.ts and
# docs/index.mdx by hand), then `npm run build` to verify links, then commit.

set -euo pipefail

SRC="${1:?usage: sync-docs.sh <pharlux-source-repo> <release-tag>}"
TAG="${2:?usage: sync-docs.sh <pharlux-source-repo> <release-tag>}"
SITE_DOCS="$(cd "$(dirname "$0")/.." && pwd)/docs"
USER_SRC="$SRC/docs/user"
DEV_SRC="$SRC/docs/dev"

[ -d "$USER_SRC" ] || { echo "ERROR: $USER_SRC not found — is '$SRC' the pharlux source repo?" >&2; exit 1; }

# The one site adaptation: repo-tree relative links -> GitHub blob at the tag.
# Sibling user-doc links ( ](foo.md) ) are left bare — Docusaurus resolves them.
transform() {
  sed -E \
    -e "s#\]\(\.\./\.\./#](https://github.com/Veltara-Works/pharlux/blob/$TAG/#g" \
    -e "s#\]\(\.\./dev/#](https://github.com/Veltara-Works/pharlux/blob/$TAG/docs/dev/#g"
}

echo "Syncing docs from $SRC at tag $TAG ..."

# 1) All user docs -> flattened into docs/
for f in "$USER_SRC"/*.md; do
  base="$(basename "$f")"
  [ "$base" = "README.md" ] && continue   # site landing is the bespoke docs/index.mdx
  transform < "$f" > "$SITE_DOCS/$base"
done

# 2) Dev docs: architecture only (operator-facing trim).
transform < "$DEV_SRC/architecture.md" > "$SITE_DOCS/dev/architecture.md"

# 3) Flag NEW source user docs that aren't yet wired into nav/index by hand.
echo
echo "Checking for source user docs not yet referenced in sidebars.ts / index.mdx ..."
SIDEBARS="$(cd "$(dirname "$0")/.." && pwd)/sidebars.ts"
for f in "$USER_SRC"/*.md; do
  base="$(basename "$f" .md)"
  [ "$base" = "README" ] && continue
  if ! grep -q "'$base'" "$SIDEBARS"; then
    echo "  ⚠ NEW: docs/$base.md is not in sidebars.ts — add it to the sidebar AND docs/index.mdx by hand."
  fi
done

echo
echo "Done. Next: review warnings above, run 'npm run build', then commit."
