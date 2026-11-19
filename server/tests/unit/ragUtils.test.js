'use strict';

const { chunkText } = require('../../src/rag/chunker');
const { uuidV5 } = require('../../src/rag/pointId');
const { createMemoryStore } = require('../../src/rag/vectorStore.memory');
const { toQdrantFilter } = require('../../src/rag/vectorStore.qdrant');
const { skillKey, createSkillCanonicalizer, canonicalizeSkillList, findSkillMentions } = require('../../src/utils/skills');
const { redactContactInfo, stripExcludedAttributes } = require('../../src/utils/redact');
const { classifyError, AgentError } = require('../../src/workflows/errors');
const { getSpec } = require('../../src/utils/specLoader');

describe('chunker (sizes from specs/evaluation/rag-retrieval.json)', () => {
  const { resume, policy } = getSpec('evaluation/rag-retrieval').chunking;

  test('uses the spec sizes: 500 for resumes, 1000 for policies', () => {
    expect(resume.chunk_size).toBe(500);
    expect(policy.chunk_size).toBe(1000);
  });

  test('never exceeds chunk_size and preserves all words', () => {
    const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, resume);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.join(' ').split(/\s+/)).toEqual(text.split(' '));
  });

  test('prefers paragraph boundaries', () => {
    const para = 'a'.repeat(300);
    const chunks = chunkText(`${para}\n\n${para}`, resume);
    expect(chunks).toEqual([para, para]);
  });

  test('applies overlap when configured', () => {
    const text = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(text, { chunk_size: 100, chunk_overlap: 20 });
    const tail = chunks[0].slice(-10);
    expect(chunks[1].includes(tail.trim().split(' ').pop())).toBe(true);
  });

  test('handles empty and short text', () => {
    expect(chunkText('', resume)).toEqual([]);
    expect(chunkText('short', resume)).toEqual(['short']);
  });
});

describe('deterministic point ids', () => {
  test('uuid v5 is stable and well-formed', () => {
    const a = uuidV5('resume:abc:0');
    expect(a).toBe(uuidV5('resume:abc:0'));
    expect(a).not.toBe(uuidV5('resume:abc:1'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('vector stores', () => {
  test('memory store: upsert, filtered search with threshold, delete and count', async () => {
    const s = createMemoryStore();
    await s.ensureCollection('c', { size: 2 });
    await s.upsert('c', [
      { id: '1', vector: [1, 0], payload: { candidate_id: 'a' } },
      { id: '2', vector: [0.8, 0.6], payload: { candidate_id: 'b' } },
      { id: '3', vector: [0, 1], payload: { candidate_id: 'a' } },
    ]);
    const hits = await s.search('c', [1, 0], { limit: 5, scoreThreshold: 0.7 });
    expect(hits.map((h) => h.id)).toEqual(['1', '2']);
    const filtered = await s.search('c', [1, 0], { limit: 5, filter: { candidate_id: 'a' } });
    expect(filtered.map((h) => h.id)).toEqual(['1', '3']);
    await s.deleteByFilter('c', { candidate_id: 'a' });
    expect(await s.count('c')).toBe(1);
    await expect(s.upsert('c', [{ id: 'x', vector: [1], payload: {} }])).rejects.toThrow(/size/);
  });

  test('qdrant filter translation', () => {
    expect(toQdrantFilter({ candidate_id: 'a', doc_type: ['x', 'y'] })).toEqual({
      must: [
        { key: 'candidate_id', match: { value: 'a' } },
        { key: 'doc_type', match: { any: ['x', 'y'] } },
      ],
    });
    expect(toQdrantFilter(undefined)).toBeUndefined();
  });
});

describe('skills', () => {
  const aliases = getSpec('prompts/resume-parser').skill_aliases;

  test('keys ignore case, spaces, dots and hyphens', () => {
    expect(skillKey('Next.js')).toBe(skillKey('nextjs'));
    expect(skillKey('Tailwind CSS')).toBe(skillKey('tailwindcss'));
  });

  test('canonicalises aliases and known names, de-duplicating', () => {
    const c = createSkillCanonicalizer(['JavaScript', 'React', 'Next.js', 'Tailwind CSS'], aliases);
    expect(canonicalizeSkillList(['js', 'reactjs', 'NextJS', 'tailwind', 'React', 'Rust'], c)).toEqual([
      'JavaScript',
      'React',
      'Next.js',
      'Tailwind CSS',
      'Rust',
    ]);
  });

  test('finds mentions with word boundaries and aliases', () => {
    const text = 'Built apps in ReactJS and NextJS. Worked at Google. Wrote Java services.';
    expect(findSkillMentions(text, ['React', 'Next.js', 'Go', 'Java', 'JavaScript'], aliases)).toEqual(['React', 'Next.js', 'Java']);
  });
});

describe('redaction and fairness filtering', () => {
  test('redacts email, URLs and phone numbers but keeps years and date ranges', () => {
    const text = 'jane@example.com | +1 (555) 010-0199 | https://jane.dev\nEngineer (2019 - 2023), 4 years, 3,000 users';
    const out = redactContactInfo(text, ['email', 'phone', 'url']);
    expect(out).toContain('[EMAIL]');
    expect(out).toContain('[PHONE]');
    expect(out).toContain('[URL]');
    expect(out).toContain('(2019 - 2023)');
    expect(out).toContain('4 years');
    expect(out).not.toContain('jane@example.com');
    expect(out).not.toContain('555');
  });

  test('only redacts the kinds listed in the spec', () => {
    expect(redactContactInfo('a@b.co', ['phone'])).toBe('a@b.co');
  });

  test('strips protected attributes recursively, case-insensitively', () => {
    const out = stripExcludedAttributes({ name: 'x', Gender: 'f', nested: [{ age: 30, skill: 'React' }] }, ['gender', 'age']);
    expect(out).toEqual({ name: 'x', nested: [{ skill: 'React' }] });
  });
});

describe('error classification from specs/system/retry-policy.json', () => {
  test('retryable vs non-retryable codes', () => {
    for (const code of ['LLM_TIMEOUT', 'LLM_PROVIDER_ERROR', 'EMAIL_API_FAILURE', 'VECTOR_DB_TIMEOUT']) {
      expect(new AgentError(code, 'x').retryable).toBe(true);
    }
    for (const code of ['INVALID_PDF', 'NO_EXTRACTABLE_TEXT', 'MALFORMED_JSON', 'INVALID_SCHEMA', 'LLM_CONFIG_ERROR', 'SOMETHING_NEW']) {
      expect(classifyError({ code }).retryable).toBe(false);
    }
  });
});
