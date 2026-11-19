'use strict';

const crypto = require('node:crypto');

// Fixed namespace for AgentHire vector point ids.
const NAMESPACE = '6f1c5d2a-8a4e-4c1b-9f0e-3b7a2d9c4e11';

/**
 * RFC 4122 UUID v5 (SHA-1, name-based). Re-indexing the same chunk yields
 * the same Qdrant point id, so retries overwrite instead of duplicating.
 */
function uuidV5(name, namespace = NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

module.exports = { uuidV5 };
