/**
 * @jest-environment ./tests/helpers/onnxEnvironment.js
 */
'use strict';

/**
 * Real-service test: BAAI/bge-small-en-v1.5 (local ONNX) + Qdrant.
 * Opt-in: RUN_REAL_SERVICES=1 QDRANT_TEST_URL=http://127.0.0.1:6333 npm test -- realServices
 * Uses the spec collections with a unique candidate id and removes its points afterwards.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const enabled = process.env.RUN_REAL_SERVICES === '1';
const describeReal = enabled ? describe : describe.skip;

describeReal('real embeddings + Qdrant', () => {
  let embedder;
  let store;
  const candidateId = `test-${crypto.randomUUID()}`;

  beforeAll(() => {
    const { createLocalEmbedder } = require('../../src/rag/embedder');
    const { createQdrantStore } = require('../../src/rag/vectorStore.qdrant');
    embedder = createLocalEmbedder({ modelId: 'Xenova/bge-small-en-v1.5' });
    store = createQdrantStore({ url: process.env.QDRANT_TEST_URL || 'http://127.0.0.1:6333' });
  });

  afterAll(async () => {
    const { collectionConfig } = require('../../src/rag');
    if (store) await store.deleteByFilter(collectionConfig('resumes').name, { candidate_id: candidateId }).catch(() => {});
  });

  test('bge-small produces 384-dim normalised vectors with meaningful similarity', async () => {
    const { cosine } = require('../../src/rag/vectorStore.memory');
    const [react, react2, kitchen] = await embedder.embedDocuments([
      'Built React components with hooks for a dashboard',
      'Developed user interfaces using React and JavaScript',
      'Managed a restaurant kitchen and food inventory',
    ]);
    expect(react).toHaveLength(384);
    expect(Math.sqrt(react.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 3);
    expect(cosine(react, react2)).toBeGreaterThan(cosine(react, kitchen) + 0.1);
  }, 120000);

  test('parser → embedding → matching on the demo resume against Qdrant', async () => {
    const { runResumeParser } = require('../../src/agents/resumeParser.agent');
    const { runEmbeddingAgent } = require('../../src/agents/embedding.agent');
    const { runMatchingAgent } = require('../../src/agents/matching.agent');
    const { mergeJobRequirements } = require('../../src/utils/jobRequirements');
    const { collectionConfig } = require('../../src/rag');

    const requirements = mergeJobRequirements({
      id: 'job-real-test',
      title: 'Frontend Developer',
      hiring_spec_id: 'frontend-developer',
      required_skills: ['React', 'JavaScript', 'CSS'],
      preferred_skills: ['Next.js', 'Tailwind CSS'],
      min_experience: 2,
    });
    const pdf = fs.readFileSync(path.resolve(__dirname, '../../../demo-data/resumes/john-react-resume.pdf'));
    const parsed = await runResumeParser({ resumeBuffer: pdf, requirements }, { llm: null });
    const embedded = await runEmbeddingAgent({ candidateId, jobId: 'job-real-test', resumeText: parsed.resume_text }, { embedder, store });
    expect(await store.count(collectionConfig('resumes').name, { candidate_id: candidateId })).toBe(embedded.chunk_count);

    const match = await runMatchingAgent({ candidateId, parsedResume: parsed.parsed_resume, resumeText: parsed.resume_text, requirements }, { llm: null, embedder, store });
    expect(match.match_score).toBe(100);
    expect(match.all_skills_matched).toBe(true);
  }, 180000);
});

if (!enabled) {
  test('real-service tests are opt-in (RUN_REAL_SERVICES=1)', () => {
    expect(enabled).toBe(false);
  });
}
