# Per-Story Provenance Contract

**Status:** Adopted (Jul 2026) — RF+MS handoff shipped; RT version stamps still open
**Spans:** romance-training (RT) → romance-factory (RF) → midnight-satin (MS)
**Scope:** New generations only — forward-only, no backfill of legacy RF `stories/` or already-imported MS novels (see [ARCHITECTURE.md → Standing conventions](ARCHITECTURE.md#standing-conventions)).
**Purpose:** Make every reader outcome **joinable** to the generation choices that produced it, so the backward feedback loop ([ARCHITECTURE.md](ARCHITECTURE.md)) is possible at all.

---

## Problem

Reader signal is worthless for training if it cannot be attributed. Before this contract:

- RF emitted story bundles with **no model provenance**.
- MS stored chapters as plain `content TEXT` with **no style metadata**.

So "readers dropped off at chapter 7" could not become "the `dark-fantasy` adapter under card X, model v3, tends to lose readers." This contract defines the **minimum metadata** needed to join reader outcomes back to generation parameters — nothing more.

**Design rule:** provenance is *reference data*, not content. MS does not need to render it; it needs to be able to **join on it**. Keep it minimal, stable, and privacy-clean (no PII — it describes *models and choices*, not readers).

### Implementation status

| Piece | Status |
|-------|--------|
| RF `story_id` (UUID) in genesis / metadata / manifest | **Shipped** (RF-1) |
| RF `provenance/story.json` + `provenance/chapter_NN.json` with act stitch offsets | **Shipped** (RF-2); version/grade fields often `null` until RT-1 + grade wiring |
| MS `novels.rf_story_id` + `chapters.rf_provenance` JSONB | **Shipped** (MS-1; migration `012_add_rf_provenance.sql`) |
| RT stable `*_version` ids on shipped artifacts | **Open** (RT-1) — the remaining identity gap |
| MS export / RT calibration report | **Open** (post-P0) — MS-2 (scheduled export) → RT-5 (calibration report); see [BACKLOG.md](BACKLOG.md#p2--close-the-loop-once-ms-has-readers) |

---

## The provenance record

Every generated unit (chapter, and ideally each span within it) carries:

```json
{
  "provenance_version": "1.0",
  "model": {
    "base": "gemma-4-26b-a4b",
    "base_version": "rt-2026.07.03",
    "writer_adapter": "dark-fantasy",
    "adapter_version": "v3",
    "editor_version": "rt-editor-2026.06.20",
    "judge_version": "rt-judge-2026.05.11"
  },
  "card": {
    "card_id": "card_7f3a...",
    "pov": "first",
    "register": "colloquial",
    "sentence_complexity": "simple_paratactic",
    "tone": "...",
    "figurative_density": "..."
  },
  "grades": {
    "editor_card_hit": 0.86,
    "judge_score": 0.79,
    "revisions": 2
  },
  "rubric_version": "leech_short_2026.04"
}
```

- **`model.*`** — what wrote it. The join key for "which adapter/version produces what reader response."
- **`card.*`** — what it was *told* to write. Lets RT compare intended vs achieved vs reader-preferred style. `card_id` references the full card; the inline fields are the queryable knobs.
- **`grades.*`** — the machine signal at generation time, so RT can later ask "did editor score predict reader behavior?" (the two-signal calibration).
- **`rubric_version`** — pins the enum vocabulary so labels stay comparable across time.

On the wire (bundle + MS JSONB), this is flattened into **per-act** objects inside `acts[]` (see below), not a nested `model`/`card`/`grades` tree — the logical fields are the same.

---

## Responsibilities per system

### RT (romance-training) — *define and stamp identity*

- Version every shipped artifact with a stable id (`base_version`, `adapter_version`, `editor_version`, `judge_version`).
- Own the `card` schema and `rubric_version` vocabulary.
- Consume the joined dataset (below) for calibration and, later, curated preference training.

### RF (romance-factory) — *record and carry*

- Mint a stable `story_id` (UUID) at story creation; write it into genesis, `manuscript_metadata.json`, and `publish_manifest.json`.
- At generation, record provenance at the **act** grain — the card grain and the unit RF actually drafts (see [contracts/IDENTIFIERS.md](contracts/IDENTIFIERS.md)). A chapter's provenance is its **ordered `acts[]`**, each with the card used, adapter, model versions, editor/judge grades, and its **char range within the stitched chapter** (`char_start`/`char_end`) so per-chapter reader signal can localize to the act.
- Emit it in the story bundle, keyed by `story_id`:

```text
<story>/
├── ...
├── publish_manifest.json
└── provenance/
    ├── story.json            # story_id, dominant model/adapter, rubric_version
    └── chapter_NN.json       # { chapter_number, coordinate_space, acts: [
    │                          #   {act_number, card_id, writer_adapter,
    │                          #    base_version, editor_card_hit, judge_score,
    │                          #    char_start, char_end}, ... ] }
```

Coordinate space for stitch offsets is `stitched_acts_stripped` (raw `\n\n`-joined stripped act bodies). This is additive — it does not change existing ingest fields (MS `ROMANCE_FACTORY_INGEST.md`).

### MS (midnight-satin) — *store a join key*

MS need not render provenance, but must let RT join reader signal to it. **Adopted schema** (DEC-2 resolved — columns + `acts[]` JSONB on the chapter row; no separate provenance table):

```sql
-- novels: RF story anchor (unique when present)
ALTER TABLE novels ADD COLUMN rf_story_id UUID;
CREATE UNIQUE INDEX novels_rf_story_id_uidx
  ON novels (rf_story_id) WHERE rf_story_id IS NOT NULL;

-- chapters: act-grain provenance from provenance/chapter_NN.json
-- Shape: { provenance_version, chapter_number, coordinate_space,
--          rubric_version, acts: [ { act_number, char_start, char_end,
--          card_id, writer_adapter, *_version, grades, ... }, ... ] }
ALTER TABLE chapters ADD COLUMN rf_provenance JSONB;
```

Resolution for `rf_story_id` (first match wins): `provenance/story.json` → `publish_manifest.story_id` → `manuscript_metadata.story_id`.

Populated by the RF importer (`scripts/import-romance-factory-story.mjs` via `scripts/lib/rf-provenance.mjs`). Existing rows without provenance stay `NULL` — nothing breaks. See MS migration `012_add_rf_provenance.sql` and `docs/ROMANCE_FACTORY_INGEST.md`.

---

## The join that unlocks the loop

With the above, RT can assemble a training/calibration dataset:

```
reading_progress / chapter_unlocks / novel_reviews   (reader outcome, per chapter)
        ⋈ chapters.rf_provenance                     (acts[] + stitch offsets)
        ⋈ novels.rf_story_id                         (RF story anchor)
        →  { adapter, adapter_version, card knobs, editor_card_hit, judge_score, reader_outcome }
```

Scroll localization: `reading_progress.scroll_percent × chapter length` → char offset → which `acts[]` range owns that prose.

This is exactly what powers:

- **Proxy calibration** — does `editor_card_hit` / `judge_score` correlate with reader completion and unlocks? Where they diverge, revise the rubric/editor.
- **Adapter/card performance** — which adapters and which card settings readers actually finish and pay for.
- **Localized hard negatives** — chapters/spans with high drop-off despite high editor scores → the most valuable training examples.

**Always** carry the confound columns (`is_featured`, `featured_order`, `is_free`, promotion) into this join so reader outcomes can be de-confounded before use — see ARCHITECTURE.md failure-mode 3.

---

## De-confounding & consent (non-negotiable)

- **Attribution:** never attribute reader outcome to prose without controlling for placement/promotion/paywall. Prefer within-book, within-position comparisons (e.g., drop-off *inside* a chapter) and A/B of the same story under different cards/adapters.
- **Consent & PII:** the provenance record describes **models and choices, not readers** — keep it that way. Reader-side signal used for training must respect MS's consent and age-gating; aggregate/pseudonymize at export. No reader identifiers cross into RT.

---

## Rollout (smallest first)

1. ~~**RF:** mint `story_id` + write `provenance/` into the bundle.~~ **Done** (RF-1, RF-2).
2. ~~**MS:** store `rf_story_id` + `rf_provenance`; importer population.~~ **Done** (MS-1).
3. **RT:** assign stable version ids to shipped artifacts (RT-1) so RF can stop emitting `null` for `*_version` fields.
4. **RT:** build the join + a first calibration report (editor score vs reader completion). No model training yet — just measure whether the proxy holds.

Only after step 4 shows a usable correlation does curated preference data flow into writer training.
