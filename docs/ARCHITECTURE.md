# Romance Project — System Architecture

**Status:** Living architecture doc (Jul 2026)
**Scope:** How **romance-training (RT)**, **romance-factory (RF)**, **romance-voice (RV)**, and **midnight-satin (MS)** work together — the forward artifact flow, the backward feedback loops, and the contracts at each boundary.

This repo owns **no runtime code**. It owns the *map*, the *cross-cutting contracts*, and the *design principles* that keep independently-deployed systems coherent. Each system keeps its own repo, remote, CI, and deploy cadence.

---

## The systems

| Repo | Role | Stack | Deploy |
|------|------|-------|--------|
| **romance-training (RT)** | Trains the models: **judge**, **editor**, **writer** | Python / Unsloth / Gemma 4 MoE, on DGX Spark | Ships model artifacts (GGUF/LoRA) + contracts |
| **romance-factory (RF)** | The **harness**: runs the models, drafts → grades → revises → merges into finished books; emits generation telemetry | Python generate pipeline | Produces story bundles |
| **romance-voice (RV)** | **Audiobook TTS**: Spark-resident VoxCPM; RF/RT upload manuscript or story zip → MP3 / audiobook zip | FastAPI + VoxCPM (RF engine), on DGX Spark | HTTP on Spark `:8081` (tunnel `:18081`) |
| **midnight-satin (MS)** | The **frontend**: readers discover, read, unlock, review, comment; captures reader signal | Next.js 16 / Vercel / Neon Postgres | Vercel (git-integrated) |

### RT's three products (never cross-trained)

- **Judge** — scores prose against the Leech & Short rubric + a steering card. The independent referee.
- **Editor** — grades and rewrites style at sentence / span / act grain. The writer's critic.
- **Writer** — card-conditioned MoE base + swappable voice/genre LoRA adapters that generates on-card prose.

Governing rule: **judge, editor, and writer are separate training products.** Never overwrite one checkpoint with another's data, and keep the referee judge held out from the writer's reward loop.

### Resolved — romance-editor is superseded

**romance-editor** was an early attempt to isolate the editing model as its own product (Qwen3-8B QLoRA on Style-in-Fiction, single-3090 scale). **Decision (Jul 2026): abandon it; the editor stays inside romance-training.**

Rationale: editing and writing are tightly interlinked, and — critically — the **Leech & Short style-classification data is shared across all three products.** The same labeled corpus that teaches the judge to score also teaches the editor to rewrite and the writer to generate on-card. Forking the editor into its own repo would fork that shared data substrate and duplicate the labeling pipeline. romance-editor is kept only as historical reference, not as a pillar of the architecture.

> This is the deeper reason RT is one repo, not three: the products share a **model** base family *and* a **data** substrate (the classification labels). Keep them co-located; keep the checkpoints separate.

### Resolved — TTS lives in romance-voice, not in RF's process

**romance-voice (RV)** is the Spark-resident audiobook TTS service. RF already owns the *batch* CLI (`romance-factory-tts` / VoxCPM engine); RV wraps that engine behind an HTTP job API so the RF/RT *client workstation* can upload a manuscript or story zip, leave synthesis on Spark, and download MP3 (or a zip of per-act MP3s + `audio_manifest.json`).

**Decision (Jul 2026): keep TTS as its own repo and GPU tenant.** Rationale: VoxCPM must not share a venv or idle residency with LM Studio (the prose LLM on Spark `:1234`). RV loads/unloads on demand (`unload_after`), listens on `:8081` (RT tunnel `:18081`), and never blocks the LLM path. RF remains the content owner; RV is a *service* RF (or RT) calls — not a fourth training product. Narrated audio **does** enter the MS ingest path as part of the publish bundle (see **DEC-4** / [contracts/AUDIOBOOK.md](contracts/AUDIOBOOK.md)).

Canonical runbook: RV `AGENTS.md` + `tts-spark-serve.md`. Product API: `POST /v1/audio/audiobook` → poll `GET /v1/audio/jobs/{id}` → `.../mp3` or `.../download`.

---

## Standing conventions

Project-wide rules of thumb, owned here because this repo is the coordination hub as MS/RF/RT/RV converge. They hold until explicitly revised in this doc.

