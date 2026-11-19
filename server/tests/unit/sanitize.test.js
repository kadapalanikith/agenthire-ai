'use strict';

const { sanitizeValue, sanitizedQueryParser } = require('../../src/middleware/sanitize');

describe('input sanitisation', () => {
  test('removes Mongo operator and dotted keys recursively', () => {
    const input = { email: { $ne: null }, nested: { 'a.b': 1, ok: 2, list: [{ $where: 'x', keep: 'y' }] } };
    expect(sanitizeValue(input)).toEqual({ email: {}, nested: { ok: 2, list: [{ keep: 'y' }] } });
  });

  test('blocks prototype pollution keys', () => {
    const input = JSON.parse('{"__proto__": {"admin": true}, "constructor": {"x": 1}, "safe": 1}');
    const out = sanitizeValue(input);
    expect(out).toEqual({ safe: 1 });
    expect({}.admin).toBeUndefined();
  });

  test('strips NUL bytes from strings', () => {
    expect(sanitizeValue('ab\0c')).toBe('abc');
  });

  test('does not mutate the input', () => {
    const input = { $gt: 1, a: 1 };
    sanitizeValue(input);
    expect(input).toEqual({ $gt: 1, a: 1 });
  });

  test('sanitises parsed query strings', () => {
    expect(sanitizedQueryParser('status[$ne]=x&page=2')).toEqual({ status: {}, page: '2' });
  });
});
