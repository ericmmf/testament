# Architectural Decisions — Testament MVP

This file records non-obvious decisions made during development.
Purpose: prevent re-opening closed questions and document *why*, not just *what*.

---

## 1 — Asset classification: three-layer defense

**Decision:** IRPF bens e direitos classification uses three independent guards, in order:
1. Extraction prompt (`lib/parsers/pdf-extractor.ts`) — instructs Haiku on grupo/codigo semantics
2. Post-extraction sanitizer (`sanitizeBensEDireitos()`) — corrects grupo "01" misassignments before storing
3. Generator discriminação-first check (`lib/generators/playbook-generator.ts`) — `isFinancialAsset()` runs before `IMOVEL_GRUPOS.has(g)`

**Why:** Haiku reads PDF layout visually and freely assigns grupo "01" to financial accounts that appear near the imóveis section. Without explicit rules in the prompt, XP brokerage accounts appeared under Imóveis in production (April 2026). The three-layer approach ensures the bug cannot recur even if any single layer fails.

**Invariant:** The order of checks in `classify()` is load-bearing. `isCreditoAReceber → isBolsaOrFII → isFinancialAsset` MUST run before `IMOVEL_GRUPOS.has(g)`. Never reorder.

**Regression guard:** `lib/generators/__tests__/classify.test.ts` — run `npm test` before merging any generator or extractor change.

---

## 2 — PDF extraction: `.create()` not `.stream()`

**Decision:** `pdf-extractor.ts` uses `client.messages.create()` with `max_tokens: 16000`.

**Why:** `.stream()` caused ECONNRESET after ~8.5 minutes on large (27-page) IRPFs. `max_tokens: 8000` caused JSON truncation. Current config processes all known IRPF sizes within the 5-minute timeout without truncation.

**Do not change:** model (`claude-haiku-4-5-20251001`), method (`.create()`), or `max_tokens` below 16000.

---

## 3 — Deduplication of PDF-sourced bens

**Decision:** `deduplicatePDF()` in the generator deduplicates by `(grupo, codigo, CNPJ-or-first-50-chars-of-discriminação)`, keeping the longest discriminação.

**Why:** Haiku processes a 27-page PDF and repeats the same items across multiple pages. Without dedup, a single fund appears 3-4 times in the playbook. CNPJ is the primary key (unique per fund/company); discriminação prefix is the fallback for items without CNPJ.

---

## 4 — FCF Equity method (for financial models, not app)

Method A: CAPEX + debt inflows + debt service appear in cash flow; equity residual is implicit. No double-counting.

---

## 5 — Playbook regeneration: preserve manual fields

**Decision:** `POST /api/playbook/[id]/regenerate` re-runs `generatePlaybook()` from existing `irpf_uploads.parsed_data` without calling Anthropic. It merges: IRPF-sourced sections (imoveis, ativosFinanceiros, participacoes) from the fresh run; manually-entered fields (briefing, certidaoCasamento, contatosEssenciais, documentosDropbox, observacoesAdvisor, etc.) from the existing record.

**Why:** Advisors manually enter data that has no source in the IRPF (certidão, contatos essenciais, observações). A full regeneration would destroy this work. The merge logic uses `existing ?? fresh` for fields that can be sourced from both.

---

## 6 — Supabase region

`sa-east-1` (São Paulo). Do not change — client data residency.

---

## 7 — XP institution regex: `\bXP\b`

**Decision:** The XP institution pattern is `\bXP\b` (simple word boundary), not a complex lookahead.

**Why:** XP appears in IRPF discriminações as "XP INVESTIMENTOS", "XP CORRETORA", "XP CCTVM", "XP - SALDO", and standalone "XP". A complex lookahead (`XP(?=\s*[-–—])`) missed "XP CORRETORA" and caused production misclassification. In an IRPF bens e direitos context, false positives for "XP" are essentially impossible.
