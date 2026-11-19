'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { extractPdfText } = require('../../src/utils/pdfText');
const { buildPdfFromLines, buildEmptyTextPdf } = require('../../scripts/lib/simplePdf');
const { classifyProviderError, parseJsonObject } = require('../../src/agents/shared/llmClient');
const { createFakeLlm } = require('../helpers/fakes');

const DEMO = path.resolve(__dirname, '../../../demo-data/resumes/john-react-resume.pdf');

describe('PDF text extraction (real pdf.js via unpdf)', () => {
  test('extracts the demo resume', async () => {
    const { text, pages } = await extractPdfText(fs.readFileSync(DEMO), { minChars: 80 });
    expect(pages).toBe(1);
    expect(text).toContain('John Carter');
    expect(text).toContain('4 years of professional experience');
    expect(text).toContain('Next.js');
  });

  test('extracts multi-page documents and keeps line breaks', async () => {
    const lines = Array.from({ length: 80 }, (_, i) => `Line number ${i}`);
    const { text, pages } = await extractPdfText(buildPdfFromLines(lines));
    expect(pages).toBe(2);
    expect(text.split('\n')).toEqual(expect.arrayContaining(['Line number 0', 'Line number 79']));
  });

  test('rejects image-only PDFs as NO_EXTRACTABLE_TEXT', async () => {
    await expect(extractPdfText(buildEmptyTextPdf(), { minChars: 80 })).rejects.toMatchObject({ code: 'NO_EXTRACTABLE_TEXT', retryable: false });
  });

  test('rejects corrupt bytes as INVALID_PDF', async () => {
    await expect(extractPdfText(Buffer.from('%PDF-1.4\ngarbage\n%%EOF'))).rejects.toMatchObject({ code: 'INVALID_PDF', retryable: false });
  });
});

describe('LLM client', () => {
  const schema = z.object({ ok: z.boolean() });

  test('parses JSON, including fenced output', () => {
    expect(parseJsonObject('```json\n{"ok": true}\n```')).toEqual({ ok: true });
    expect(parseJsonObject('Sure! {"ok": false} done')).toEqual({ ok: false });
    expect(() => parseJsonObject('no json')).toThrow();
  });

  test('classifies provider errors', () => {
    expect(classifyProviderError(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))).toBe('LLM_TIMEOUT');
    expect(classifyProviderError({ status: 401, message: 'Invalid API key' })).toBe('LLM_CONFIG_ERROR');
    expect(classifyProviderError({ status: 429, message: 'rate limited' })).toBe('LLM_PROVIDER_ERROR');
    expect(classifyProviderError({ status: 503, message: 'unavailable' })).toBe('LLM_PROVIDER_ERROR');
  });

  test('uses the primary provider when it succeeds', async () => {
    const llm = createFakeLlm([
      { name: 'groq', respond: () => '{"ok": true}' },
      { name: 'openrouter', respond: () => '{"ok": false}' },
    ]);
    await expect(llm.invokeJson({ system: 's', user: 'u', schema })).resolves.toMatchObject({ data: { ok: true }, provider: 'groq' });
    expect(llm.calls).toHaveLength(1);
  });

  test('falls back to OpenRouter when Groq times out or returns invalid JSON', async () => {
    const timeout = createFakeLlm([
      { name: 'groq', respond: () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); } },
      { name: 'openrouter', respond: () => '{"ok": true}' },
    ]);
    await expect(timeout.invokeJson({ system: 's', user: 'u', schema })).resolves.toMatchObject({ provider: 'openrouter' });
    const invalid = createFakeLlm([
      { name: 'groq', respond: () => '{"ok": "yes"}' },
      { name: 'openrouter', respond: () => '{"ok": true}' },
    ]);
    await expect(invalid.invokeJson({ system: 's', user: 'u', schema })).resolves.toMatchObject({ provider: 'openrouter' });
  });

  test('all providers failing: transient failures win (retryable), else MALFORMED_JSON', async () => {
    const mixed = createFakeLlm([
      { name: 'groq', respond: () => 'not json' },
      { name: 'openrouter', respond: () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); } },
    ]);
    await expect(mixed.invokeJson({ system: 's', user: 'u', schema })).rejects.toMatchObject({ code: 'LLM_TIMEOUT', retryable: true });
    const malformed = createFakeLlm([{ name: 'groq', respond: () => '{"nope": 1}' }]);
    await expect(malformed.invokeJson({ system: 's', user: 'u', schema })).rejects.toMatchObject({ code: 'MALFORMED_JSON', retryable: false });
  });

  test('reports an unconfigured client', async () => {
    const llm = createFakeLlm([]);
    expect(llm.configured).toBe(false);
    await expect(llm.invokeJson({ system: 's', user: 'u', schema })).rejects.toMatchObject({ code: 'LLM_CONFIG_ERROR' });
  });
});
