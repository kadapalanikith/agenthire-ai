'use strict';

/**
 * In-memory vector store with the same interface as the Qdrant store
 * (named in the original spec as the test equivalent). Cosine similarity.
 */
function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function matches(payload, filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) => (Array.isArray(v) ? v.includes(payload[k]) : payload[k] === v));
}

function createMemoryStore() {
  const collections = new Map();
  const get = (name) => {
    const c = collections.get(name);
    if (!c) throw new Error(`Collection ${name} does not exist`);
    return c;
  };

  return {
    kind: 'memory',
    collections,
    async ensureCollection(name, { size }) {
      if (!collections.has(name)) collections.set(name, { size, points: new Map() });
    },
    async upsert(name, points) {
      const c = get(name);
      for (const p of points) {
        if (p.vector.length !== c.size) throw new Error(`Vector size ${p.vector.length} != ${c.size}`);
        c.points.set(String(p.id), { id: String(p.id), vector: p.vector, payload: p.payload });
      }
    },
    async deleteByFilter(name, filter) {
      const c = get(name);
      for (const [id, p] of c.points) if (matches(p.payload, filter)) c.points.delete(id);
    },
    async search(name, vector, { limit, scoreThreshold = -Infinity, filter }) {
      const c = get(name);
      return [...c.points.values()]
        .filter((p) => matches(p.payload, filter))
        .map((p) => ({ id: p.id, score: cosine(vector, p.vector), payload: p.payload }))
        .filter((r) => r.score >= scoreThreshold)
        .sort((x, y) => y.score - x.score)
        .slice(0, limit);
    },
    async count(name, filter) {
      return [...get(name).points.values()].filter((p) => matches(p.payload, filter)).length;
    },
    async ping() {
      return true;
    },
  };
}

module.exports = { createMemoryStore, cosine };
