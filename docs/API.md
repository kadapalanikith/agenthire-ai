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

## Phase 2 endpoints (implemented)

### Job object

Owner view (returned to the creating recruiter or an admin):
```json
{ "id": "6afe83ba1f38ce5ef9532385", "title": "Frontend Developer",
  "description": "Build accessible interfaces for the recruiter console.",
  "required_skills": ["React", "JavaScript", "CSS"], "preferred_skills": ["Next.js"],
  "min_experience": 2, "status": "open | closed",
  "hiring_spec_id": "frontend-developer", "workflow_spec_id": "default-hiring-workflow",
  "hiring_spec": { "id": "frontend-developer", "role": "Frontend Developer", "version": "1.0.0" },
  "created_by": "<user id>", "created_at": "…", "updated_at": "…",
  "public_url": "<PUBLIC_WEB_URL>/jobs/<id>", "apply_url": "<PUBLIC_WEB_URL>/jobs/<id>/apply" }
```
Public view (everyone else): `id, title, description, required_skills, preferred_skills,
min_experience, status, created_at, public_url, apply_url`.

**Field rules**: title 3–120 chars; description 20–5000; `required_skills` 1–30, `preferred_skills` 0–30,
each ≤ 50 chars without `< > { } $`. Skills are trimmed, inner whitespace collapsed and case-insensitive
duplicates removed (first spelling kept). A skill cannot be both required and preferred.
`min_experience` 0–50 in steps of 0.5. `hiring_spec_id` must exist in `specs/hiring/`;
`workflow_spec_id` defaults to, and must equal, the id in `specs/workflow/default-hiring-workflow.json`.
`created_by` and `status` cannot be set on create.

### POST /jobs — recruiter
Body: `title, description, required_skills, preferred_skills?, min_experience, hiring_spec_id, workflow_spec_id?`
→ `201 { job }` (owner view). Errors: `400 VALIDATION_ERROR`, `401`, `403`.

### GET /jobs — public (optional auth)
Query: `scope=public|mine` (default `public`), `status=open|closed` (mine only), `q` (title search,
case-insensitive, literal), `page` (≥1, default 1), `limit` (1–50, default 20).
- `public`: open jobs from all recruiters, public view.
- `mine`: requires a token; the recruiter's jobs of any status, owner view.

→ `200 { jobs: [...] }` with `meta: { page, limit, total, total_pages }`, newest first.
An invalid token is rejected with `401` rather than ignored.

### GET /jobs/:id — public (optional auth)
→ `200 { job, can_manage }`. Owners/admins get the owner view and `can_manage: true`; everyone else
gets the public view. Closed jobs are still readable (status included). Errors: `400` malformed id, `404`.

### PUT /jobs/:id — recruiter (owner or admin)
Partial body with any of the create fields plus `status`. At least one field is required. Overlap is
checked against the merged result (e.g. new preferred vs existing required).
→ `200 { job }`. Errors: `400`, `401`, `403` (not owner), `404`.

### GET /dashboard/summary — recruiter
```json
{ "jobs": { "total": 6, "open": 5, "closed": 1 }, "recent_jobs": [ /* up to 5 owner-view jobs */ ],
  "generated_at": "…" }
```
Computed from the database for the signed-in recruiter only. Candidate and workflow figures are added
in later phases.

### GET /meta/hiring-specs — recruiter
Base role specs from `specs/hiring/` for the job form:
```json
{ "hiring_specs": [ { "id": "frontend-developer", "version": "1.0.0", "role": "Frontend Developer",
  "required_skills": ["React", "JavaScript", "CSS"], "preferred_skills": ["Next.js", "Tailwind CSS"],
  "minimum_score": 75, "interview_rounds": 2 } ] }
```

---

## Phase 3 endpoints (implemented)