- **Legacy support = dropped.** We are early-stage; optimize for new work, not backward compatibility. Do **not** add code to support legacy generations. In particular, RF's pre-existing `stories/` bundles predate the card/provenance system and are **unsupported** — build for **new generations only**, with no backfill or compatibility shims. The contracts here (steering card, provenance) are therefore **forward-only**.
- **Separate training products** (established): judge, editor, and writer are never cross-trained; the referee judge is held out from the writer's reward loop.
- **Spark GPU tenancy:** LM Studio (LLM `:1234`), romance-voice (TTS `:8081`), and ComfyUI (`:8188`) are **separate tenants**. Do not install TTS into the LLM path; unload VoxCPM when idle; prefer pausing LM Studio for heavy audiobook jobs until concurrent residency is measured (RV runbook policy A).

---

## Forward flow — artifacts move RT → RF → MS (with RF ↔ RV for audio)

```mermaid
flowchart LR
  RT[romance-training] -->|models + card schema + rubric| RF[romance-factory]
  RF -->|story / manuscript| RV[romance-voice]
  RV -->|MP3 + audio_manifest| RF
  RF -->|story bundle + assets| MS[midnight-satin]
  MS -->|book| reader[Reader]
```

**RT → RF (model artifacts).** Quantized base + writer adapters + editor + judge (GGUF/LoRA), the shared `steering_card` schema, and the rubric version. RF loads these and runs the draft→grade→revise loop.

**RF ↔ RV (audiobook).** RF (or RT) uploads a story zip or manuscript to RV over HTTP; Spark runs VoxCPM, then a **forced-alignment post-process** (stable-ts) to produce paragraph cues; the client downloads per-act MP3s + `audio_manifest.json`. Narrator brief comes from the author profile (`tts_narrator_voice`) or the request's `voice_design`. Assets land on the story tree under `audio/` and ship in the publish bundle. **Status:** Spark service scaffolded; live synth + alignment still open (RV-1 / RV-2); RF client + bundle wiring (RF-4 / RF-5). Contract: [contracts/AUDIOBOOK.md](contracts/AUDIOBOOK.md) (§4b alignment bridge).

**RF → MS (story bundle).** A self-contained story directory — `author_profile.json`, `book_cover.json`, `character_dossiers.json`, `story_outline.json`, `publish_manifest.json`, `chapters/chapter_NN.md`, `publish_images/`, and **`audio/`** (`audio_manifest.json` + chapter/act MP3s). Prose + image edge is **already real and contracted**: see MS `docs/ROMANCE_FACTORY_INGEST.md` and `docs/ROMANCE_FACTORY_GAPS.md`. Audiobook is **contracted** (DEC-4 / DEC-5): at MS ingest, **MP3s → Vercel Blob**, **paragraph cues → Neon JSONB**; player work is MS-3 / MS-4 (parallel to RV). Ownership boundary: RF owns content + assets + metadata (including audio); MS validates, imports, and presents.

Operational notes:
- **Prose LLM** on Spark = LM Studio (`:1234`, RT tunnel `:18080`). See RT `docs/LLM-Backends.md`.
- **TTS** on Spark = romance-voice (`:8081`, RT tunnel `:18081`). Separate venv; load/unload policy in RV `AGENTS.md`.
- **SDXL** cover/portrait generation runs on the **mac mini after ejecting the prose LLM from LM Studio** on that box — prose *or* images, not both at once.

---

## Backward flow — the feedback loops (mostly greenfield)

Two loops feed learning back to RT. They carry **different signals and must not be conflated.**

```mermaid
flowchart RL
  RT[romance-training]
  RF[romance-factory] -.->|machine signal: editor/judge grades, revisions, card+adapter used| RT
  MS[midnight-satin] -.->|human signal: reads, unlocks, completion, reviews| RT
```

### Loop 1 — RF observation (machine signal)

Editor grades, judge scores, revision counts, which card + adapter produced each passage, where drafts failed. Measures **fidelity to the card**: "did it write what it was told." Abundant, cheap, fast — but **circular** (same rubric the models trained on). It cannot tell you the rubric is any good.

### Loop 2 — MS analytics (human signal)

Reader behavior. Measures **appeal**: "do readers actually want this." Sparse, slow, noisy, confounded — but the **only non-circular signal** in the system, and the closest thing to ground truth.

**Status:** the signal *tables* exist in MS's Neon schema, and new imports can carry RF provenance (`rf_story_id` / `rf_provenance`). There is still **no export, no analytics pipeline, nothing feeding RT.** The calibration report is greenfield once RT-1 fills version stamps.

