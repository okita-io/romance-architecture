# Per-Story Provenance Contract

**Status:** Proposed contract (Jul 2026) — not yet implemented in any system
**Spans:** romance-training (RT) → romance-factory (RF) → midnight-satin (MS)
**Scope:** New generations only — forward-only, no backfill of legacy RF `stories/` or already-imported MS novels (see [ARCHITECTURE.md → Standing conventions](ARCHITECTURE.md#standing-conventions)).
**Purpose:** Make every reader outcome **joinable** to the generation choices that produced it, so the backward feedback loop ([ARCHITECTURE.md](ARCHITECTURE.md)) is possible at all.

---

## Problem

Reader signal is worthless for training if it cannot be attributed. Today the chain is severed:

- RF emits story bundles with **no model provenance**.
- MS stores chapters as plain `content TEXT` with **no style metadata**.

So "readers dropped off at chapter 7" cannot become "the `dark-fantasy` adapter under card X, model v3, tends to lose readers." This contract fixes that with the **minimum metadata** needed to join reader outcomes back to generation parameters — nothing more.

**Design rule:** provenance is *reference data*, not content. MS does not need to render it; it needs to be able to **join on it**. Keep it minimal, stable, and privacy-clean (no PII — it describes *models and choices*, not readers).

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

---

## Responsibilities per system

### RT (romance-training) — *define and stamp identity*

- Version every shipped artifact with a stable id (`base_version`, `adapter_version`, `editor_version`, `judge_version`).
- Own the `card` schema and `rubric_version` vocabulary.
- Consume the joined dataset (below) for calibration and, later, curated preference training.

### RF (romance-factory) — *record and carry*

- At generation, record provenance at the **act** grain — the card grain and the unit RF actually drafts (see [contracts/IDENTIFIERS.md](contracts/IDENTIFIERS.md)). A chapter's provenance is its **ordered `acts[]`**, each with the card used, adapter, model versions, editor/judge grades, and its **char range within the stitched chapter** (`char_start`/`char_end`) so per-chapter reader signal can localize to the act.
- Emit it in the story bundle, keyed by `story_id`. **Proposed extension** to the bundle:

```text
<story>/
├── ...
├── publish_manifest.json
└── provenance/
    ├── story.json            # story_id, dominant model/adapter, rubric_version
    └── chapter_NN.json       # { chapter_number, acts: [ {act_number, card_id, adapter,
    │                          #   base_version, editor_card_hit, judge_score,
    │                          #   char_start, char_end}, ... ] }
```

This is additive — it does not change existing ingest fields (MS `ROMANCE_FACTORY_INGEST.md`).

### MS (midnight-satin) — *store a join key*

MS need not render provenance, but must let RT join reader signal to it. **Minimal proposed schema addition:**

```sql
-- New: provenance per chapter (nullable; back-compatible)
CREATE TABLE chapter_provenance (
  chapter_id      UUID PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  base_version    TEXT,
  writer_adapter  TEXT,
  adapter_version TEXT,
  card_id         TEXT,
  rubric_version  TEXT,
  editor_card_hit REAL,
  judge_score     REAL,
  provenance      JSONB          -- full record for anything not columnized
);
CREATE INDEX idx_chapter_provenance_adapter ON chapter_provenance(writer_adapter, adapter_version);
```

Populated by the RF importer (`scripts/import-romance-factory-story.mjs`) from `provenance/chapter_NN.json`. Existing rows without provenance stay `NULL` — nothing breaks.

---

## The join that unlocks the loop

With the above, RT can assemble a training/calibration dataset:

```
reading_progress / chapter_unlocks / novel_reviews   (reader outcome, per chapter)
        ⋈ chapter_provenance                          (what produced it)
        →  { adapter, adapter_version, card knobs, editor_card_hit, judge_score, reader_outcome }
```

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

1. **RT:** assign stable version ids to shipped artifacts (cheap; unblocks everything).
2. **RF:** write `provenance/chapter_NN.json` into the bundle (additive).
3. **MS:** add `chapter_provenance` + importer population (back-compatible).
4. **RT:** build the join + a first calibration report (editor score vs reader completion). No model training yet — just measure whether the proxy holds.

Only after step 4 shows a usable correlation does curated preference data flow into writer training.
