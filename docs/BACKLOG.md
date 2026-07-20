# Backlog — cross-system convergence

Tasks that originate here (the coordination hub) because they **span repos** or fall out of the [contracts](contracts/). Each is executed in its **owning repo**; this board is the source of truth for what's blocking the MS/RF/RT convergence and in what order.

Legend: **owner** = repo that does the work · **unblocks** = what it enables · **src** = contract it comes from.
Convention: new-generations-only (see [ARCHITECTURE.md → Standing conventions](ARCHITECTURE.md#standing-conventions)).

---

## P0 — Unblock the feedback loop (the "do-first" trio + storage)

These are cheap, additive, and gate everything downstream. Nothing about reader-signal learning works until the provenance chain is joinable.

| id | owner | task | unblocks | src |
|----|-------|------|----------|-----|
| **RF-1** | RF | Mint a stable **`story_id`** (UUID) at story creation; write it into `manuscript_metadata.json` + `publish_manifest.json` | the anchor for every cross-system join | IDENTIFIERS §2 |
| **RT-1** | RT | Assign **stable version ids** to shipped artifacts (`base_version`, `adapter_version`, `editor_version`, `judge_version`) | attributing outcomes to a model version | PROVENANCE §RT |
| **RF-2** | RF | Record **per-act provenance** + **act→chapter stitch char offsets**; emit `provenance/` in the bundle keyed by `story_id` | localizing per-chapter reader signal to an act/card | IDENTIFIERS §3, PROVENANCE |
| **MS-1** | MS | Store `novels.rf_story_id` + nullable `chapter_provenance` (acts[] JSONB); importer populates from the bundle | the join lives somewhere queryable | PROVENANCE §MS |

**When P0 lands:** run the first **calibration report** — does `editor_card_hit` / `judge_score` correlate with reader completion/unlocks? (measurement only, no training yet). — *owner: RT*

---

## P1 — Contract follow-through

| id | owner | task | src |
|----|-------|------|-----|
| **ARCH-1** | arch | Define `card_id` hash determinism (sorted resolved `targets` + `rubric_version`) so RF and re-derivation agree | STEERING_CARD §7 |
| **RT-2** | RT | Version the **persona→dims** conversion (`style_profile_from_author`): record model/prompt so "same" author profiles don't drift | STEERING_CARD §7 |
| **RT-3** | RT | Store span **char offsets** + a segmentation version so span ids stay joinable across re-chunking | IDENTIFIERS §6 |
| **RF-3** | RF | Confirm `act_number` is **global** across the story; ensure **bridge acts** get their own `act_number` (addressable card/provenance) | IDENTIFIERS §6 |
| **RT-4** | RT | Decide whether the writer targets `mind_style` / `cohesion` / `lexical_complexity`, or they stay grade-only | STEERING_CARD §7 |

---

## Decisions needed (owner: you)

| id | decision | default / recommendation | src |
|----|----------|--------------------------|-----|
| **DEC-1** | **Human-signal role** — calibration + curated preference data, or a tighter direct-optimization loop? | *Recommended:* calibration-first until provenance lands + confounds controlled | ARCHITECTURE (two-signal rule) |
| **DEC-2** | MS provenance storage — columnized fields vs a single `acts[]` JSONB blob | *Recommended:* `story_id` + `chapter_number` columns + `acts` JSONB | PROVENANCE §MS |

---

## Notes

- **Sequencing:** RF-1 first (anchor), then RT-1 + RF-2 in parallel, then MS-1, then the calibration report. P1 can proceed independently.
- This board is **task origination**, not a project tracker — once an item is picked up, it lives in its owning repo's issues/PRs. Check items off here when the owning repo ships them.
