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
  "romance-monitor	git@github.com:okita-io/romance-monitor.git"
  "midnight-satin	git@github.com:okita-io/midnight-satin.git"
  "romance-voice	git@github.com:okita-io/romance-voice.git"
  # romance-editor: retired (superseded; editor lives in romance-training)
)

for entry in "${REPOS[@]}"; do
  name="${entry%%	*}"
  remote="${entry##*	}"

  if [ -d "$name/.git" ]; then
    echo "==> $name: updating"
    git -C "$name" pull --ff-only || echo "    (skip: pull failed for $name)"
  elif [ -d "midnightsatin/.git" ] && [ "$name" = "midnight-satin" ]; then
    echo "==> midnight-satin: found legacy dir midnightsatin — updating in place"
    git -C midnightsatin pull --ff-only || echo "    (skip: pull failed for midnightsatin)"
  elif [ "$remote" = "-" ]; then
    echo "==> $name: no known remote (set it in manifest.yaml) — skipping"
  else
    echo "==> $name: cloning from $remote"
    git clone "$remote" "$name"
  fi
done

echo "Done. See romance-architecture/docs/ARCHITECTURE.md for how these fit together."
