# AgentHire Implementation Checklist

Legend: ✅ done and tested · 🟡 done, needs follow-up · ⬜ not started

_Last updated: 2026-11-19, end of Phase 2._

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
- 🟡 The apply link points at the public job page, which is built in Phase 3; until then it opens the app's not-found screen
- 🟡 Screens are still verified by tests and builds only, not yet viewed on a device or in a browser

## Phase 3: Public candidate applications and PDF uploads ⬜
## Phase 4: Resume parsing, embeddings, RAG, matching ⬜
## Phase 5: LangGraph orchestration and shortlisting ⬜
## Phase 6: Human approval, workflow monitoring, resumability ⬜
## Phase 7: Interview generation and email ⬜
## Phase 8: Analytics, notifications, UI refinement ⬜
## Phase 9: Security, testing, optimisation, deployment ⬜
