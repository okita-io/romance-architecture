# Backlog — cross-system convergence

Tasks that originate here (the coordination hub) because they **span repos** or fall out of the [contracts](contracts/). Each is executed in its **owning repo**; this board is the source of truth for what's blocking MS/RF/RT/RV/RM convergence and in what order.

Legend: **owner** = repo that does the work · **unblocks** = what it enables · **src** = contract it comes from.
Convention: new-generations-only (see [ARCHITECTURE.md → Standing conventions](ARCHITECTURE.md#standing-conventions)).

---

## P0 — Unblock the feedback loop

Cheap, additive work that gates everything downstream. **RF emits** `story_id` + `provenance/`; **MS must store** the join, and **RT must stamp** model versions, before the first calibration report.

| id | owner | status | task | unblocks | src |
|----|-------|--------|------|----------|-----|
| **RF-1** | RF | **Done** | Mint a stable **`story_id`** (UUID) at story creation; write it into genesis + `manuscript_metadata.json` + `publish_manifest.json` | the anchor for every cross-system join | IDENTIFIERS §2 |
| **RF-2** | RF | **Done** | Record **per-act provenance** + **act→chapter stitch char offsets**; emit `provenance/` in the bundle keyed by `story_id` | localizing per-chapter reader signal to an act/card | IDENTIFIERS §3, PROVENANCE |
| **MS-1** | MS | **Open** | Store `novels.rf_story_id` + nullable `chapters.rf_provenance` (acts[] JSONB); importer populates from the bundle (DEC-2 schema) | the join lives somewhere queryable | PROVENANCE §MS |
| **RT-1** | RT | **Open** | Assign **stable version ids** to shipped artifacts (`base_version`, `adapter_version`, `editor_version`, `judge_version`) | attributing outcomes to a model version (RF currently emits these as `null`) | PROVENANCE §RT |

**When MS-1 + RT-1 land:** run the first **calibration report** — does `editor_card_hit` / `judge_score` correlate with reader completion/unlocks? (measurement only, no training yet). — *owner: RT*

---

## P1 — Contract follow-through

| id | owner | status | task | src |
|----|-------|--------|------|-----|
| **ARCH-1** | arch / RF | **Done** | `card_id` hash determinism: sorted JSON `{rubric_version, targets}` → SHA-256 → `card_<16hex>` (STEERING_CARD §3; RF `card_id_from_targets`) | STEERING_CARD §3 |
| **RT-2** | RT | Open | Version the **persona→dims** conversion (`style_profile_from_author`): record model/prompt so "same" author profiles don't drift | STEERING_CARD §7 |
| **RT-3** | RT | Open | Store span **char offsets** + a segmentation version so span ids stay joinable across re-chunking | IDENTIFIERS §6 |
| **RF-3** | RF | Open | Confirm `act_number` is **global** across the story; ensure **bridge acts** get their own `act_number` (addressable card/provenance) | IDENTIFIERS §6 |
| **RT-4** | RT | Open | Decide whether the writer targets `mind_style` / `cohesion` / `lexical_complexity`, or they stay grade-only | STEERING_CARD §7 |
| **RV-1** | RV | **Done** | First live VoxCPM synth on Spark (`scripts/smoke_tts.sh`); confirm load/unload + tunnel `:18081` | ARCHITECTURE (RF ↔ RV) |
| **RV-2** | RV | Open | **Alignment bridge:** after synth, run stable-ts (`voxcpm[timestamps]`) → roll word starts to paragraphs → write `cues[]` into `audio_manifest.json`; fail closed without cues; unload VoxCPM before/around align as VRAM requires | AUDIOBOOK §4b |
| **RF-4** | RF | Open | HTTP client for romance-voice: upload story zip / manuscript → poll job → land `audio/` + cued `audio_manifest.json` on the story tree | ARCHITECTURE (RF ↔ RV); RV `AGENTS.md` |
| **RF-5** | RF | Open | Include `audio/` (MP3s + cued manifest) in phase 15b / `romance-bundle.zip` (required for a complete bundle) | AUDIOBOOK §3–4 |
| **MS-3** | MS | Open | **Parallel track:** ingest MP3s → **Vercel Blob**; paragraph cues → **Neon JSONB**; store asset URLs; extend ingest docs / GAPS (fail closed without cues) | AUDIOBOOK §5, DEC-5 |
| **MS-4** | MS | Open | **Parallel track:** 1-credit `audiobook_unlock`; player streams blob MP3s, consumes Neon cues; Veil-capped chapters; paragraph jump-sync; background playback (Media Session) | AUDIOBOOK §1, §5 |
| **RM-1** | RM / RF | **Done** | RF `generate.live_monitor` publisher + RM ingest/WS SPA (fail-open; LAN `:7788`) | ARCHITECTURE (RF → RM) |

---

## P2 — Close the loop (once MS has readers)

The feedback loop that step 19-21 of the [README lifecycle](../README.md#end-to-end-lifecycle-step-by-step) diagram depicts. These are **gated on MS having live human readers** and on MS-1 + RT-1 landing so outcomes join to story structure and a model *version*. Until then the signal tables exist but there is nothing to export with provenance.

| id | owner | status | task | unblocks | src |
|----|-------|--------|------|----------|-----|
| **MS-2** | MS | Open | **Scheduled reader-signal export** for RT: periodic dump of reader outcomes (`reading_progress`, `chapter_unlocks`, `novel_reviews`, `paperback_orders`) joined to `rf_story_id` + `chapters.rf_provenance` (`acts[]`), **carrying the confound columns** (`is_featured`, `featured_order`, `is_free`, promotion) for de-confounding, **aggregated/pseudonymized with no reader PII** and respecting consent + age-gating | the MS→RT calibration dataset (the only non-circular signal) | PROVENANCE §join, ARCHITECTURE (two-signal rule, failure-modes 3 & 5) |
| **RT-5** | RT | Open | Consume the MS-2 export: build the recurring **calibration report** (do `editor_card_hit` / `judge_score` predict reader completion/unlocks?) and surface **localized hard negatives** (high drop-off despite high editor score) | proxy calibration; later curated preference data (DEC-1) | PROVENANCE §join, ARCHITECTURE (two-signal rule) |

**Cadence:** treat the export as a **slow calibration channel**, not a live gradient (ARCHITECTURE failure-mode 4) — a regular batch (e.g. weekly/monthly) is the intent, not per-event streaming. First measure correlation; only then, and only gated, does curated preference data flow into writer/editor training.

---

## Decisions

| id | decision | status | resolution | src |
|----|----------|--------|------------|-----|
| **DEC-1** | **Human-signal role** — calibration + curated preference data, or a tighter direct-optimization loop? | **Resolved** | Calibration-first until provenance fields are fully stamped (MS-1 + RT-1) and confounds are controlled; then curated preference data only | ARCHITECTURE (two-signal rule) |
| **DEC-2** | MS provenance storage — columnized fields vs a single `acts[]` JSONB blob | **Resolved** | `novels.rf_story_id` + `chapters.rf_provenance` JSONB (`acts[]` + stitch offsets). No separate `chapter_provenance` table. *(Implement under MS-1.)* | PROVENANCE §MS |
| **DEC-3** | Where does Spark TTS live — inside RF, or a separate service repo? | **Resolved** | **romance-voice**: own repo + GPU tenant; RF keeps batch CLI / VoxCPM engine; RV owns HTTP serve. MS ingest of audio is contracted under DEC-4 | ARCHITECTURE (romance-voice) |
| **DEC-4** | Audiobook in MS — bundle? unlock? Veil? sync? | **Resolved** | Required `audio/` in publish bundle; **1 credit** novel-level unlock; play only Veil-unlocked chapters; **paragraph jump-sync** (not continuous scroll); **background** playback | AUDIOBOOK; ARCHITECTURE |
| **DEC-5** | Audiobook assets — blob vs Neon? | **Resolved** | **MP3s → Vercel Blob** (stream/CDN). **Paragraph cues → Neon JSONB** (small; hydrate + authz with reading room). Bundle `audio_manifest.json` is import source of truth only | AUDIOBOOK §5 |
| **DEC-6** | Where does live generate observability live? | **Resolved** | **romance-monitor**: own Node repo + LAN `:7788`; RF `live_monitor` publisher fail-open; not on publish/training path | ARCHITECTURE (romance-monitor) |

---

## Notes

- **Sequencing (updated Jul 31 2026):** RF-1 → RF-2 are shipped. Next P0: **MS-1** (store join) and **RT-1** (version ids), then the first calibration report. P1 audiobook is **two parallel tracks:** Track A `RV-1 (done) → RV-2 → RF-4 → RF-5`; Track B `MS-3 → MS-4` (may stub fixtures until Track A lands). RM-1 is shipped (operator tool). **P2** (MS-2 export → RT-5 calibration) waits on live MS readers + MS-1 + RT-1.
- Related MS consumer work (not owned here): transactional / idempotent re-import by `rf_story_id` — see RF `docs/design/midnightsatin-gaps.md` / MS ingest docs when present.
- RF pipeline is **15 phases** with story-frame world cards default-on; see [ARCHITECTURE.md](ARCHITECTURE.md).
- This board is **task origination**, not a project tracker — once an item is picked up, it lives in its owning repo's issues/PRs. Check items off here when the owning repo ships them.
