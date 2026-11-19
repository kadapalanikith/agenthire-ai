# AgentHire Implementation Checklist

Legend: ✅ done and tested · 🟡 done, needs follow-up · ⬜ not started

_Last updated: 2026-11-19, end of Phase 4._

## Phase 0: Repository and specification analysis ✅
- ✅ Spec read, conflicts identified, architecture approved (`docs/ARCHITECTURE.md`)
- ✅ Truncated spec sections reconstructed with provenance (`docs/SPEC_RECONSTRUCTION.md`)

## Phase 1: Foundation and authentication ✅
**Repository and infrastructure**
- ✅ Git repository, root `.gitignore` (secrets, uploads, logs, native folders excluded)
- ✅ `docker-compose.yml` for MongoDB 8.0 and Qdrant v1.15.4 (bound to 127.0.0.1)
- 🟡 Docker Compose stack not started in this environment (Docker Desktop was not running); the server was smoke-tested against a temporary MongoDB instead

**Specs (business-rule contract)**
- ✅ 15 spec files: hiring, workflow, node-states (incl. `skipped`), retry, upload, auth, shortlisting (incl. `role_minimum_score_policy: stricter_only`), RAG, fairness, 3 prompts, 3 email templates
- ✅ Zod-validated spec loader with cross-file checks, frozen registry, `npm run check:specs`
- ✅ Startup fails fast on invalid specs

**Server**
- ✅ Zod-validated environment config (errors name variables, never values)
- ✅ MongoDB connection with `sanitizeFilter` + `strictQuery`
- ✅ Express 5 app: helmet, CORS allow-list, request ids, pino logging with redaction
- ✅ Rate limiting from spec (general / auth / password reset)
- ✅ Input sanitisation (operator keys, dotted keys, prototype pollution, NUL bytes) for body, params and query
- ✅ Standard success/error envelopes, central error handler, 404 handler
- ✅ User and PasswordResetToken models (TTL index, hashed tokens)
- ✅ Signup, login, `/auth/me`, JWT verification with issuer/audience/algorithm pinning, user reload per request
- ✅ Role guard (`recruiter`, `admin`)
- ✅ Forgot/reset password: single-use hashed tokens, no account enumeration, session revocation
- ✅ Email layer (Resend, spec templates, idempotency key, `not_configured` result, dev-only outbox)
- ✅ `GET /health`, `GET /meta/workflow-spec`, `GET /meta/auth-policy`

**Mobile / web client**
- ✅ Expo SDK 58 (React Native 0.88, JavaScript only) with Expo Router, NativeWind 4, Zustand, TanStack Query, RHF + Zod, lucide
- ✅ Design tokens (light/dark) → CSS variables → Tailwind classes; System/Light/Dark preference persisted
- ✅ UI kit: Text, Button, TextField, FormTextField, Card, Badge, Skeleton, EmptyState, ErrorState, InlineAlert, Screen, Logo
- ✅ Centralised API client (envelope unwrapping, typed ApiError, timeouts, network errors, 401 → sign-out, no fabricated responses)
- ✅ Token storage: SecureStore on native, sessionStorage on web
- ✅ Session restore via `/auth/me`, with a verified-session gate (splash) and an error state with retry
- ✅ Screens: splash, login, signup, forgot password, reset password (public deep link), dashboard overview (live system status), settings (profile, theme, sign out)
- ✅ Route protection with `Stack.Protected` (recruiter vs auth groups)
- ✅ `eas.json` build profiles (development / preview / production)
- 🟡 Screens verified by tests and bundle exports only; not yet viewed on a physical device or in a browser
- 🟡 EAS cloud build not run (needs an Expo account login)

**Tests and checks (Phase 1)**
- ✅ Server Jest + Supertest: 58/58 passing (spec loader, env, sanitiser, email, auth flows, security, health)
- ✅ Client Jest (jest-expo + RNTL): 26/26 passing (API client, schemas, auth store, login screen)
- ✅ `npx expo export --platform web` succeeds
- ✅ `npx expo export --platform android` succeeds (Hermes bundle)
- ✅ `npx expo-doctor`: 20/20 checks
- ✅ Live smoke test of `server.js` (signup → me → wrong login → forgot → reset → reuse rejected → old session revoked → new login)

## Phase 2: Recruiter dashboard and job management ✅
**Server**
- ✅ Job model (`title, description, required_skills, preferred_skills, min_experience, workflow_spec_id, hiring_spec_id, created_by, status, created_at, updated_at`) with indexes
- ✅ Zod validators: strict bodies, skill normalisation and dedupe, required/preferred overlap check, half-year experience steps, markup-character rejection
- ✅ Spec references validated against the registry (`hiring_spec_id` in `specs/hiring/`, `workflow_spec_id` = default workflow)
- ✅ `POST /jobs`, `GET /jobs` (public open jobs / `scope=mine`, status filter, literal title search, pagination), `GET /jobs/:id` (public vs owner view), `PUT /jobs/:id` (owner or admin, close/reopen)
- ✅ `optionalAuthenticate`: public routes accept a token; an invalid token is rejected, not ignored
- ✅ Share links built server-side from `PUBLIC_WEB_URL` (`public_url`, `apply_url`)
- ✅ `GET /dashboard/summary` (per-recruiter job counts + 5 recent jobs)
- ✅ `GET /meta/hiring-specs` (base role templates for the form)

