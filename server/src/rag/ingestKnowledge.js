'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getSpec, DEFAULT_SPECS_DIR } = require('../utils/specLoader');
const { chunkText } = require('./chunker');
const { uuidV5 } = require('./pointId');
const { collectionConfig } = require('./index');

/**
 * Index hiring policies, evaluation docs and interview guidelines from
 * specs/knowledge/ into the knowledge collection. Each document's points
 * are replaced, so edits and deletions of chunks are reflected.
 */
async function ingestKnowledge({ embedder, store, specsDir = DEFAULT_SPECS_DIR }) {
  const spec = getSpec('evaluation/rag-retrieval');
  const { name, ...cfg } = collectionConfig('knowledge');
  await store.ensureCollection(name, cfg);

  const summary = [];
  const indexedPaths = [];
  for (const source of spec.knowledge_sources) {
    const dir = path.join(specsDir, source.dir);
    let files = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md')).sort();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    for (const file of files) {
      const docPath = `${source.dir}/${file}`;
      const text = await fs.readFile(path.join(dir, file), 'utf8');
      const chunks = chunkText(text, spec.chunking.policy);
      const vectors = await embedder.embedDocuments(chunks);
      const contentHash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
      await store.deleteByFilter(name, { doc_path: docPath });
      await store.upsert(
        name,
        chunks.map((chunk, i) => ({
          id: uuidV5(`knowledge:${docPath}:${i}`),
          vector: vectors[i],
          payload: { doc_type: source.doc_type, doc_path: docPath, chunk_index: i, text: chunk, content_hash: contentHash, embedding_model: embedder.model },
        }))
      );
      indexedPaths.push(docPath);
      summary.push({ doc_path: docPath, doc_type: source.doc_type, chunks: chunks.length });
    }
  }
  return { collection: name, documents: summary, indexed_paths: indexedPaths };
}

module.exports = { ingestKnowledge };
