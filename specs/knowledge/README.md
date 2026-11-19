# RAG knowledge sources

Markdown documents in these folders are chunked (`chunking.policy` in `../evaluation/rag-retrieval.json`),
embedded with BAAI/bge-small-en-v1.5 and stored in the Qdrant knowledge collection. The folder decides the
`doc_type` (see `knowledge_sources` in the same spec).

| Folder | doc_type | Used by |
|---|---|---|
| `hiring-policies/` | `hiring_policy` | matching agent |
| `evaluation-docs/` | `evaluation_doc` | matching agent |
| `interview-guidelines/` | `interview_guideline` | interview agent (Phase 7) |

Re-index after editing: `cd server && npm run ingest:knowledge`.

These documents are organisational guidance written for AgentHire. They are not legal advice.
