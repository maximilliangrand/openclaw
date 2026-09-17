# OpenClaw #149758: heading-only memory retrieval experiment

**Result: heading distraction is reproducible, but blanket exclusion is harmful. Do not ship this filter as a default.**

This is a research artifact for [issue #149758](https://github.com/openclaw/openclaw/issues/149758), not a product patch or a claim to reproduce the reporter's exact deployment. The issue still asks for a maintainer decision and retrieval evidence. No upstream source is modified.

## What ran

- Pinned OpenClaw source: `a5693d75209158c691badb66f4408a00a1ff89dc`.
- Actual `prepareMemoryIndexChunks`, shared Markdown chunker, annotation/provenance preparation, query helpers and hybrid merge implementation are imported from that checkout. The small loader only resolves TypeScript/source package paths; it does not rewrite their implementations.
- Five synthetic files, 51 baseline chunks, 36 answerable questions and 4 unanswerable questions. Of the 36 answerable questions, 32 concern body facts and 4 concern meaningful facts expressed as headings. All are kept in the headline denominator.
- Corpus and judgments were frozen before any embedding requests. A source-preparation assertion corrected the USER.md fact's line span before the final freeze and before inference. No corpus or relevance judgment was tuned after results.
- Primary model: Qwen3-Embedding-0.6B, GGUF Q8_0, 1024 dimensions. Control: Nomic Embed Text, GGUF F16, 768 dimensions. Actual local inference used Ollama 0.32.9 on macOS arm64, not fake embeddings or paid APIs.
- Qwen queries ran both bare and with the instruction below. Nomic uses its documented `search_document: ` / `search_query: ` prefixes. `truncate:false`, `num_ctx:2048`, batch 8, CPU thread option 2; Ollama used its local accelerator. All inputs fit.

The reporter used managed llama.cpp with a Qwen GGUF. Matching architecture/quantization is **not** backend equivalence. The model manifest/blob identities are in `model-metadata.json`.

## Policy experiment

Baseline: retain the actual prepared chunks unchanged.

Experiment: remove any chunk whose nonblank lines are all ATX headings (`^#{1,6}(?:\s|$)`). Never merge chunks, change retained text, impose a character minimum or copy annotations between entries. This removes 15 chunks, including 4 meaningful heading facts deliberately included as negative controls.

The predicate identifies syntax, not whether a heading carries information. That is the central limitation being tested.

## Results: all 36 answerable questions

Values are baseline →  filter. MRR is mean reciprocal rank of the first chunk containing the judged fact.

| Model/query mode | Ranking | Recall@1 | Recall@3 | MRR |
|---|---|---:|---:|---:|
| Qwen bare | Dense | 29/36 → 29/36 | 33/36 → 30/36 | .8610 → .8296 |
| Qwen instructed | Dense | 32/36 → 30/36 | 35/36 → 32/36 | .9361 → .8611 |
| Nomic prefixes | Dense | 35/36 → 31/36 | 36/36 → 32/36 | .9861 → .8750 |
| Qwen bare | Isolated hybrid | 33/36 → 30/36 | 36/36 → 32/36 | .9583 → .8611 |
| Qwen instructed | Isolated hybrid | 34/36 → 31/36 | 36/36 → 32/36 | .9722 → .8750 |
| Nomic prefixes | Isolated hybrid | 33/36 → 29/36 | 36/36 → 32/36 | .9537 → .8426 |

Every model initially retrieves all 4 heading facts at rank 1. The filter makes all 4 unretrievable. These include a deadline, status, pickup code and a standalone fire-exit note. They must not be removed from the denominator to make the result look favorable.

There is a narrower positive result: on the 32 body questions, instructed-Qwen hybrid Recall@1 improves 30/32 → 31/32, with Recall@3 already 32/32 on both sides. Nomic hybrid body Recall@1 stays 29/32. A generic improvement across models or full product retrieval is not established.

Baseline irrelevant-heading share among the top 3 results, across all 36 answerable queries:

| Mode | Dense | Isolated hybrid |
|---|---:|---:|
| Qwen bare | 35.19% | 27.78% |
| Qwen instructed | 25.93% | 22.22% |
| Nomic prefixes | 4.63% | 1.85% |

Removing all headings mechanically makes that metric zero; it is not sufficient evidence of a better product.

### Concrete witness

For `What is the saved locale?`, instructed Qwen ranks `## Personal preference` ahead of `- Locale: de-AT.` in the isolated hybrid result: scores .3370 and .3262. Filtering moves the correct fact from rank 2 to 1. Conversely, `When is Cedar due?` correctly retrieves `## Cedar deadline: 2026-10-19` at rank 1 before filtering and has no answer afterward.

`results.json` preserves every query's ranks, scores and top 5 snippets. `metrics.tsv` includes Recall@5, body/heading/short-fact/numeric/identifier/paraphrase strata and the unanswerable group. Unanswerable queries have **undefined** recall/MRR, reported as `NA`; with no score gate this harness always returns candidates, so it is not an abstention or false-positive-rate evaluation.

## What “isolated hybrid” means

This uses the current `buildFtsQuery`, `bm25RankToScore` and `mergeHybridResults` functions, plus real in-memory SQLite FTS5 BM25. Each channel supplies at most 20 candidates; weights are .7 vector/.3 text; MMR and temporal decay are disabled; no active project boosts are requested.

It is **not** a full memory-search RPC reproduction. The simplified FTS table has one indexed text column. The harness omits manager-specific candidate gathering, path matching, query expansion, trigger injection, manager fallback routes, `selectHybridSearchResults` score gating and SQLite-vector approximation. Dense retrieval is exact cosine over the stored vectors. The hybrid weights/candidate choices were not part of a fully preregistered protocol; the corpus, questions, judgments and exclusion policy were frozen before inference.

No invoice/accounting data, personal notes, credentials or live agent sessions were used. No assistant-generation quality is measured. A 40-query synthetic corpus is an engineering witness, not a population benchmark, confidence interval or proven production improvement.

## Citation and metadata controls

`prepare-chunks.mjs` asserts:

- Every retained chunk remains byte-for-byte/object-equal to baseline, including citations and provenance.
- All 32 body facts remain represented, including very short notes (`TZ: UTC.`, `Locale: de-AT.`, `Size: XS.`).
- Adjacent Beta/Alpha entries retain their own project, trigger and importance annotations; promotion markers do not merge them.
- Long entry fragments retain their source annotation span and project identity.
- A source-line remap control retains its original start/end lines.

These assertions pass for the synthetic fixtures. They prove preservation of retained objects, **not** safety of deleting heading facts or correctness of production authorization/search behavior.

## Reproduce without downloading models

Requires Node 26.7.0 (the recorded version) and Git; Python is only needed to regenerate embeddings. No package installation is required. Keep this evidence folder beside a new `openclaw-memory` checkout:

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/openclaw/openclaw.git ../openclaw-memory
git -C ../openclaw-memory fetch --depth 1 origin a5693d75209158c691badb66f4408a00a1ff89dc
git -C ../openclaw-memory checkout --detach a5693d75209158c691badb66f4408a00a1ff89dc
git -C ../openclaw-memory sparse-checkout set packages/memory-host-sdk packages/normalization-core extensions/memory-core src/plugin-sdk
node --import ./source-loader.mjs prepare-chunks.mjs
node --import ./source-loader.mjs evaluate.mjs
```

To locate the checkout elsewhere, export `OPENCLAW_SOURCE` to its absolute path. Both scripts verify the source commit and corpus hash. Rerunning evaluation changes only the completion timestamp; substantive scores/metrics should match the cached evidence.

Do **not** rerun `freeze-corpus.mjs` for a normal reproduction: use the frozen `corpus.json`/`protocol.json`. The generator is included to make authorship and negative-control design inspectable.

## Regenerate the real embeddings, optionally

Use an isolated Ollama server/model directory. Do not reuse a production model service or change its settings. This example starts a foreground server in a separate terminal:

```sh
OLLAMA_HOST=127.0.0.1:11439 OLLAMA_MODELS="$PWD/local-models" OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_NUM_PARALLEL=1 ollama serve
```

In the evidence directory, another terminal:

```sh
OLLAMA_HOST=127.0.0.1:11439 ollama pull qwen3-embedding:0.6b
OLLAMA_HOST=127.0.0.1:11439 ollama pull nomic-embed-text:latest
curl -fsS http://127.0.0.1:11439/api/tags
python3 embed.py --model qwen3-embedding:0.6b --label qwen
python3 embed.py --model nomic-embed-text:latest --label nomic
node --import ./source-loader.mjs evaluate.mjs
```

Before embedding, compare `/api/tags` digests with `model-metadata.json`; tags can change. Different digests/backends are a new experiment, not a byte-identical reproduction. Keep the original vector files if you want to compare. Qwen document text is unprefixed; instructed queries are exactly:

```text
Instruct: Given a search query, retrieve relevant personal memory passages that answer the query
Query:<query text>
```

The source model documents query instructions; the Nomic model documents search prefixes: [Qwen model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B), [Nomic model card](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5).

Recorded local inference took 6.20 seconds for Qwen (51 documents +40 bare +40 instructed queries) and 1.36 seconds for Nomic (51 documents +40 queries), including request/load time but excluding download. These are resource receipts, not a throughput comparison. Qwen's downloaded blob was 639,150,592 bytes; Ollama reported 2,127,382,445 bytes loaded. Peak process RSS was not measured. The Qwen weights were removed and the owned model server was stopped after the experiment; vector evidence remains.

## Proposed design discussion

This supports investigating heading distraction, **not** blanket deletion or a minimum-character threshold. Headings may hold the only answer. The issue's requested policy decision remains necessary.

Would maintainers prefer a design that preserves heading text as section context while keeping each curated entry's own citation and annotation scope, or an explicit opt-in admission policy? A follow-up should establish a safe representation before choosing a default, add production search-owner coverage, preserve the 4 heading facts and 32 body facts, obtain a sanitized real corpus/query comparison, and state how existing indexes rebuild. Simply concatenating a heading into its neighbor risks inaccurate citations and metadata inheritance and is not implemented here.
