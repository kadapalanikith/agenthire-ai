# AgentHire — Approved Architecture

Status: **Approved** (Phase 0 sign-off, 2026-11-19).
Contract sources: `AGENTHIRE_SPEC.md` (original spec + React Native addendum). Where the addendum
conflicts with the original web spec, the addendum wins. Reconstructed sections of the original
spec are documented separately in [`SPEC_RECONSTRUCTION.md`](./SPEC_RECONSTRUCTION.md).

---

## 1. Approved decisions

| ID | Decision |
|---|---|
| D1 | Mobile app: React Native + Expo (SDK 58), Expo Router, NativeWind, Zustand, TanStack Query, React Hook Form + Zod, lucide-react-native, Expo SecureStore, Expo Document Picker, Expo Notifications. **JavaScript only.** |
| D2 | Backend preserved: Node.js 20+, Express 5, MongoDB/Mongoose, Zod, JWT, bcryptjs, multer, helmet, rate limiting. |
| D3 | AI preserved: LangGraph (JS) + LangChain, seven agents, BAAI/bge-small-en-v1.5 embeddings, Qdrant, Groq primary / OpenRouter fallback, Resend. |
| D4 | The Expo app lives in `client/`, the API in `server/`, business rules in root `specs/`. No `frontend/`, `backend/`, NestJS, Prisma or TypeScript. |
| D5 | Candidate flow is reachable in any browser through the Expo **web export** of the same `client/` codebase. Deep links use the `agenthire://` scheme when the app is installed. |
| D6 | **AI never makes final decisions.** Every workflow pauses at `human_approval` regardless of the AI recommendation (shortlisted / hold / rejected). No candidate email is sent before a recruiter decision. Overriding the AI recommendation requires a recorded reason. |
| D7 | `shortlisting-rules.json` is the **only** source of decision bands. A role's `minimum_score` can only make the shortlist threshold stricter (see §5). |
| D8 | `skipped` is a valid node state and `workflow_logs.status`. When a recruiter rejects, `interview_agent` is recorded as `skipped` and never executed. |
| D9 | Mobile binaries are built with **Expo EAS cloud builds**. Android Studio is **not** a development prerequisite. The web export is buildable and testable locally. |
| D10 | Local infrastructure via **Docker Compose** (MongoDB + Qdrant). All connection settings come from env vars so MongoDB Atlas and Qdrant Cloud work without code changes. |
| D11 | Realtime workflow updates use adaptive TanStack Query polling (fast while `running`, stopped on `waiting_approval`/terminal states) plus push notifications. |
| D12 | Deterministic fallbacks (used when an external AI service is unavailable) are real rule-based logic, tagged `source: "deterministic_fallback"` in output and logs. Success is never simulated. |
| D13 | Match score is computed deterministically from weights in `specs/prompts/matching-agent.json`; the LLM contributes skill normalisation, evidence and explanation (with RAG context). Scores are reproducible. |
| D14 | Fairness: the parser strips protected characteristics and proxies; name/email/phone are never passed to matching or shortlisting prompts (`specs/evaluation/fairness-policy.json`). |
| D15 | (Phase 4) LLM failure behaviour is set per prompt spec by `llm_failure_policy`: `fail` (the default: errors are classified by the retry policy and retried by the workflow) or `deterministic_fallback`. When no provider is configured, the agents use their rule-based path, tagged `deterministic_fallback`. |
| D16 | (Phase 4) The LLM may only *add* a skill match when it quotes evidence that appears verbatim in the resume; unverifiable claims are recorded in `rejected_llm_claims` and ignored. The score is always computed in code. |
| D17 | (Phase 4) Contact details (email, phone, URLs) are redacted before resume text reaches any LLM (`redact_before_llm`). Education is sent to the matching prompt without institution or year (age and prestige proxies). |
| D19 | (Phase 4, user-approved) Split retrieval thresholds in `rag-retrieval.json`: knowledge documents use `minimum_similarity` **0.65** (the original value was 0.75); the candidate's own resume chunks use `resume_minimum_similarity` **0** (top_k only, already limited to that candidate). Reason: measured bge-small-en-v1.5 scores of 0.62–0.66 for relevant evidence meant that 0.75 hid the resume and the fair-hiring policy from the LLM. |
| D18 | (Phase 4) Node.js ≥ 22.12 is required (native `require()` of ES modules, used for `unpdf`). Embeddings run locally with Transformers.js; the model (~34 MB) is downloaded once from Hugging Face into `server/.cache/` (gitignored). No candidate data is sent there. |

