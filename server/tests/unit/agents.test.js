'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runResumeParser, extractExperienceYears } = require('../../src/agents/resumeParser.agent');
const { runEmbeddingAgent } = require('../../src/agents/embedding.agent');
const { runMatchingAgent, computeScore } = require('../../src/agents/matching.agent');
const { ingestKnowledge } = require('../../src/rag/ingestKnowledge');
const { collectionConfig } = require('../../src/rag');
const { createMemoryStore } = require('../../src/rag/vectorStore.memory');
const { mergeJobRequirements } = require('../../src/utils/jobRequirements');
const { getSpec } = require('../../src/utils/specLoader');
const { buildPdfFromLines } = require('../../scripts/lib/simplePdf');
const { createFakeEmbedder, createFakeLlm } = require('../helpers/fakes');

const DEMO = fs.readFileSync(path.resolve(__dirname, '../../../demo-data/resumes/john-react-resume.pdf'));

const job = {
  id: 'a'.repeat(24),
  title: 'Frontend Developer',
  hiring_spec_id: 'frontend-developer',
  required_skills: ['React', 'JavaScript', 'CSS'],
  preferred_skills: ['Next.js', 'Tailwind CSS'],
  min_experience: 2,
};
const requirements = mergeJobRequirements(job);

describe('job requirements', () => {
  test('skills and experience come from the job; minimum_score from the hiring spec', () => {
    const custom = mergeJobRequirements({ ...job, required_skills: ['Vue'], preferred_skills: [], min_experience: 5 });
    expect(custom).toMatchObject({ required_skills: ['Vue'], preferred_skills: [], min_experience: 5, minimum_score: 75, interview_rounds: 2 });
    expect(custom.hiring_spec).toEqual({ id: 'frontend-developer', version: '1.0.0' });
  });
});

describe('Resume Parser Agent', () => {
  test('deterministic fallback extracts skills, experience, education and projects from real PDF text', async () => {
    const out = await runResumeParser({ resumeBuffer: DEMO, requirements }, { llm: null });
    expect(out.parse_source).toBe('deterministic_fallback');
    expect(out.parsed_resume.skills).toEqual(expect.arrayContaining(['React', 'JavaScript', 'CSS', 'Next.js', 'Tailwind CSS', 'Jest']));
    expect(out.parsed_resume.experience_years).toBe(4);
    expect(out.parsed_resume.education[0]).toMatchObject({ degree: 'B.Sc', year: 2020 });
    expect(out.parsed_resume.projects.map((p) => p.name)).toEqual(['Recipe Finder', 'Design Tokens Kit']);
    expect(out.resume_text).toContain('Brightline Analytics');
  });

  test('respects job-specific skills that are not in the known-skills list', async () => {
    const pdf = buildPdfFromLines([
      '# Summary',
      'Backend engineer building realtime products for an online learning platform.',
      '# Skills',
      'Elixir, Phoenix LiveView, React',
      '6 years of experience',
    ]);
    const reqs = mergeJobRequirements({ ...job, required_skills: ['Elixir', 'Phoenix LiveView'], preferred_skills: [] });
    const out = await runResumeParser({ resumeBuffer: pdf, requirements: reqs }, { llm: null });
    expect(out.parsed_resume.skills).toEqual(expect.arrayContaining(['Elixir', 'Phoenix LiveView', 'React']));
  });

  test('with an LLM: sends redacted text, canonicalises skills and strips protected attributes', async () => {
    const llm = createFakeLlm([
      {
        name: 'groq',
        respond: () =>
          JSON.stringify({
            name: 'John Carter',
            skills: ['reactjs', 'js', 'CSS3', 'nextjs'],
            experience_years: 4,
            gender: 'male',
            date_of_birth: '1990-01-01',
            education: [{ institution: 'State University', degree: 'B.Sc.', field: 'Computer Science', year: 2020 }],
            projects: [{ name: 'Recipe Finder', description: 'React app', technologies: ['react'], nationality: 'x' }],
          }),
      },
    ]);
    const out = await runResumeParser({ resumeBuffer: DEMO, requirements }, { llm });
    expect(out.parse_source).toBe('llm');
    expect(out.llm).toEqual({ provider: 'groq', model: 'groq-model' });
    expect(out.parsed_resume.skills).toEqual(['React', 'JavaScript', 'CSS', 'Next.js']);
    expect(out.parsed_resume.projects[0].technologies).toEqual(['React']);
    const json = JSON.stringify(out.parsed_resume);
    for (const banned of ['gender', 'date_of_birth', 'nationality']) expect(json).not.toContain(banned);

    const sent = JSON.parse(llm.calls[0].user);
    expect(sent.resume_text).not.toContain('john.carter@example.com');
    expect(sent.resume_text).not.toContain('555 010 0199');
    expect(sent.resume_text).toContain('[EMAIL]');
    expect(sent.known_skills).toEqual(expect.arrayContaining(['React', 'Tailwind CSS']));
    expect(llm.calls[0].system).toBe(getSpec('prompts/resume-parser').system_prompt);
    expect(llm.calls[0].temperature).toBe(0);
  });

  test('llm_failure_policy "fail" propagates classified LLM errors', async () => {
    const llm = createFakeLlm([{ name: 'groq', respond: () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); } }]);
    await expect(runResumeParser({ resumeBuffer: DEMO, requirements }, { llm })).rejects.toMatchObject({ code: 'LLM_TIMEOUT', retryable: true });
  });

  test('rejects resumes without enough text', async () => {
    await expect(runResumeParser({ resumeBuffer: buildPdfFromLines(['Hi']), requirements }, { llm: null })).rejects.toMatchObject({ code: 'NO_EXTRACTABLE_TEXT' });
  });

  test('experience extraction takes the largest stated figure', () => {
    expect(extractExperienceYears('2 years at A, 5+ years total, 30 yrs old company')).toBe(30);
    expect(extractExperienceYears('no figures')).toBeNull();
  });
});

