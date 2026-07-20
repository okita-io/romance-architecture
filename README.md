# romance-architecture

The **map and contracts** for the Romance Project — how the independently-deployed systems fit together. This repo holds **no runtime code**: it is the single home for the cross-cutting architecture and the boundary contracts that no single system repo owns.

Start here: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## The systems

| Repo | Role | Notes |
|------|------|-------|
| **romance-training** (RT) | Trains the models — judge, editor, writer | Gemma 4 MoE on DGX Spark; ships artifacts + contracts |
| **romance-factory** (RF) | Harness — runs models, drafts→grades→revises→merges books | Produces story bundles |
| **midnight-satin** (MS) | Frontend — readers read, unlock, review, comment | Next.js / Vercel / Neon; captures reader signal |
| **romance-editor** | Earlier Qwen3-8B editor; **overlaps RT** | Consolidation decision pending (see ARCHITECTURE.md) |

```
RT ──(models + card schema + rubric)──▶ RF ──(story bundle + assets)──▶ MS ──▶ readers
 ▲                                                                              │
 └───── feedback: RF machine signal (grades) + MS human signal (reads) ─────────┘
```

## Why this repo exists (and not submodules)

The systems are coupled by **contracts**, not shared code, and each deploys independently (MS is on Vercel). A monorepo would break independent CI/deploy; git submodules add daily friction for little gain. So this is a **thin meta-repo**: cross-cutting docs + contracts + a manifest of the other repos. Pin exact commits in [`manifest.yaml`](manifest.yaml) if you need a reproducible known-good tuple; promote to submodules only if atomic historical checkout ever becomes necessary. See ARCHITECTURE.md → *Open decisions*.

## Layout

```
docs/
  ARCHITECTURE.md   # the map: systems, forward flow, feedback loops, principles
  PROVENANCE.md     # per-story provenance contract (RT→RF→MS) — the loop's prerequisite
manifest.yaml       # repo URLs + current known-good commit of each system
scripts/
  clone-all.sh      # clone/pull all sibling repos into the expected layout
```

## Clone the whole project

```bash
# from the directory that should contain all repos as siblings
bash romance-architecture/scripts/clone-all.sh
```

## The one thing to fix first

The backward feedback loop is blocked by a **severed provenance chain**: reader outcomes cannot currently be joined to the model/adapter/card that produced them. That is a data-contract fix, specified in [docs/PROVENANCE.md](docs/PROVENANCE.md), and is the prerequisite for learning anything from readers.
