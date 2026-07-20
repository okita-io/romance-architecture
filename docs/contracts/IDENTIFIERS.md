# Identifier & Segmentation Contract

**Status:** Proposed contract (Jul 2026)
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
| story | **`story_id`** (UUID, minted by RF at creation) | **GAP today** — see below |
| chapter | `(story_id, chapter_number)` | `chapter_number` 1..N, stable per story |
| act | `(story_id, act_number)` | `act_number` global and ordered across the story; grouped into a chapter by `chapter_number` |
| span | `(story_id, act_number, span_index)` | RT-internal; **store char offsets** (spans shift if re-chunked) |
| sentence | `(story_id, act_number, sentence_index)` | RT-internal |

### The `story_id` gap (the anchor)

Today RF names a story only by a path/slug (`stories/<ts>_<author>_<title>`) and a `story_slug` in the publish bundle; there is **no stable UUID**, and MS mints its own `novelId` (UUID) at import. Nothing durable links an RF story to its MS novel — so reader signal cannot be joined back to the generation.

**Contract:** RF mints a stable `story_id` (UUID) at story creation, writes it into the bundle (`manuscript_metadata.json` + `publish_manifest.json`), and MS stores it on the novel (`novels.rf_story_id`). Everything else in this document hangs off `story_id`. This is the cheapest, highest-leverage fix — do it first, alongside the RT version-id step from PROVENANCE.

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
| **MS** | Stores `story_id` (`rf_story_id`) + `chapter_number`; captures `reading_progress` at chapter + `scroll_percent`; joins to acts via offsets. |
| **This contract** | The shared hierarchy, the id scheme, and the stitch-offset requirement. |

---

## 6. Open items

- **`story_id` minting + propagation** — the anchor gap in §2. Do first.
- **Act numbering** — this contract assumes `act_number` is **global** across the story (consistent with RF `story_state`'s story-wide `planted_act` / `RomanceMilestone.act`) and grouped into chapters. Confirm no per-chapter act re-numbering exists in the new pipeline.
- **Span stability** — RT chunk boundaries move if re-chunked; store char offsets and a segmentation version so span ids remain joinable.
- **Bridge acts** — confirm bridge/transition acts get their own `act_number` (they should, so their card/provenance is addressable) rather than being merged into a neighbor at stitch time.
