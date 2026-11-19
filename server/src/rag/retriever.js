'use strict';

const { getSpec } = require('../utils/specLoader');
const { collectionConfig } = require('./index');

/**
 * Similarity search with top_k and minimum_similarity from
 * specs/evaluation/rag-retrieval.json. Returns traceable context entries.
 */
async function retrieve({ kind, query, filter, embedder, store, topK }) {
  const { retrieval } = getSpec('evaluation/rag-retrieval');
  const { name, ...cfg } = collectionConfig(kind);
  await store.ensureCollection(name, cfg);
  const vector = await embedder.embedQuery(query);
  const hits = await store.search(name, vector, {
    limit: topK ?? retrieval.top_k,
    scoreThreshold: retrieval.minimum_similarity,
    filter,
  });
  return hits.map((h) => ({
    id: h.id,
    score: Math.round(h.score * 1000) / 1000,
    text: h.payload.text,
    source: kind === 'knowledge' ? { doc_type: h.payload.doc_type, doc_path: h.payload.doc_path, chunk_index: h.payload.chunk_index } : { chunk_index: h.payload.chunk_index },
  }));
}

function retrieveKnowledge({ query, docTypes, embedder, store }) {
  return retrieve({ kind: 'knowledge', query, filter: docTypes ? { doc_type: docTypes } : undefined, embedder, store });
}

function retrieveResumeEvidence({ query, candidateId, embedder, store, topK }) {
  return retrieve({ kind: 'resumes', query, filter: { candidate_id: candidateId }, embedder, store, topK });
}

module.exports = { retrieveKnowledge, retrieveResumeEvidence };
