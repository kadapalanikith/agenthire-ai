'use strict';

const { getSpec } = require('../utils/specLoader');
const { chunkText } = require('../rag/chunker');
const { uuidV5 } = require('../rag/pointId');
const { collectionConfig } = require('../rag');

const AGENT = 'embedding_agent';

/**
 * Embedding Agent: chunk the resume (spec: chunking.resume), embed with
 * BAAI/bge-small-en-v1.5 and store in Qdrant. Re-running replaces the
 * candidate's previous points (deterministic ids + delete-by-candidate), so
 * retries never duplicate vectors.
 */
async function runEmbeddingAgent({ candidateId, jobId, resumeText }, { embedder, store }) {
  const spec = getSpec('evaluation/rag-retrieval');
  const { name, ...cfg } = collectionConfig('resumes');
  await store.ensureCollection(name, cfg);

  const chunks = chunkText(resumeText, spec.chunking.resume);
  const vectors = await embedder.embedDocuments(chunks);
  const points = chunks.map((text, i) => ({
    id: uuidV5(`resume:${candidateId}:${i}`),
    vector: vectors[i],
    payload: { candidate_id: String(candidateId), job_id: String(jobId), doc_type: 'resume', chunk_index: i, text, embedding_model: embedder.model },
  }));

  await store.deleteByFilter(name, { candidate_id: String(candidateId) });
  await store.upsert(name, points);

  return {
    collection: name,
    point_ids: points.map((p) => p.id),
    chunk_count: points.length,
    chunk_size: spec.chunking.resume.chunk_size,
    embedding_model: embedder.model,
    spec_version: spec._meta.version,
  };
}

module.exports = { runEmbeddingAgent, AGENT };
