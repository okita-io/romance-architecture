# Backlog — cross-system convergence

Tasks that originate here (the coordination hub) because they **span repos** or fall out of the [contracts](contracts/). Each is executed in its **owning repo**; this board is the source of truth for what's blocking the MS/RF/RT convergence and in what order.

Legend: **owner** = repo that does the work · **unblocks** = what it enables · **src** = contract it comes from.
Convention: new-generations-only (see [ARCHITECTURE.md → Standing conventions](ARCHITECTURE.md#standing-conventions)).

---

## P0 — Unblock the feedback loop

Cheap, additive work that gates everything downstream. The RF→MS handoff is in place; **RT version stamps** are the remaining identity gap before the first calibration report.

| id | owner | status | task | unblocks | src |
|----|-------|--------|------|----------|-----|
| **RF-1** | RF | **Done** | Mint a stable **`story_id`** (UUID) at story creation; write it into genesis + `manuscript_metadata.json` + `publish_manifest.json` | the anchor for every cross-system join | IDENTIFIERS §2 |
| **RF-2** | RF | **Done** | Record **per-act provenance** + **act→chapter stitch char offsets**; emit `provenance/` in the bundle keyed by `story_id` | localizing per-chapter reader signal to an act/card | IDENTIFIERS §3, PROVENANCE |
| **MS-1** | MS | **Done** | Store `novels.rf_story_id` + nullable `chapters.rf_provenance` (acts[] JSONB); importer populates from the bundle | the join lives somewhere queryable | PROVENANCE §MS |
| **RT-1** | RT | **Open** | Assign **stable version ids** to shipped artifacts (`base_version`, `adapter_version`, `editor_version`, `judge_version`) | attributing outcomes to a model version (RF currently emits these as `null`) | PROVENANCE §RT |

**When RT-1 lands:** run the first **calibration report** — does `editor_card_hit` / `judge_score` correlate with reader completion/unlocks? (measurement only, no training yet). — *owner: RT*

---

## P1 — Contract follow-through

| id | owner | status | task | src |
|----|-------|--------|------|-----|
| **ARCH-1** | arch / RF | **Done** | `card_id` hash determinism: sorted JSON `{rubric_version, targets}` → SHA-256 → `card_<16hex>` (STEERING_CARD §3; RF `card_id_from_targets`) | STEERING_CARD §3 |
| **RT-2** | RT | Open | Version the **persona→dims** conversion (`style_profile_from_author`): record model/prompt so "same" author profiles don't drift | STEERING_CARD §7 |
| **RT-3** | RT | Open | Store span **char offsets** + a segmentation version so span ids stay joinable across re-chunking | IDENTIFIERS §6 |
| **RF-3** | RF | Open | Confirm `act_number` is **global** across the story; ensure **bridge acts** get their own `act_number` (addressable card/provenance) | IDENTIFIERS §6 |
| **RT-4** | RT | Open | Decide whether the writer targets `mind_style` / `cohesion` / `lexical_complexity`, or they stay grade-only | STEERING_CARD §7 |

---

## P2 — Close the loop (once MS has readers)

The feedback loop that step 18-20 of the [README lifecycle](../README.md#end-to-end-lifecycle-step-by-step) diagram depicts. These are **gated on MS having live human readers** and on RT-1 landing so outcomes join to a model *version*. Until then the signal tables exist but there is nothing to export.

| id | owner | status | task | unblocks | src |
|----|-------|--------|------|----------|-----|
| **MS-2** | MS | Open | **Scheduled reader-signal export** for RT: periodic dump of reader outcomes (`reading_progress`, `chapter_unlocks`, `novel_reviews`, `paperback_orders`) joined to `rf_story_id` + `chapters.rf_provenance` (`acts[]`), **carrying the confound columns** (`is_featured`, `featured_order`, `is_free`, promotion) for de-confounding, **aggregated/pseudonymized with no reader PII** and respecting consent + age-gating | the MS→RT calibration dataset (the only non-circular signal) | PROVENANCE §join, ARCHITECTURE (two-signal rule, failure-modes 3 & 5) |
| **RT-5** | RT | Open | Consume the MS-2 export: build the recurring **calibration report** (do `editor_card_hit` / `judge_score` predict reader completion/unlocks?) and surface **localized hard negatives** (high drop-off despite high editor score) | proxy calibration; later curated preference data (DEC-1) | PROVENANCE §join, ARCHITECTURE (two-signal rule) |

**Cadence:** treat the export as a **slow calibration channel**, not a live gradient (ARCHITECTURE failure-mode 4) — a regular batch (e.g. weekly/monthly) is the intent, not per-event streaming. First measure correlation; only then, and only gated, does curated preference data flow into writer/editor training.

---

## Decisions

| id | decision | status | resolution | src |
|----|----------|--------|------------|-----|
| **DEC-1** | **Human-signal role** — calibration + curated preference data, or a tighter direct-optimization loop? | **Resolved** | Calibration-first until provenance fields are fully stamped (RT-1) and confounds are controlled; then curated preference data only | ARCHITECTURE (two-signal rule) |
| **DEC-2** | MS provenance storage — columnized fields vs a single `acts[]` JSONB blob | **Resolved** | `novels.rf_story_id` + `chapters.rf_provenance` JSONB (`acts[]` + stitch offsets). No separate `chapter_provenance` table | PROVENANCE §MS |

---

## Notes

- **Sequencing (updated):** RF-1 → RF-2 → MS-1 are shipped. Next: **RT-1**, then the first calibration report. P1 can proceed independently. **P2** (MS-2 export → RT-5 calibration) waits on live MS readers + RT-1.
- Related MS consumer work (not owned here): transactional / idempotent re-import by `rf_story_id` — see MS `docs/ROMANCE_FACTORY_GAPS.md`.
- This board is **task origination**, not a project tracker — once an item is picked up, it lives in its owning repo's issues/PRs. Check items off here when the owning repo ships them.