---

## 2. System overview

```
┌──────────── client/ (Expo, one codebase) ────────────┐
│ iOS / Android app             Web export (public)     │
│ recruiter + candidate         candidate apply/status  │
└───────────────┬──────────────────────────────────────┘
                │ REST + JSON (JWT Bearer), multipart PDF
┌───────────────▼──────────── server/ (Express) ───────┐
│ helmet · CORS · rate-limit · sanitize · Zod · multer │
│ routes → controllers (thin) → services               │
│   workflow runner ──► LangGraph StateGraph (7 nodes) │
│                       MongoDBSaver checkpointer      │
│   agents/ ─► LLM (Groq → OpenRouter)                 │
│           ─► rag (bge-small-en-v1.5 → Qdrant)        │
│           ─► emails (Resend / recorded fallback)     │
│   utils/specLoader ◄── /specs/*.json (Zod-validated) │
└──────┬──────────────┬─────────────┬─────────────────┘
   MongoDB         Qdrant      Expo Push Service
```

All business logic and all AI processing run on the server. The client only renders server state.

---

## 3. Agent communication and LangGraph persistence

Agents never call each other. They communicate only through the shared, serialisable LangGraph state:

| Channel | Written by |
|---|---|
| `workflow_id, candidate_id, job_id, resume_path, job_requirements` | runner (initial input) |
| `resume_text, parsed_resume, parse_source` | resume_parser |
| `embedding_refs` | embedding_agent |
| `rag_context, match_result` | matching_agent |
| `recommendation {decision, rule, thresholds_snapshot, spec_versions}` | shortlisting_agent |
| `approval {decision, reason, decided_by, decided_at, overridden}` | human_approval (via resume) |
| `interview_kit` | interview_agent |
| `email_result` | email_agent |

Graph (order loaded from `specs/workflow/default-hiring-workflow.json`, validated to contain exactly the seven known nodes):

```
START → resume_parser → embedding_agent → matching_agent → shortlisting_agent → human_approval
human_approval ──approve──► interview_agent → email_agent (invite)   → END
human_approval ──reject───► [interview_agent = skipped] → email_agent (rejection) → END
```

- **Node lifecycle wrapper** writes `workflow_logs` (running → success/failed/waiting_approval/skipped),
  updates `workflows.current_state` / `node_states`, measures duration, and on failure writes the
  structured failure log (agent name, workflow state, stack trace, timestamp) to Mongo and `server/logs/`.
- **Two persistence layers**: LangGraph checkpoints (`MongoDBSaver`, `thread_id = workflow_id`) are the
  resume source of truth; `workflows` + `workflow_logs` are the UI/analytics projection.
- **Retries**: per-node LangGraph `retryPolicy` built from `specs/system/retry-policy.json`; only
  `RetryableError` (LLM/email/vector-DB timeouts) is retried. Invalid PDF / malformed JSON / invalid schema
  throw `NonRetryableError`. Manual `POST /workflow/retry` re-invokes the thread with `null` input, which
  resumes from the last checkpoint and re-runs only the failed node.
- **Human approval**: `human_approval` calls `interrupt()`; checkpoint saved; workflow → `waiting_approval`.
  Pre-interrupt side effects are idempotent because LangGraph re-executes the node on resume.
  `POST /workflow/approve` performs an atomic `waiting_approval → running` transition, then
  `graph.invoke(new Command({ resume }), { configurable: { thread_id } })`.
- **Idempotency**: deterministic Qdrant point ids (UUIDv5); email agent checks stored `provider_id` and
  sends a Resend idempotency key.
- **Runner**: in-process queue with configurable concurrency; on boot, workflows stuck in `running` are
  resumed from checkpoint. Horizontal scaling upgrade path: BullMQ + Redis.

---

## 4. Folder structure

