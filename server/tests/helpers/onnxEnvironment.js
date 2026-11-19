'use strict';

const { TestEnvironment } = require('jest-environment-node');

/**
 * onnxruntime-node checks `data instanceof Float32Array` against the host
 * realm's constructors; Jest's VM context has its own. Share the host typed
 * arrays so the real embedding model can run inside Jest.
 */
class OnnxEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of [
      'ArrayBuffer',
      'Float32Array',
      'Float64Array',
      'Int8Array',
      'Uint8Array',
      'Uint8ClampedArray',
      'Int16Array',
      'Uint16Array',
      'Int32Array',
      'Uint32Array',
      'BigInt64Array',
      'BigUint64Array',
    ]) {
      this.global[name] = globalThis[name];
    }
  }
}

module.exports = OnnxEnvironment;
