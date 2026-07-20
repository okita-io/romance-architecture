#!/usr/bin/env bash
# Clone or update all Romance Project system repos as siblings of this meta-repo.
# Dependency-free (no YAML parser). Keep in sync with ../manifest.yaml.
#
# Usage:
#   bash romance-architecture/scripts/clone-all.sh
# Run it from the parent directory that should contain all repos as siblings.

set -euo pipefail

# repo<TAB>remote  ("-" means no known remote yet; will be skipped with a note)
REPOS=(
  "romance-training	git@github.com:okita-io/romance-training.git"
  "romance-factory	git@github.com:okita-io/romance-factory.git"
  "midnight-satin	-"
  # romance-editor: retired (superseded; editor lives in romance-training)
)

for entry in "${REPOS[@]}"; do
  name="${entry%%	*}"
  remote="${entry##*	}"

  if [ -d "$name/.git" ]; then
    echo "==> $name: updating"
    git -C "$name" pull --ff-only || echo "    (skip: pull failed for $name)"
  elif [ "$remote" = "-" ]; then
    echo "==> $name: no known remote (set it in manifest.yaml) — skipping"
  else
    echo "==> $name: cloning from $remote"
    git clone "$remote" "$name"
  fi
done

echo "Done. See romance-architecture/docs/ARCHITECTURE.md for how these fit together."