```
/
├── AGENTHIRE_SPEC.md
├── docker-compose.yml           MongoDB + Qdrant (local dev)
├── demo-data/resumes/
├── docs/                        ARCHITECTURE, SPEC_RECONSTRUCTION, IMPLEMENTATION_CHECKLIST, API
├── specs/
│   ├── hiring/                  role hiring specs (frontend-developer.json)
│   ├── workflow/                default-hiring-workflow.json, node-states.json
│   ├── system/                  retry-policy.json, upload-policy.json, auth-policy.json
│   ├── prompts/                 resume-parser.json, matching-agent.json, interview-agent.json
│   ├── evaluation/              shortlisting-rules.json, rag-retrieval.json, fairness-policy.json
│   ├── email/                   interview-invite.json, rejection.json, password-reset.json
│   └── knowledge/               RAG source docs (Phase 4)
├── server/
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/  routes/  controllers/  services/  validators/  middleware/  models/
│   │   ├── agents/  workflows/  rag/  analytics/  emails/  utils/  constants/
│   ├── scripts/  tests/{unit,integration}/  uploads/  logs/
└── client/
    ├── app/                     Expo Router (URLs mirror the original spec)
    │   ├── (auth)/              login, signup, forgot-password, reset-password
    │   ├── (recruiter)/dashboard/  recruiter area (auth-guarded)
    │   ├── jobs/[jobId]/        public job detail + apply
    │   └── applications/[statusToken]  public status
    └── src/ api/ components/ features/ stores/ lib/ theme/
```

---

## 5. Scoring and shortlisting configuration (D7)

1. `specs/evaluation/shortlisting-rules.json` defines ordered **bands** (`shortlisted ≥ 80`, `hold ≥ 60`,
   otherwise `rejected`). It is the only place thresholds are defined.
2. A role's `minimum_score` lives only in the role's hiring spec (`specs/hiring/<id>.json`, referenced by
   `job.hiring_spec_id`). Jobs do not store their own threshold, so there is no duplicate rule.
3. The interaction is configured in `shortlisting-rules.json` under `role_minimum_score_policy`,
   currently `"stricter_only"`:
   `effective_shortlist_min = max(bands.shortlisted.min_score, role.minimum_score)`.
   A role minimum can **raise** the shortlist bar but never lower it and never changes the `hold` or
   `rejected` bands. With the current files (`75` vs `80`) the effective threshold stays `80`.
4. Every recommendation stores a trace: band thresholds, role minimum, effective threshold, applied rule,
   score breakdown and spec versions.
5. The result is a **recommendation** only; the recruiter decides at `human_approval`.

---

## 6. Database models

| Collection | Fields (➕ = addition to the original spec) |
|---|---|
| users | name, email (unique), password (bcrypt, hidden), role (`recruiter`\|`admin`), ➕push_tokens, created_at |
| jobs | title, description, required_skills, preferred_skills, min_experience, workflow_spec_id, ➕hiring_spec_id, ➕created_by, ➕status (`open`\|`closed`), created_at, ➕updated_at |
| candidates | name, email, phone, resume_url (internal key), parsed_resume_json, match_score, status (`applied`\|`processing`\|`awaiting_review`\|`approved`\|`rejected`\|`failed`), ➕job_id, ➕workflow_id, ➕ai_recommendation, ➕status_token_hash, created_at |
| workflows | candidate_id, job_id, current_state, status (`pending`\|`running`\|`waiting_approval`\|`completed`\|`failed`), ➕thread_id, ➕node_states, ➕execution_order, ➕state_output, ➕retry_count, ➕approval, ➕spec_versions, ➕last_error, created_at, ➕updated_at |
| workflow_logs | workflow_id, agent_name, input (redacted), output, status (`running`\|`success`\|`failed`\|`waiting_approval`\|➕`skipped`), error, ➕attempt, ➕duration_ms, created_at |
| ➕notifications | user_id, type, title, body, data, read_at, created_at |
| ➕password_reset_tokens | user_id, token_hash, expires_at (TTL), used_at |
| LangGraph | checkpoints, checkpoint_writes (managed by MongoDBSaver) |

