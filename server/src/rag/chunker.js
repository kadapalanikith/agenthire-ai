'use strict';

/**
 * Split text into chunks of at most `chunk_size` characters (from
 * specs/evaluation/rag-retrieval.json), preferring paragraph, line, sentence
 * and word boundaries, with optional overlap.
 */
function chunkText(text, { chunk_size: size, chunk_overlap: overlap = 0 }) {
  const clean = String(text || '').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const minCut = Math.floor(size * 0.5);
      const cut = ['\n\n', '\n', '. ', ' ']
        .map((sep) => window.lastIndexOf(sep))
        .find((idx) => idx >= minCut);
      if (cut !== undefined && cut > 0) end = start + cut + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

module.exports = { chunkText };
