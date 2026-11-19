# AgentHire API Reference

Base URL: `EXPO_PUBLIC_API_URL` (local default `http://localhost:4000`). There is no `/api` prefix, as in the original spec.

## Conventions

**Success envelope**
```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 42 } }
```
`meta` is only present on paginated endpoints.

**Error envelope**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
  "details": [{ "path": "email", "message": "Enter a valid email address", "location": "body" }] } }
```

| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Zod validation failed (`details` lists fields) |
| INVALID_JSON | 400 | Body is not valid JSON |
| INVALID_RESET_TOKEN | 400 | Reset token unknown, used or expired |
| UNAUTHORIZED | 401 | Missing/invalid token or account removed |
| TOKEN_EXPIRED | 401 | Token expired or issued before a password reset |
| INVALID_CREDENTIALS | 401 | Wrong email or password (same response for both) |
| FORBIDDEN | 403 | Role not permitted |
| NOT_FOUND | 404 | Unknown route or resource |
| EMAIL_IN_USE | 409 | Signup email already registered |
| PAYLOAD_TOO_LARGE | 413 | JSON body over 100 KB |
| RATE_LIMITED | 429 | Rate limit from `specs/system/auth-policy.json` exceeded |
| INTERNAL_ERROR | 500 | Unexpected error (`details.request_id` for support) |

**Auth**: `Authorization: Bearer <jwt>`. Tokens are HS256, issuer `agenthire`, audience `agenthire-app`,
lifetime `JWT_EXPIRES_IN`. Every protected request reloads the user from MongoDB.

**Security headers**: helmet defaults; every response carries `X-Request-Id`.

---

## Phase 1 endpoints (implemented)

### GET /health — public
Dependency status. Returns 503 when MongoDB is down.
```json
{ "status": "ok | degraded | down",
  "services": { "mongo": "up | down", "qdrant": "up | down" },
  "configured": { "llm_primary": false, "llm_fallback": false, "email": false },
  "timestamp": "2026-11-19T04:51:54.829Z" }
```

### GET /meta/workflow-spec — public
Workflow order, checkpoint nodes, branches and node-state display config from
`specs/workflow/default-hiring-workflow.json` and `specs/workflow/node-states.json`.
```json
{ "id": "default-hiring-workflow", "version": "1.0.0",
  "workflow": ["resume_parser", "embedding_agent", "matching_agent", "shortlisting_agent", "human_approval", "interview_agent", "email_agent"],
  "checkpoint_nodes": ["human_approval"],
  "branches": { "human_approval": { "approve": { "next": "interview_agent", "email_template": "interview-invite" },
                                    "reject": { "next": "email_agent", "skip": ["interview_agent"], "email_template": "rejection" } } },
  "node_states": { "running": { "label": "Running", "light": { "fg": "#1D4ED8", "bg": "#E8EFFE", "border": "#93B4F8" }, "dark": { } } },
  "node_states_version": "1.0.0" }
```

### GET /meta/auth-policy — public
```json
{ "version": "1.0.0", "password": { "min_length": 8, "max_length": 128, "require_letter": true, "require_number": true } }
```

### POST /auth/signup — public, rate-limited (`auth`)
Body (strict; unknown keys such as `role` are rejected):
```json
{ "name": "Riley Morgan", "email": "riley@example.com", "password": "Str0ngPassword" }
```
`201` → `{ "user": { "id", "name", "email", "role": "recruiter", "created_at", "updated_at" }, "token": "<jwt>" }`
Errors: `400 VALIDATION_ERROR`, `409 EMAIL_IN_USE`, `429 RATE_LIMITED`.

### POST /auth/login — public, rate-limited (`auth`)
Body: `{ "email", "password" }` → `200 { user, token }`. Errors: `400`, `401 INVALID_CREDENTIALS`, `429`.

### GET /auth/me — recruiter or admin
`200 { "user": { ... } }`. Errors: `401 UNAUTHORIZED | TOKEN_EXPIRED`, `403 FORBIDDEN`.

### POST /auth/forgot-password — public, rate-limited (`password_reset`)
Body: `{ "email" }` → always `202 { "message": "If an account exists for this email, a password reset link has been sent." }`.
When the account exists a single-use token (TTL from `auth-policy.password_reset.token_ttl_minutes`) is
created, only its SHA-256 hash is stored, and the link `PUBLIC_WEB_URL/reset-password?token=…` is emailed
with the `specs/email/password-reset.json` template. Without `RESEND_API_KEY` the email is not sent; in
`NODE_ENV=development` only, it is written to `server/logs/email-outbox.jsonl` (gitignored).

### POST /auth/reset-password — public, rate-limited (`password_reset`)
Body: `{ "token": "<64 hex chars>", "password": "N3wPassword" }` → `200 { message }`.
The token is consumed atomically; all JWTs issued before the reset are rejected (`TOKEN_EXPIRED`).
Errors: `400 VALIDATION_ERROR | INVALID_RESET_TOKEN`, `429`.

---

## Planned endpoints

Contracts are defined in [`ARCHITECTURE.md`](./ARCHITECTURE.md) §7 and will be documented here as each
phase implements them: jobs (Phase 2), candidates and uploads (Phase 3), workflows (Phases 5–6),
analytics and notifications (Phase 8).
