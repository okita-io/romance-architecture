# Identifier & Segmentation Contract

**Status:** Adopted (Jul 2026) — `story_id` + stitch offsets shipped in RF; MS store (MS-1) still open
**Spans:** romance-training (RT) · romance-factory (RF) · midnight-satin (MS)
**Scope:** New generations only — legacy RF `stories/` are unsupported (see [ARCHITECTURE.md → Standing conventions](../ARCHITECTURE.md#standing-conventions)).
**Related:** [STEERING_CARD.md](STEERING_CARD.md), [PROVENANCE.md](../PROVENANCE.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

The steering card and provenance contracts both assume you can name *which unit of text* a card, a grade, or a reader signal refers to — and that the name survives RT → RF → MS. This contract defines the shared unit hierarchy, the stable identifiers, and the one seam (act→chapter stitching) that the reader-signal join depends on.

---

## 1. Canonical unit hierarchy

```
story  ─▶  chapter  ─▶  act  ─▶  span  ─▶  sentence
```

| Unit | Owner / primary use | Notes |
|------|--------------------|-------|
| **story** | the novel/manuscript | one RF generation run → one MS novel |
| **chapter** (`chapter_number`) | **MS** presentation unit **+** RF export unit | what readers read; what `reading_progress` measures; a chapter is **stitched from ordered acts** |
| **act** (`act_number`) | **RF** drafting unit **+ the steering-card grain** | resolved `style_targets` attach here (`compute_act_style_targets`); multiple acts stitch into one chapter; "bridge acts" (transitions / internal thought) are acts too |
| **span** (~250–350w) | **RT** editor mid grain | sub-act; the primary editor grade/rewrite unit |
| **sentence** | **RT** editor fine grain | sub-span |

`scene_type` (e.g. `opening`, `climax_reveal`, `romantic_encounter`) and `beat` are **attributes of an act**, not extra levels — an "act beat" is the outline node describing an act. Keep the hierarchy five deep.

---

## 2. Identifiers

| Unit | Identifier | Stability |
|------|-----------|-----------|
| story | **`story_id`** (UUID, minted by RF at creation) | **Shipped** — see below |
| chapter | `(story_id, chapter_number)` | `chapter_number` 1..N, stable per story |
| act | `(story_id, act_number)` | `act_number` global and ordered across the story; grouped into a chapter by `chapter_number` |
| span | `(story_id, act_number, span_index)` | RT-internal; **store char offsets** (spans shift if re-chunked) |
| sentence | `(story_id, act_number, sentence_index)` | RT-internal |

### The `story_id` anchor

**Shipped (RF-1):** RF mints a stable `story_id` (UUID) at story creation (`ensure_story_id`), writes it into genesis + `manuscript_metadata.json` + `publish_manifest.json` (+ `provenance/story.json`). **Open (MS-1):** MS should store it as `novels.rf_story_id` (DEC-2); MS still mints its own `novelId` at import — `rf_story_id` is the durable cross-system join once persisted. Everything else in this document hangs off `story_id`.

---

## 3. The stitch seam (acts → chapter) — the critical join

RF drafts and cards **per act**, then **stitches ordered acts into a chapter** (`chapter_acts: [(act_number, prose), ...]`). MS then measures engagement **per chapter** as `reading_progress.scroll_percent`. To back-project a reader drop-off to the act that owns a card/adapter, the stitch step must record each act's **character range within the final chapter text**:

```jsonc
// per chapter, recorded at stitch time and carried in the bundle
{
  "chapter_number": 7,
  "acts": [
    { "act_number": 19, "char_start": 0,    "char_end": 2140, "card_id": "card_…", "writer_adapter": "dark-fantasy" },
    { "act_number": 20, "char_start": 2140, "char_end": 4880, "card_id": "card_…", "writer_adapter": "dark-fantasy" }
  ]
}
```

```mermaid
flowchart LR
  reader[reading_progress.scroll_percent] --> off[× chapter length = char offset]
  off --> act[which act's char range]
  act --> card[card_id + adapter + grades]
  card --> RT[calibration / hard negatives]
```

Without these offsets, per-chapter reader signal cannot localize to the act (and its card) — the feedback loop degrades to whole-book granularity. This is the segmentation half of [PROVENANCE.md](../PROVENANCE.md).

---

## 4. Card & provenance binding

- **Card grain = act.** Novel-level base card = the author profile's voice; act-level cards = resolved `style_targets` (see [STEERING_CARD.md](STEERING_CARD.md)).
- **Provenance granularity = act,** grouped by chapter with offsets (§3). This **refines** PROVENANCE.md, which sketched per-chapter records: the canonical unit is `acts[]` with char ranges, and chapter-level provenance is their aggregate.
- **RT editor grades** attach at `(story_id, act_number, span_index)`; a span's grade rolls up to its act.

---

## 5. Ownership

| System | Owns |
|--------|------|
| **RF** | Mints `story_id`; assigns `chapter_number` + `act_number`; records **stitch offsets**; owns outline structure (acts, beats, scene types). |
| **RT** | Segments act prose into spans/sentences (editor grains); grades attach to act/span ids; stores span **char offsets** for stability. |
| **MS** | Will store `story_id` (`rf_story_id`) + `chapter_number` (MS-1); captures `reading_progress` at chapter + `scroll_percent`; joins to acts via offsets once provenance is persisted. |
| **This contract** | The shared hierarchy, the id scheme, and the stitch-offset requirement. |

---

## 6. Open items

- ~~**`story_id` minting + RF propagation**~~ — **Done** (RF-1). **MS persistence** still open (MS-1).
- **Act numbering** — this contract assumes `act_number` is **global** across the story (consistent with RF `story_state`'s story-wide `planted_act` / `RomanceMilestone.act`) and grouped into chapters. Confirm no per-chapter act re-numbering exists in the new pipeline (BACKLOG RF-3).
- **Span stability** — RT chunk boundaries move if re-chunked; store char offsets and a segmentation version so span ids remain joinable (BACKLOG RT-3).
- **Bridge acts** — confirm bridge/transition acts get their own `act_number` (they should, so their card/provenance is addressable) rather than being merged into a neighbor at stitch time (BACKLOG RF-3).