---

## The two-signal rule (the core principle)

There is a **proxy hierarchy**: computable metrics → editor/judge (rubric proxy) → reader appeal (near-truth). Each layer should be validated by the one above it.

**The human signal's primary job is to calibrate the machine proxies — not to directly reward the writer.** If reader appeal and editor scores diverge, the first response is to *fix the rubric/editor*, not to retrain the writer to chase engagement. MS is the ecosystem-level independent referee, the same way the judge is the independent referee within training.

Only *after* the proxies are calibrated against humans do MS-derived preferences (story A > B for the same card) become writer preference-training data — and even then, gated.

> **Decision (DEC-1, Jul 2026):** treat MS human signal as **proxy-calibration + curated, de-confounded preference data**, *not* a tight direct-optimization reward. Rationale: RT version stamps are still incomplete (RT-1) and the signal is confounded by featuring/paywalls — neither is safe to close a tight loop through. Revisit once RT-1 lands and confounds are controlled.

---

## Reader-signal inventory (from MS schema)

Ranked by trustworthiness — **revealed preference** (what readers did, at a cost) beats **stated preference** (what they said).

| Signal | MS source | Type | Strength |
|--------|-----------|------|----------|
| Bought the paperback | `paperback_orders` | Revealed (costly) | **Strongest** |
| Paid credits to read past the Veil | `chapter_unlocks` + `credit_transactions` | Revealed (costly) | **Strong** |
| Paid 1 credit for the novel audiobook | `audiobook_unlocks` + `credit_transactions` (`audiobook_unlock`) | Revealed (costly), **novel-level** | **Strong** — intent to listen (DEC-4; MS-4) |
| Where readers stop | `reading_progress.scroll_percent` (per chapter) | Behavioral, **localized** | **Strong** — drop-off = where prose lost them |
| Star rating + text | `novel_reviews.star_rating` | Stated | Medium |
| Chapter reactions | `comments` (threaded, `like_count`) | Stated, needs NLP | Medium |
| Character affinity | `characters.endorsement_count` | Stated | Medium |
| Voice affinity | `author_follows` | Behavioral | Medium |
| Save intent | `reader_bookmarks` | Weak behavioral | Weak |

`reading_progress.scroll_percent` is the standout: a per-chapter drop-off point is a localized "the prose lost me here" signal that — **with provenance** — maps back to the span/act/card that composed that passage. That is a direct line to editor/writer training signal at span grain.

---

## Failure-mode design principles

The known ways generate→train ecosystems rot. Each is a standing constraint.

1. **Model collapse.** Training the writer on its own RF outputs degrades diversity over generations. → Every training round is **anchored with real human-authored corpus** and held-out real prose; RF output is *candidate* data, never the whole diet.
2. **Goodhart / reward hacking.** A direct engagement reward produces bait and formula, and gets the rubric gamed. → Human signal calibrates proxies (two-signal rule); keep the judge held out from both the editor and the reader loop.
3. **Confounded human signal.** `novels.is_featured` / `featured_order`, the Veil paywall (`is_free`), and `news_articles` of type `popularity`/`ranking` drive reads independent of prose quality. → Any "this book did better" signal must **control for placement, promotion, and paywall** (hold presentation constant; A/B the same story under different cards/adapters) before it is trusted for attribution.
4. **Cadence mismatch + provenance.** Human signal arrives weeks late; training wants batches now. → Treat feedback as a **slow calibration channel**, not a live gradient; version-stamp everything crossing a boundary.
5. **Privacy & consent.** MS is real users and adult content. → Reader behavior as training data needs consent and age-gating handled **in the contract**, not as an afterthought.

---

## Provenance status (the loop's prerequisite)

For any reader outcome to inform training, RT must know **which writer adapter, which steering card, which model version** produced each chapter.

**RF → MS handoff: shipped.** New generations mint `story_id`, emit `provenance/` (per-act records + stitch offsets), and MS stores `novels.rf_story_id` + `chapters.rf_provenance` (JSONB `acts[]`). See **[PROVENANCE.md](PROVENANCE.md)** and [BACKLOG.md](BACKLOG.md) (RF-1, RF-2, MS-1).