describe('Embedding Agent', () => {
  test('chunks with the resume chunk size, stores vectors with candidate payload, and is idempotent', async () => {
    const store = createMemoryStore();
    const embedder = createFakeEmbedder();
    const text = Array.from({ length: 200 }, (_, i) => `skill${i}`).join(' ');
    const first = await runEmbeddingAgent({ candidateId: 'cand1', jobId: 'job1', resumeText: text }, { embedder, store });
    const { name } = collectionConfig('resumes');
    expect(first.collection).toBe('agenthire_resumes');
    expect(first.chunk_count).toBeGreaterThan(1);
    expect(first.chunk_size).toBe(500);
    expect(await store.count(name, { candidate_id: 'cand1' })).toBe(first.chunk_count);

    const again = await runEmbeddingAgent({ candidateId: 'cand1', jobId: 'job1', resumeText: text }, { embedder, store });
    expect(again.point_ids).toEqual(first.point_ids);
    expect(await store.count(name)).toBe(first.chunk_count);

    await runEmbeddingAgent({ candidateId: 'cand1', jobId: 'job1', resumeText: 'short text now' }, { embedder, store });
    expect(await store.count(name, { candidate_id: 'cand1' })).toBe(1);
  });
});

describe('Matching Agent', () => {
  async function setup({ resumeText, parsedResume }) {
    const store = createMemoryStore();
    const embedder = createFakeEmbedder();
    await runEmbeddingAgent({ candidateId: 'cand1', jobId: job.id, resumeText }, { embedder, store });
    return { store, embedder, input: { candidateId: 'cand1', parsedResume, resumeText, requirements } };
  }

  const baseParsed = { name: 'Jane', skills: [], experience_years: null, education: [], projects: [] };

  test('score follows spec weights (60/20/20) on the job’s skills', () => {
    const w = getSpec('prompts/matching-agent').weights;
    expect(computeScore({ requiredMatched: 2, requiredTotal: 3, preferredMatched: 1, preferredTotal: 2, years: 1, minimum: 2 }, w).match_score).toBe(60);
    // 0.6*2/3 + 0.2*1/2 + 0.2*1/2 = 0.4 + 0.1 + 0.1
    expect(computeScore({ requiredMatched: 3, requiredTotal: 3, preferredMatched: 0, preferredTotal: 0, years: 10, minimum: 0 }, w).match_score).toBe(100);
    expect(computeScore({ requiredMatched: 0, requiredTotal: 3, preferredMatched: 0, preferredTotal: 2, years: null, minimum: 3 }, w).match_score).toBe(0);
  });

  test('demo resume: full match from deterministic evidence, with explanation and breakdown', async () => {
    const parsed = (await runResumeParser({ resumeBuffer: DEMO, requirements }, { llm: null })).parsed_resume;
    const resumeText = (await runResumeParser({ resumeBuffer: DEMO, requirements }, { llm: null })).resume_text;
    const { store, embedder, input } = await setup({ resumeText, parsedResume: parsed });
    const out = await runMatchingAgent(input, { llm: null, embedder, store });
    expect(out).toMatchObject({
      matched_required_skills: ['React', 'JavaScript', 'CSS'],
      matched_preferred_skills: ['Next.js', 'Tailwind CSS'],
      missing_skills: [],
      all_skills_matched: true,
      match_score: 100,
      explanation_source: 'deterministic',
    });
    expect(out.score_breakdown.experience).toMatchObject({ candidate_years: 4, minimum: 2, points: 20 });
    expect(out.evidence.find((e) => e.skill === 'Next.js').quote).toContain('Next.js');
    expect(out.requirements.hiring_spec.id).toBe('frontend-developer');
  });

  test('uses the job’s own requirements, not the hiring spec defaults', async () => {
    const text = 'Built Vue apps for 3 years. Strong CSS.';
    const { store, embedder } = await setup({ resumeText: text, parsedResume: baseParsed });
    const reqs = mergeJobRequirements({ ...job, required_skills: ['Vue', 'CSS'], preferred_skills: [], min_experience: 6 });
    const out = await runMatchingAgent(
      { candidateId: 'cand1', parsedResume: { ...baseParsed, experience_years: 3 }, resumeText: text, requirements: reqs },
      { llm: null, embedder, store }
    );
    expect(out.matched_required_skills).toEqual(['Vue', 'CSS']);
    // 60 + 20 (no preferred skills) + 0.2 * 3/6 * 100
    expect(out.match_score).toBe(90);
  });

  test('accepts LLM matches only with a verbatim resume quote; never sends name or contact details', async () => {
    const resumeText = 'Senior engineer. Built design systems with styled components and responsive layouts using flexbox. 3 years experience.';
    const { store, embedder, input } = await setup({ resumeText, parsedResume: { ...baseParsed, experience_years: 3 } });
    const llm = createFakeLlm([
      {
        name: 'groq',
        respond: () =>
          JSON.stringify({
            assessments: [
              { skill: 'CSS', matched: true, evidence: 'responsive layouts using flexbox' },
              { skill: 'React', matched: true, evidence: 'Built React apps at Meta' },
              { skill: 'JavaScript', matched: false, evidence: null },
            ],
            explanation: 'Strong styling evidence; React and JavaScript are not demonstrated.',
          }),
      },
    ]);
    const out = await runMatchingAgent(input, { llm, embedder, store });
    expect(out.matched_required_skills).toEqual(['CSS']);
    expect(out.evidence).toEqual([{ skill: 'CSS', quote: 'responsive layouts using flexbox', source: 'llm_verified_quote' }]);
    expect(out.rejected_llm_claims).toEqual([{ skill: 'React', reason: 'quote not found in resume' }]);
    expect(out.explanation_source).toBe('llm');
    expect(out.match_score).toBe(40); // 0.6*1/3*100 + 0 preferred + 0.2*100

    const sent = llm.calls[0].user;
    expect(sent).not.toContain('Jane');
    expect(JSON.parse(sent).candidate).not.toHaveProperty('name');
    expect(JSON.parse(sent).skills_to_assess).toEqual(['React', 'JavaScript', 'CSS', 'Next.js', 'Tailwind CSS']);
  });

  test('injects knowledge retrieved from the vector store into the LLM prompt', async () => {
    const resumeText = 'React developer, 2 years, JavaScript and CSS.';
    const { store, embedder, input } = await setup({ resumeText, parsedResume: { ...baseParsed, experience_years: 2 } });
    const spec = getSpec('prompts/matching-agent');
    const query = spec.rag.knowledge_query_template
      .replace('{role}', requirements.role)
      .replace('{skills}', [...requirements.required_skills, ...requirements.preferred_skills].join(', '));
    // A knowledge chunk identical to the query (fake embedder → similarity 1.0).
    const { name, ...cfg } = collectionConfig('knowledge');
    await store.ensureCollection(name, cfg);
    await store.upsert(name, [{ id: 'k1', vector: await embedder.embedQuery(query), payload: { doc_type: 'hiring_policy', doc_path: 'knowledge/x.md', chunk_index: 0, text: query } }]);
    const llm = createFakeLlm([{ name: 'groq', respond: () => '{"assessments": [], "explanation": "ok"}' }]);
    const out = await runMatchingAgent(input, { llm, embedder, store });
    expect(out.rag_context.knowledge).toEqual([{ doc_type: 'hiring_policy', doc_path: 'knowledge/x.md', chunk_index: 0, score: 1 }]);
    expect(JSON.parse(llm.calls[0].user).policy_context).toEqual([query]);
  });

  test('llm_failure_policy "fail" surfaces LLM errors to the workflow', async () => {
    const { store, embedder, input } = await setup({ resumeText: 'Python developer.', parsedResume: baseParsed });
    const llm = createFakeLlm([{ name: 'groq', respond: () => 'garbage' }]);
    await expect(runMatchingAgent(input, { llm, embedder, store })).rejects.toMatchObject({ code: 'MALFORMED_JSON' });
  });
});

describe('knowledge ingestion', () => {
  test('indexes every specs/knowledge source with its doc_type, idempotently', async () => {
    const store = createMemoryStore();
    const embedder = createFakeEmbedder();
    const first = await ingestKnowledge({ embedder, store });
    expect(first.documents.map((d) => d.doc_type).sort()).toEqual(['evaluation_doc', 'hiring_policy', 'interview_guideline']);
    const { name } = collectionConfig('knowledge');
    const total = await store.count(name);
    expect(total).toBe(first.documents.reduce((s, d) => s + d.chunks, 0));
    await ingestKnowledge({ embedder, store });
    expect(await store.count(name)).toBe(total);
  });
});
