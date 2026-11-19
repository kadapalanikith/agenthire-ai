# Specification Reconstruction Notes

Three sections of `AGENTHIRE_SPEC.md` were truncated when copied (each ends with "Expand" after a few
visible characters). This document reconstructs them **only from information stated elsewhere in the
spec**. Every item is labelled:

- **[ORIGINAL]** — text visible in the spec (quoted or directly paraphrased, with line reference).
- **[INFERRED]** — derived from other explicit statements in the spec; the source is cited.
- **[ADDENDUM]** — required by the React Native addendum, overriding the original.
- **[DECISION]** — an architecture decision approved in Phase 0 (see `ARCHITECTURE.md` §1).

Nothing here adds product requirements that are not traceable to one of these sources.

---

## 1. Folder structure (spec lines 233–235, truncated)

Visible fragment **[ORIGINAL]**:

```
ai-recruitment-platform/
|-- client/
|   |-- app/
|   |   |-- dashboard/
|   |   |-- jobs/
|   |   |-- auth/
|   |   |-- apply/
|   |-- components/
|   |-- features/
```

Remainder:

| Path | Label | Source |
|---|---|---|
| `client/` contains the Expo app instead of Next.js | [ADDENDUM] | Addendum §1, §2; §8 rule 4 |
| `client/app/` uses Expo Router; `dashboard/`, `jobs/`, auth and apply routes kept as URL segments | [ADDENDUM]+[ORIGINAL] | lines 150–168; addendum §4 |
| `client/components/`, `client/features/` (placed under `client/src/`) | [ORIGINAL] | visible fragment |
| `server/src/{config,routes,controllers,services,validators,middleware,models,agents,workflows,rag,analytics,emails,utils,constants}` | [ORIGINAL] | line 104, line 172 |
| `server/uploads/`, `server/logs/` | [ORIGINAL] | line 115, line 174 |
| `specs/{hiring,workflow,system,prompts,evaluation,email}` | [ORIGINAL] | lines 101, 129–147, 162, 264–274 |
| `demo-data/resumes/john-react-resume.pdf` | [ORIGINAL] | line 355 |
| `specs/knowledge/` (RAG source documents for policies, evaluation docs, interview guidelines) | [INFERRED] | lines 131, 144 require these documents to be embedded; a location is needed |
| `docs/` | [ADDENDUM] | addendum §8 rule 19 |
| `docker-compose.yml` | [DECISION] | D10 |
| No `frontend/`, `backend/`, NestJS, Prisma, TypeScript | [ORIGINAL] | line 230 |

## 2. `specs/workflow/default-hiring-workflow.json` (spec lines 268–269, truncated)

Visible **[ORIGINAL]**: the `workflow` array with the seven node names in order:
`resume_parser, embedding_agent, matching_agent, shortlisting_agent, human_approval, interview_agent, email_agent`.

The truncation hides at most the closing brace and possibly further keys. Added keys and their source:

| Key | Label | Source |
|---|---|---|
| `id: "default-hiring-workflow"` | [INFERRED] | jobs store a `workflow_spec_id` (line 113) that must reference this file |
| `version` | [INFERRED] | traceability of every decision to a spec file (line 276) |
| `checkpoint_nodes: ["human_approval"]` | [INFERRED] | line 123, line 137 |
| `branches` (after `human_approval`: approve → interview_agent, reject → email_agent with interview_agent skipped) | [INFERRED]+[DECISION] | line 123 requires branching; D6, D8 |
| `retry_policy_ref: "system/retry-policy"` | [INFERRED] | line 147 |
| `node_states_ref: "workflow/node-states"` | [INFERRED] | line 162 |

## 3. "Complete Spec" raw contract (spec lines 282–284, truncated)

Visible **[ORIGINAL]**: `PROJECT NAME: AI Recruitment Organization`, `PROJECT TYPE: Spec-Driven
Multi-Agent Recruitment Platform`. The spec says (lines 278–280) that this block is the raw form of the
narrative sections that precede it; the narrative sections (lines 97–276) are therefore treated as its
content. Reconstructed contract summary:

| Section | Content | Label |
|---|---|---|
| Project name / type | AI Recruitment Organization; Spec-Driven Multi-Agent Recruitment Platform; product name AgentHire | [ORIGINAL] |
| Users | Recruiters (authenticated) and candidates (public) | [ORIGINAL] lines 56, 324 |
| Tech stack | as lines 104 + addendum §2 | [ORIGINAL]+[ADDENDUM] |
| Features | auth, jobs, candidate applications, workflow orchestration, 7 agents, RAG, failure handling | [ORIGINAL] lines 107–147 |
| Pages | lines 150–168, replaced by addendum §4 screens | [ADDENDUM] |
| Backend architecture, collections, endpoints | lines 172–227 | [ORIGINAL] |
| Environment variables | `NEXT_PUBLIC_API_URL` → `EXPO_PUBLIC_API_URL`; `MONGODB_URI, JWT_SECRET, GROQ_API_KEY, OPENROUTER_API_KEY, QDRANT_URL, RESEND_API_KEY` | [ORIGINAL] line 331 + [ADDENDUM] |
| Spec files | hiring, workflow, retry-policy, node-states, prompts, shortlisting-rules, rag-retrieval, email templates | [ORIGINAL] lines 101, 129–162, 264–274 |
| Verification | end-to-end flow (line 355) + addendum §10 acceptance criteria | [ORIGINAL]+[ADDENDUM] |
| Testing | Jest, Supertest, Playwright | [ORIGINAL] line 104 |

## 4. Spec files whose content is not given in the original

The original names these files but does not show their content. Values stated in the narrative are used
verbatim; everything else is labelled in the file's `_meta.provenance` field.

| File | Stated values [ORIGINAL] | Inferred content |
|---|---|---|
| `evaluation/shortlisting-rules.json` | ≥80 shortlisted, 60–79 hold, <60 rejected | `role_minimum_score_policy` [DECISION D7] |
| `evaluation/rag-retrieval.json` | resume chunk 500, policy chunk 1000, top_k 5, min_similarity 0.75 | collection names, overlap 0 |
| `system/retry-policy.json` | max_retries 3, retry_delay_ms 5000 | retryable / non-retryable error classes (line 147) |
| `workflow/node-states.json` | running blue, success green, failed red, waiting_approval yellow, pending neutral | `skipped` [DECISION D8]; dark-theme colours; display labels [ADDENDUM §5] |
| `prompts/*.json`, `email/*.json` | purpose only (lines 129–141) | prompt text, schemas, templates |
| `system/upload-policy.json`, `system/auth-policy.json`, `email/password-reset.json`, `evaluation/fairness-policy.json` | — | [ADDENDUM §4, §7] |