Additional error codes: `INVALID_FILE_TYPE` (400), `INVALID_PDF` (400, non-retryable),
`FILE_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `JOB_CLOSED` (409), `ALREADY_APPLIED` (409),
`RESUME_UNAVAILABLE` (404).

### POST /candidates/upload — public, rate-limited (`upload-policy.rate_limits.application_upload`)
`multipart/form-data` fields: `job_id`, `name` (2–100), `email`, `phone` (7–15 digits; `+ - ( ) .` and
spaces allowed), and one file `resume`.

Validation order: content type → file type by MIME **and** extension → size (≤ `max_size_bytes`) →
text fields (strict) → job exists (404) and is open (409 `JOB_CLOSED`) → file bytes start with `%PDF-`
and contain `%%EOF` near the end (400 `INVALID_PDF`) → one application per email per job (409
`ALREADY_APPLIED`). Files are held in memory until they pass validation, then saved under `UPLOAD_DIR`
(default `server/uploads`) with a random name. If any later step fails, the file and records are removed.

`201`:
```json
{ "candidate_id": "…", "status_token": "<64 hex chars, returned once>", "status": "applied", "stage": "received",
  "job": { "id": "…", "title": "Frontend Developer" },
  "workflow": { "id": "…", "status": "pending", "current_state": null, "retry_count": 0, "updated_at": "…" } }
```
The workflow record is created with the execution order and an all-`pending` node state map from
`specs/workflow/default-hiring-workflow.json`, plus a snapshot of every spec version. Automatic
execution is added in Phase 5.

### GET /candidates/status/:statusToken — public, rate-limited (`application_status`)
```json
{ "applicant_name": "Jane", "job": { "id": "…", "title": "Frontend Developer" },
  "stage": "received | in_review | decision_made", "submitted_at": "…", "updated_at": "…" }
```
Never returns scores, recommendations, contact details or resume data. Stage mapping:
`applied → received`; `processing, awaiting_review, failed → in_review`; `approved, rejected → decision_made`.

### GET /candidates — recruiter
Query: `job_id?`, `status?` (`applied | processing | awaiting_review | approved | rejected | failed`),
`q?` (name or email, literal), `page`, `limit`. Only candidates for the recruiter's jobs (admins: all);
a `job_id` the recruiter doesn't own → 404. → `{ candidates: [...] }` with pagination `meta`.

Candidate object: `id, job_id, workflow_id, name, email, phone, resume_file { original_name, size_bytes,
mime_type, sha256 }, parsed_resume_json, match_score (null until scored), ai_recommendation (null until
shortlisted), status, created_at, updated_at, job { id, title, status }, workflow { id, status,
current_state, retry_count, updated_at }`. The storage key and status token hash are never returned.

### GET /candidates/:id — recruiter (owner of the job, or admin)
→ `{ candidate }`. Other recruiters receive 404.

### GET /candidates/:id/resume-link ➕ — recruiter
→ `{ "path": "/candidates/<id>/resume?access=<signed token>", "expires_at": "…" }`. The token is valid
for `upload-policy.resume_access_link_ttl_seconds` (300 s) and for this candidate only. Clients prefix
the path with their API base URL.

### GET /candidates/:id/resume — recruiter or signed link
Streams the PDF (`Content-Type: application/pdf`, `Content-Disposition: inline`,
`Cache-Control: private, no-store`). Authorised by a recruiter token (owner/admin) **or** a valid
`access` token. Login JWTs are not accepted as `access`. Query strings are not logged.

### GET /meta/upload-policy ➕ — public
`{ version, max_size_bytes, allowed_mime_types, allowed_extensions }` from `specs/system/upload-policy.json`.

### Changes to existing endpoints
- `GET /jobs/:id` (owner view) now includes `candidate_count`.
- `GET /dashboard/summary` now includes
  `candidates: { total, by_status }` and `workflows: { total, by_status, completion_rate }`, where
  `completion_rate` is the percentage of completed workflows, with failed ones counted in the
  denominator, or `null` when there are none.

---

## Planned endpoints

Contracts are defined in [`ARCHITECTURE.md`](./ARCHITECTURE.md) §7 and will be documented here as each
phase implements them: workflows (Phases 5–6), analytics and notifications (Phase 8).