**Still open:** RT does not yet stamp stable `*_version` ids on shipped artifacts (RT-1), so RF often writes those fields as `null`. Until that lands, reader outcomes can join to story/chapter/act/card structure but not reliably to a model *version*. There is also no MS→RT export or calibration report yet.

Note: git-level pinning (a manifest of known-good commits) gives *release*-granularity reproducibility, but the loop needs *per-story* provenance in the **data**. Don't conflate the two.

---

## Pre- vs post-deployment evaluation

- **Pre-deployment gate:** RT's Phase 5A bake-off — does a model clear the quality bar before it ships to RF?
- **Post-deployment continuous eval:** RF observation + MS analytics — the **proving ground** where shipped models earn their keep against real readers.

---

## Where contracts live

| Contract | Canonical home | Mirrored/summarized here |
|----------|----------------|--------------------------|
| Story bundle (RF → MS) | MS `docs/ROMANCE_FACTORY_INGEST.md` | Referenced, not duplicated |
| Consumer gaps (MS ← RF) | MS `docs/ROMANCE_FACTORY_GAPS.md` | Referenced |
| Model artifacts (RT → RF) | RT `docs/PHASE5_STYLE_STEERING.md`, `MOE_WRITER.md` | Referenced |
| Audiobook TTS serve (RF/RT → RV) | RV `AGENTS.md`, `tts-spark-serve.md` | Summarized in *Resolved — TTS lives in romance-voice* above |
| **Audiobook bundle + reading room (RV → RF → MS)** | **This repo — [contracts/AUDIOBOOK.md](contracts/AUDIOBOOK.md)** | Owned here (bundle, cues, unlock, Veil gate, jump-sync) |
| **Steering card (RT vocab → RF authoring → MS provenance)** | **This repo — [contracts/STEERING_CARD.md](contracts/STEERING_CARD.md)** | Owned here (canonical shape + cascade) |
| **Identifiers & segmentation (story→chapter→act→span)** | **This repo — [contracts/IDENTIFIERS.md](contracts/IDENTIFIERS.md)** | Owned here (hierarchy + ids + stitch offsets) |
| **Per-story provenance (RT → RF → MS)** | **This repo — [PROVENANCE.md](PROVENANCE.md)** | Owned here (spans RT/RF/MS; audio cues join via `story_id` + chapter char offsets) |

Provenance lives here precisely because it spans RT/RF/MS and has no single owner otherwise. Audiobook packaging and reading-room rules live in [contracts/AUDIOBOOK.md](contracts/AUDIOBOOK.md) for the same reason (RV + RF + MS).

---

## Open decisions

1. **Umbrella mechanics:** manifest-only (current) vs promote to git submodules if atomic historical checkout becomes necessary.

### Resolved

- **romance-editor** (Jul 2026): superseded — editor stays in romance-training; the three products share the style-classification data substrate. See *Resolved — romance-editor is superseded* above.
- **romance-voice** (Jul 2026): Spark-resident TTS as its own repo/GPU tenant; RF owns content + batch CLI, RV owns the HTTP serve path. See *Resolved — TTS lives in romance-voice* above.
- **DEC-1 human-signal role** (Jul 2026): calibration-first + curated preference data; not a tight direct-optimization reward. See *The two-signal rule* above and [BACKLOG.md](BACKLOG.md).
- **DEC-2 MS provenance storage** (Jul 2026): `novels.rf_story_id` + `chapters.rf_provenance` JSONB (`acts[]` with stitch offsets). No separate provenance table. See [PROVENANCE.md](PROVENANCE.md).
- **DEC-4 audiobook → MS** (Jul 2026): `audio/` is required in the publish bundle; 1-credit novel-level unlock; playback capped to Veil-unlocked chapters; paragraph jump-sync (not continuous scroll); background playback. See [contracts/AUDIOBOOK.md](contracts/AUDIOBOOK.md) and [BACKLOG.md](BACKLOG.md).
- **DEC-5 audiobook storage** (Jul 2026): MP3s in **Vercel Blob**; paragraph cues in **Neon JSONB**; bundle manifest is import source of truth. See [contracts/AUDIOBOOK.md](contracts/AUDIOBOOK.md) §5.
- **RF→MS provenance handoff** (Jul 2026): RF-1 / RF-2 / MS-1 shipped. Remaining P0 is RT-1 (version ids). See [BACKLOG.md](BACKLOG.md).