**Client**
- ✅ Jobs tab with its own stack: list, create, detail, edit
- ✅ Jobs list: debounced search, All/Open/Closed filter, infinite scroll, pull to refresh, skeletons, empty, no-results and error states
- ✅ Job card with status badge, skill chips (+N overflow) and "Copy apply link"
- ✅ Create/edit form: base-role picker that prefills skills only when none are entered, skill chip input (Add, Enter or comma), skill counts, multiline description, half-year experience, status control on edit, server field errors mapped onto inputs
- ✅ Job detail: share card (copy + native share, web falls back to copy), skills, description, configuration (hiring spec version, workflow), close/reopen with inline confirmation, read-only notice for other recruiters' jobs
- ✅ Dashboard overview: real job counts, recent jobs, quick actions (Create job, Refresh), system status
- ✅ Shared UI added: Chip/ChipList, SegmentedControl, ScreenHeader, multiline TextField

**Tests and checks (Phase 2)**
- ✅ Server: 86/86 (28 new: create, validation, normalisation, spec refs, public/owner views, pagination, search, injection, ownership, admin, summary, hiring specs)
- ✅ Client: 42/42 (16 new: skill helpers, form schema, jobs list, copy link, filters, offline error, create flow with spec prefill, client and server validation)
- ✅ Web export, Android export, expo-doctor 20/20
- ✅ Live smoke test: hiring specs → create → public list → anonymous detail → cross-recruiter edit 403 → close → removed from public list → per-recruiter summary
- ✅ The apply link now resolves to the public job page (Phase 3)
- 🟡 Screens are still verified by tests and builds only, not yet viewed on a device or in a browser

## Phase 3: Public candidate applications and PDF uploads ✅
**Server**
- ✅ `specs/system/upload-policy.json` v1.1.0: size, types, upload/status rate limits, resume link TTL
- ✅ Candidate model (spec fields plus `job_id`, `workflow_id`, `resume_file`, `ai_recommendation`, `status_token_hash`); unique index per job and email
- ✅ Workflow model (status, current_state, execution_order, node_states, state_output, retry_count, approval, spec_versions, last_error, thread_id)
- ✅ `POST /candidates/upload`: public multipart, in-memory multer bounded by the spec, MIME and extension filter, `%PDF-` signature and `%%EOF` trailer check, strict field validation, open-job check, duplicate check, random file names under `UPLOAD_DIR`, cleanup of partial state on any failure
- ✅ Pending workflow created per application from the workflow spec, with a spec version snapshot
- ✅ `GET /candidates/status/:token`: hashed status tokens; stage only, never scores or contact details
- ✅ `GET /candidates` / `GET /candidates/:id`: owner-scoped (admin: all), job, status and search filters, pagination
- ✅ Resume access: owner stream, plus short-lived signed links bound to one candidate (login JWTs rejected)
- ✅ Dashboard summary: candidate and workflow counts, completion rate; job detail candidate count
- ✅ `GET /meta/upload-policy`

**Client**
- ✅ Public routes outside the recruiter guard: `/jobs/[jobId]`, `/jobs/[jobId]/apply`, `/applications/[statusToken]`; they work in any browser via the web export
- ✅ Public job page (open/closed states), apply form (name, email, phone, Document Picker, file name and size, replace/remove), client checks against the server upload policy, processing state, server file/duplicate/closed errors shown in place, AI-assistance notice
- ✅ Multipart upload on web (`File`) and native (`{ uri, name, type }`); no recruiter token sent from public pages
- ✅ Confirmation and status page: three-step progress from the real API stage, polling until a decision, copy status link
- ✅ Recruiter Candidates tab: search, status chips, job filter from job detail, infinite scroll, "Not scored yet" until the matching agent runs
- ✅ Candidate detail: contact, job link, resume (in-app browser on native; new tab on web), honest "queued" screening state
- ✅ Job detail: candidate count, View candidates, Public page; dashboard: open jobs, candidates, workflows, completion and a needs-review banner

