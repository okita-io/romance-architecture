# Steering Card Contract

**Status:** Canonicalization of an existing system (Jul 2026)
**Spans:** romance-training (RT) · romance-factory (RF) · midnight-satin (MS, via provenance)
**Vocabulary source of truth:** RT `source/style_rubric.json` (v2.0) — 14 dimensions + 6 textual principles
**Scope:** New generations only — legacy RF `stories/` are unsupported (see [ARCHITECTURE.md → Standing conventions](../ARCHITECTURE.md#standing-conventions)).
**Related:** [ARCHITECTURE.md](../ARCHITECTURE.md), [PROVENANCE.md](../PROVENANCE.md)

The **steering card** is the shared contract that write, grade, and rewrite all target. It is not new — RF already computes it per act (`src/romance_factory/style/targets.py::compute_act_style_targets`). This document canonicalizes its shape, its resolution cascade, and who owns what, so the writer, editor, and judge all mean the same thing by "the card."

---

## 1. Profile vs card (measured vs targeted)

Two objects, projections of each other:

| Object | What it is | Keys | Who emits/uses |
|--------|-----------|------|----------------|
| **`style_profile`** | *Measured* output | all 20 (incl. 4 computable as **scalars**) | judge/editor **emit** it when grading |
| **`steering_card`** | *Targeted* input | semantic dims as **enums** + computable dims as **ranges** | writer conditions on it; editor/judge grade **against** it |

- **Semantic dimensions** (`register`, `pov`, `narrative_distance`, `free_indirect_discourse`, `sentence_complexity`, `figurative_density`, `tone`, `mind_style`, `cohesion`, `lexical_complexity`, + textual principles) → card holds an **enum value** from the rubric.
- **Computable dimensions** (`sentence_length_mean`, `lexical_density`, `subordination_ratio`, `dialogue_ratio`) → card holds a **`[min, max]` range**, not a scalar. They are *derived* (from verbosity/archetype), never hand-set. Grading checks **range containment**, not equality.

This resolves the earlier confusion: computables *are* targeted, but as ranges, and only via the translation layer below.

---

## 2. Two vocabularies + the translation layer

The system deliberately separates the **authoring vocabulary** (what a human or outline sets) from the **fine rubric card** (what models consume). RF owns the translation between them.

| Authoring input (coarse) | Where | Translates to (fine card) | Via |
|--------------------------|-------|---------------------------|-----|
| Author persona (prose: `writing_style`, `sentence_structure`, `narrative_voice`, …) | `author_profiles.json` | base voice card (structured rubric dims) | `style_profile_from_author()` |
| `style_archetype` (`terse` / `balanced` / `verbose`) | derived from persona | `sentence_length_mean` + `lexical_density` bands | `derive_style_archetype()` + band tables |
| `verbosity_level` (`0` / `1` / `2`) | outline act beat | `sentence_length_mean` range (**authoritative** over archetype) | `compute_act_style_targets()` |
| `heat_level` / `action_level` | outline act beat | **nudge** `sentence_length_mean` shorter when ≥ 4 | `compute_act_style_targets()` |
| `romance_milestone` `style_expectations` | milestones doc | override specific card knobs (e.g. `tone`) | `_merge_milestone_style()` |

**Heat is content, not style.** The `HEAT-G … HEAT-XXX` ladder (`generate/benchmark/heat_ladder.py`, permissive-gated) is a content-explicitness axis. It never enters the style card as a dimension; it only produces a documented *side-effect* (shorter sentences at high heat). Keep it in the content/policy facet of an assignment, alongside the genre/voice **adapter** (see [MOE_WRITER](../../../romance-training/docs/MOE_WRITER.md)) — neither belongs in the card.

---

## 3. The resolution cascade (exists in RF)

```
author persona                → style_profile_from_author()  →  BASE VOICE CARD      [novel / voice level]
  + act-beat coarse controls   → compute_act_style_targets()  →  + length/density, heat nudge
  + milestone style_expectations                              →  override knobs        [scene / beat level]
  = RESOLVED per-act card (style_targets, attached to the outline beat)
```

Resolution order (later wins on the knobs it sets): **base voice → act-beat controls → milestone overrides**. Unset knobs inherit from the level above. This is the CSS-like cascade proposed in ARCHITECTURE.md — it is already implemented; this contract just names it.

`card_id` = stable hash of the **resolved** target set. Computed by RF at resolve time and carried into provenance (see PROVENANCE.md) so reader outcomes join back to the exact resolved card.

### `card_id` determinism (ARCH-1)

Canonical algorithm (matches RF `card_id_from_targets`):

1. Build payload `{ "rubric_version": <string or "">, "targets": <resolved targets object> }`.
2. Serialize with `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
3. SHA-256 the UTF-8 bytes; take the first 16 hex chars.
4. Emit `card_<hex16>`. Return no id when `targets` is empty/absent.

Any re-derivation (RT tooling, audits) must use this exact input shape and serialization so ids agree with RF provenance.

---

## 4. Canonical schema

```jsonc
{
  "card_schema_version": "1.0",
  "rubric_version": "2.0",                 // pins the enum vocabulary (style_rubric.json)
  "card_id": "card_<hash-of-resolved-targets>",
  "label": "Intimate first-person with FID",   // optional human name
  "grain": "act",                          // novel | act | scene/beat  (what this card resolved for)
  "targets": {
    "pov": "first_person",                 // semantic → rubric enum
    "narrative_distance": "intimate",
    "free_indirect_discourse": "heavy",
    "register": "neutral_narrative",
    "sentence_complexity": "moderate",
    "figurative_density": "moderate",
    "tone": "melancholic",
    "sentence_length_mean": [10, 18],      // computable → derived RANGE
    "lexical_density": [0.45, 0.55]
    // ... remaining resolved dims + textual principles
  }
}
```

Validation: every semantic value must be a legal label in `style_rubric.json → dimensions[].values`; every computable must be a `[min,max]` within the rubric's band bounds. Version the pair (`card_schema_version` + `rubric_version`) together.

**Eval vs production note:** RT's `eval/style_benchmark/fixture.json` uses cards that omit computables (semantic labels only, for cross-run comparison). Production RF cards include computable ranges. The canonical schema is the superset: computable ranges are **optional** but preferred for drafting/grading.

---

## 5. Ownership

| System | Owns |
|--------|------|
| **RT** | The rubric **vocabulary** (`style_rubric.json`: dimension ids, enums, bands). The judge/editor that **grade** achieved profile vs card. |
| **RF** | Author profiles; the **translation layer** (`style_profile_from_author`, `compute_act_style_targets`); attaching resolved cards to outline beats; computing `card_id`. |
| **MS** | Stores `card_id` (+ inline knobs) as a provenance join key — does not author or interpret cards. |
| **This contract** | The canonical card **shape** + cascade; points at RT's rubric as vocab source of truth. |

---

## 6. Grading against the card

The editor/judge produce a **card-hit**: for each targeted knob, semantic dims score an enum match (exact / near / miss); computables score range containment. The aggregate is the `editor_card_hit` / `judge_score` recorded in provenance. Divergence between a high card-hit and poor reader outcome is the calibration signal (ARCHITECTURE.md, two-signal rule).

---

## 7. Open items

- **Persona → dims is lossy and LLM-derived.** `style_profile_from_author()` converts prose to enums; version it and record which model/prompt did the conversion, or two "same" author profiles may drift (BACKLOG RT-2).
- ~~**card_id determinism (ARCH-1)**~~ — **Done** (§3). RF `card_id_from_targets` is the reference implementation.
- **Grain binding.** The card attaches at the **act** (`act_number`), the base voice at the **story** (author profile). The full unit hierarchy (story → chapter → act → span → sentence) and the ids are defined in [IDENTIFIERS.md](IDENTIFIERS.md).
- **Mind style / cohesion / lexical_complexity** appear in the rubric but not in RF's current `compute_act_style_targets` default set — decide whether the writer targets them or they stay grade-only (BACKLOG RT-4).