Qdrant: `resumes` and `knowledge` collections, 384-dim cosine; chunk sizes and retrieval settings from
`specs/evaluation/rag-retrieval.json`.

---

## 7. API contracts

Envelope: `{ success, data, meta?, error?: { code, message, details? } }`. No `/api` prefix (paths as in
the original spec). Pagination: `?page=&limit=` (server-capped).

| Method & path | Auth | Phase |
|---|---|---|
| GET /health | public | 1 |
| POST /auth/signup, POST /auth/login | public, rate-limited | 1 |
| GET /auth/me | JWT | 1 |
| POST /auth/forgot-password, POST /auth/reset-password | public, rate-limited | 1 |
| GET /meta/workflow-spec | public | 1 |
| POST /jobs, PUT /jobs/:id | recruiter (owner for PUT) | 2 |
| GET /jobs (public open jobs; `scope=mine` with JWT), GET /jobs/:id | public | 2 |
| GET /dashboard/summary ➕, GET /meta/hiring-specs ➕ | recruiter | 2 |
| POST /candidates/upload | public, strict rate limit | 3 |
| GET /candidates/status/:statusToken | public (stage only, never score) | 3 |
| GET /candidates, GET /candidates/:id, GET /candidates/:id/resume | recruiter, owner-scoped | 3 |
| GET /candidates/:id/resume-link ➕ (short-lived signed PDF link) | recruiter | 3 |
| GET /meta/upload-policy ➕ | public | 3 |
| POST /workflow/start, POST /workflow/retry | recruiter | 5–6 |
| POST /workflow/approve | recruiter (reason required on override; 409 if not waiting) | 6 |
| GET /workflow, GET /workflow/:id | recruiter, owner-scoped | 6 |
| GET /analytics | recruiter | 8 |
| GET /notifications, PATCH /notifications/:id/read, POST /notifications/push-token | recruiter | 8 |

Full request/response details are maintained in `docs/API.md` as endpoints are implemented.

---

## 8. Environment variables

Server (`server/.env`, validated with Zod at startup, never logged): `PORT, NODE_ENV, MONGODB_URI,
JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGINS, PUBLIC_WEB_URL, GROQ_API_KEY, GROQ_MODEL, OPENROUTER_API_KEY,
OPENROUTER_MODEL, LLM_TIMEOUT_MS, QDRANT_URL, QDRANT_API_KEY, EMBEDDING_MODEL, RESEND_API_KEY, EMAIL_FROM,
EXPO_ACCESS_TOKEN, WORKFLOW_CONCURRENCY, LOG_LEVEL`.

Client: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL` only. `EXPO_PUBLIC_*` values are bundled into the app
and must never contain secrets.

---

## 9. Technical risks

| Risk | Mitigation |
|---|---|
| No local Android/iOS toolchain | EAS cloud builds (D9); web export + Jest locally |
| onnxruntime-node on Node 24/Windows | Validate in Phase 4; cache model; fallback: HF Inference API with the same model |
| Free-tier LLM limits / JSON quality | Concurrency cap, provider fallback, Zod-validated structured output |
| Scanned PDFs without text | Non-retryable failure with clear message (OCR out of scope) |
| Restart mid-workflow | Checkpoints + boot recovery |
| `interrupt()` re-executes node | Idempotent pre-interrupt side effects |
| Recruiter token on web | SecureStore on native; sessionStorage on web |
| bge similarity vs 0.75 threshold | Validate with demo data in Phase 4; value stays in spec |

---

## 10. Roadmap

| Phase | Scope |
|---|---|
| 1 | Foundation + authentication (repo, Docker Compose, Express core, security middleware, specs + loader, auth incl. password reset, Expo app foundation, design system, auth screens, guarded recruiter shell) |
| 2 | Recruiter dashboard + job management |
| 3 | Public candidate applications + PDF uploads |
| 4 | Resume parsing, embeddings, RAG, matching |
| 5 | LangGraph orchestration + shortlisting |
| 6 | Human approval, workflow monitoring, resumability |
| 7 | Interview generation + email |
| 8 | Analytics, notifications, UI refinement |
| 9 | Security, testing, optimisation, deployment |

Every phase ends with tests, build checks, a list of changed files and an updated
[`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md).
