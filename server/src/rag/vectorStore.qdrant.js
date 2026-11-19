'use strict';

const { QdrantClient } = require('@qdrant/js-client-rest');
const { AgentError } = require('../workflows/errors');

const TIMEOUT_MS = 10000;

/** Qdrant errors: 4xx (bad request) are non-retryable; network/timeout/5xx are VECTOR_DB_TIMEOUT. */
function wrap(err, action) {
  const status = err?.status ?? err?.response?.status;
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return new AgentError('INVALID_SCHEMA', `Vector database rejected ${action}: ${err.message}`, { cause: err });
  }
  return new AgentError('VECTOR_DB_TIMEOUT', `Vector database unavailable during ${action}: ${err.message}`, { cause: err });
}

/** Translate our simple filter { key: value | [values] } into a Qdrant filter. */
function toQdrantFilter(filter) {
  if (!filter) return undefined;
  const must = Object.entries(filter).map(([key, value]) =>
    Array.isArray(value) ? { key, match: { any: value } } : { key, match: { value } }
  );
  return { must };
}

function createQdrantStore({ url, apiKey }) {
  const client = new QdrantClient({ url, apiKey, timeout: TIMEOUT_MS, checkCompatibility: false });
  const ensured = new Set();

  return {
    kind: 'qdrant',

    async ensureCollection(name, { size, distance, indexedFields = [] }) {
      if (ensured.has(name)) return;
      try {
        const { exists } = await client.collectionExists(name);
        if (!exists) {
          await client.createCollection(name, { vectors: { size, distance } });
        } else {
          const info = await client.getCollection(name);
          const vectors = info.config?.params?.vectors;
          if (vectors && vectors.size !== size) {
            throw new AgentError('INVALID_SCHEMA', `Collection ${name} has vector size ${vectors.size}, expected ${size}`);
          }
        }
        for (const field of indexedFields) {
          await client.createPayloadIndex(name, { field_name: field, field_schema: 'keyword', wait: true }).catch(() => {});
        }
        ensured.add(name);
      } catch (err) {
        if (err instanceof AgentError) throw err;
        throw wrap(err, `ensureCollection(${name})`);
      }
    },

    async upsert(name, points) {
      if (!points.length) return;
      try {
        await client.upsert(name, { wait: true, points });
      } catch (err) {
        throw wrap(err, 'upsert');
      }
    },

    async deleteByFilter(name, filter) {
      try {
        await client.delete(name, { wait: true, filter: toQdrantFilter(filter) });
      } catch (err) {
        throw wrap(err, 'delete');
      }
    },

    async search(name, vector, { limit, scoreThreshold, filter }) {
      try {
        // Universal Query API (the legacy /search endpoint was removed from the client).
        const res = await client.query(name, {
          query: vector,
          limit,
          score_threshold: scoreThreshold,
          filter: toQdrantFilter(filter),
          with_payload: true,
        });
        return res.points.map((r) => ({ id: String(r.id), score: r.score, payload: r.payload }));
      } catch (err) {
        throw wrap(err, 'search');
      }
    },

    async count(name, filter) {
      try {
        const res = await client.count(name, { filter: toQdrantFilter(filter), exact: true });
        return res.count;
      } catch (err) {
        throw wrap(err, 'count');
      }
    },

    async ping() {
      await client.getCollections();
      return true;
    },
  };
}

module.exports = { createQdrantStore, toQdrantFilter };