**Tests and checks (Phase 3)**
- ✅ Server: 110/110 (24 new: upload happy path, disguised and truncated PDFs, type, size, missing file, field validation, operator injection, unknown/closed job, duplicates, multipart requirement, rate limit, status privacy and stage mapping, scoping, admin, resume streaming, signed links, dashboard counts, upload policy)
- ✅ Client: 63/63 (21 new: file and form validation, multipart body, public job, apply flow, client and server errors, status page, candidates list and filters, candidate detail, resume link)
- ✅ Web export, Android export, expo-doctor 20/20
- ✅ Live smoke test with browser-style `FormData` + `Blob` upload: 201 with CORS, fake PDF 400, duplicate 409, public status, recruiter list, signed-link download byte-identical, unauthenticated resume 401, dashboard counts, closed job 409, exactly one stored file
- 🟡 Workflows stay `pending` until LangGraph execution is wired up in Phase 5 (shown honestly as "Queued")
- 🟡 Universal/App Links (https links opening the native app) need a hosted domain plus `apple-app-site-association` / `assetlinks.json` (Phase 9). Today https links open the web page and `agenthire://` links open the app
- 🟡 Scanned or image-only PDFs pass the structural check; text extraction and its errors come with the resume parser (Phase 4)
## Phase 4: Resume parsing, embeddings, RAG, matching ✅
**Specs**
- ✅ `retry-policy` v1.1.0: adds `LLM_PROVIDER_ERROR` (retryable) and `LLM_CONFIG_ERROR`, `NO_EXTRACTABLE_TEXT` (non-retryable)
- ✅ `resume-parser` v1.1.0: `min_text_chars`, `llm_failure_policy`, `redact_before_llm`, `skill_aliases`
- ✅ `matching-agent` v1.1.0: `llm_failure_policy`, evidence rules, RAG query templates
- ✅ `rag-retrieval` v1.1.0: bge query instruction, `knowledge_sources`; cross-checks between specs
- ✅ Knowledge documents: fair hiring policy, frontend evaluation guide, structured interview guidelines

**Server**
- ✅ Spec-driven error classes (`AgentError`, `classifyError`)
- ✅ Real PDF text extraction (pdf.js via `unpdf`); `INVALID_PDF` / `NO_EXTRACTABLE_TEXT`
- ✅ LLM client: Groq (LangChain `ChatGroq`) → OpenRouter (LangChain `ChatOpenAI`) fallback, JSON mode, timeouts, Zod-validated output, error codes from the retry policy
- ✅ Embeddings: BAAI/bge-small-en-v1.5 via Transformers.js (q8 ONNX, CLS pooling, normalised, query instruction), 384-dim check against the spec
- ✅ Vector stores: Qdrant (collections, payload indexes, Query API, filters, error mapping) and an in-memory equivalent for tests
- ✅ Chunker (500 / 1000 from the spec), deterministic UUIDv5 point ids, retriever (top_k 5, minimum_similarity 0.75 from the spec)
- ✅ Knowledge ingestion (`npm run ingest:knowledge`), per-document replacement
- ✅ Resume Parser Agent: extraction, contact redaction before the LLM, skill canonicalisation (known + job skills + aliases), protected-attribute stripping, deterministic fallback
- ✅ Embedding Agent: idempotent per-candidate re-indexing
- ✅ Matching Agent: job-specific requirements merged with the hiring spec, deterministic weighted score with breakdown, evidence quotes, LLM matches only with verified verbatim quotes, RAG context (knowledge + resume chunks) with traceable sources, no name/contact/graduation year in the prompt
- ✅ Demo resume `demo-data/resumes/john-react-resume.pdf` (`npm run demo:resume`) and `npm run agents:dry-run`

**Tests and checks (Phase 4)**
- ✅ Server: 150/150 (40 new: chunking, point ids, vector stores, skills, redaction, error classification, PDF extraction on real files, LLM fallback and error mapping, all three agents, knowledge ingestion)
- ✅ Opt-in real-service test (`RUN_REAL_SERVICES=1`): real bge-small + real Qdrant, 2/2 passed, test data cleaned up
- ✅ Docker Compose stack (MongoDB 8.0 + Qdrant 1.15.4) started and used
- ✅ Live dry run on the demo resume against Qdrant: deterministic parse, 3 chunks embedded, score 100 (60 + 20 + 20), evaluation guide retrieved at 0.864
- 🟡 **LLM path not verified live**: no `GROQ_API_KEY` / `OPENROUTER_API_KEY` in this environment. It is covered by tests with scripted providers only
- 🟡 **`minimum_similarity` 0.75 is high for bge-small** (measured: relevant policy chunk 0.664, relevant resume chunk 0.719, both filtered). Decision pending; the value is unchanged
- 🟡 Parser and matching results are not yet saved to candidates; the LangGraph workflow persists them in Phase 5
- 🟡 Knowledge ingestion replaces chunks per document but does not delete points for documents removed from `specs/knowledge/`
## Phase 5: LangGraph orchestration and shortlisting ⬜
## Phase 6: Human approval, workflow monitoring, resumability ⬜
## Phase 7: Interview generation and email ⬜
## Phase 8: Analytics, notifications, UI refinement ⬜
## Phase 9: Security, testing, optimisation, deployment ⬜
