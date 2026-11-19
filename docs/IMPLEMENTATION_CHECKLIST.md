# AgentHire Implementation Checklist

Legend: ✅ done and tested · 🟡 done, needs follow-up · ⬜ not started

_Last updated: 2026-11-19, end of Phase 1._

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

## Phase 2: Recruiter dashboard and job management ⬜
- ⬜ Job model, Zod validators, CRUD with ownership, pagination
- ⬜ Public `GET /jobs` / `GET /jobs/:id`, `scope=mine`
- ⬜ Jobs list / create / edit / detail screens, skill chips, copy/share public apply link
- ⬜ Dashboard overview counts from real data

## Phase 3: Public candidate applications and PDF uploads ⬜
## Phase 4: Resume parsing, embeddings, RAG, matching ⬜
## Phase 5: LangGraph orchestration and shortlisting ⬜
## Phase 6: Human approval, workflow monitoring, resumability ⬜
## Phase 7: Interview generation and email ⬜
## Phase 8: Analytics, notifications, UI refinement ⬜
## Phase 9: Security, testing, optimisation, deployment ⬜
