'use strict';

/* Index specs/knowledge/** into the Qdrant knowledge collection. */
const { initSpecs } = require('../src/utils/specLoader');
const { getEmbedder } = require('../src/rag/embedder');
const { getVectorStore, ensureCollections } = require('../src/rag');
const { ingestKnowledge } = require('../src/rag/ingestKnowledge');

(async () => {
  initSpecs();
  const store = getVectorStore();
  await ensureCollections(store);
  const result = await ingestKnowledge({ embedder: getEmbedder(), store });
  for (const d of result.documents) process.stdout.write(`  indexed ${d.doc_path} (${d.doc_type}): ${d.chunks} chunk(s)\n`);
  process.stdout.write(`Knowledge collection "${result.collection}" ready with ${result.documents.length} document(s).\n`);
})().catch((err) => {
  process.stderr.write(`Ingestion failed: ${err.code || ''} ${err.message}\n`);
  process.exit(1);
});
