'use strict';

const { runInterviewAgent, protectedTermsPattern, protectedQuestionTest } = require('../../src/agents/interview.agent');
const { runEmailAgent, maskEmail } = require('../../src/agents/email.agent');
const { classifyResendError, EmailDeliveryError } = require('../../src/emails/emailService');
const { mergeJobRequirements } = require('../../src/utils/jobRequirements');
const { getSpec } = require('../../src/utils/specLoader');
const { createMemoryStore } = require('../../src/rag/vectorStore.memory');
const { collectionConfig } = require('../../src/rag');
const { createFakeEmbedder, createFakeLlm } = require('../helpers/fakes');

const requirements = mergeJobRequirements({
  id: 'a'.repeat(24),
  title: 'Frontend Developer',
  hiring_spec_id: 'frontend-developer',
  required_skills: ['React', 'JavaScript', 'CSS'],
  preferred_skills: ['Next.js', 'Tailwind CSS'],
  min_experience: 2,
});
const parsedResume = {
  name: 'John Carter',
  skills: ['React', 'JavaScript', 'CSS'],
  experience_years: 4,
  education: [{ institution: 'State University', degree: 'B.Sc.', field: 'CS', year: 2020 }],
  projects: [{ name: 'Recipe Finder', description: 'React app', technologies: ['React'] }],
};
const matchResult = { missing_skills: ['Tailwind CSS'], match_score: 88 };
const spec = getSpec('prompts/interview-agent');

const rubric = () => Object.fromEntries(spec.rubric_levels.map((l) => [l, `Observable behaviour for ${l}`]));
function llmKit({ questions = spec.question_count, tasks = spec.coding_task_count, extraQuestion } = {}) {
  const qs = Array.from({ length: questions }, (_, i) => ({ question: `Describe how you used React for feature number ${i + 1}.`, type: 'experience', skill: 'React', rubric: rubric() }));
  if (extraQuestion) qs.unshift({ question: extraQuestion, type: 'situational', skill: 'CSS', rubric: rubric() });
  return {
    questions: qs,
    coding_tasks: Array.from({ length: tasks }, (_, i) => ({ title: `Task ${i + 1}`, prompt: 'Build a small accessible React form with validation and tests.', skills: ['React'], time_minutes: 45, rubric: rubric() })),
    focus_areas: ['Tailwind CSS gap'],
  };
}

const deps = () => ({ embedder: createFakeEmbedder(), store: createMemoryStore() });

describe('Interview Agent (specs/prompts/interview-agent.json)', () => {
  test('rule-based kit: spec counts, rubric levels, project and gap questions', async () => {
    const kit = await runInterviewAgent({ requirements, parsedResume, matchResult }, { llm: null, ...deps() });
    expect(kit.source).toBe('deterministic_fallback');
    expect(kit.questions.length).toBeLessThanOrEqual(spec.question_count);
    expect(kit.questions[0].question).toContain('Recipe Finder');
    const gap = kit.questions.find((q) => q.skill === 'Tailwind CSS');
    expect(gap.type).toBe('situational');
    expect(kit.coding_tasks).toHaveLength(spec.coding_task_count);
    expect(kit.coding_tasks[0]).toMatchObject({ id: 't1', time_minutes: spec.coding_task_minutes, skills: ['React'] });
    for (const item of [...kit.questions, ...kit.coding_tasks]) expect(Object.keys(item.rubric).sort()).toEqual([...spec.rubric_levels].sort());
    expect(kit.interview_rounds).toBe(2);
  });

  test('with an LLM: validated kit, interview guidelines injected, no personal data in the prompt', async () => {
    const { embedder, store } = deps();
    const { name, ...cfg } = collectionConfig('knowledge');
    await store.ensureCollection(name, cfg);
    const query = spec.rag.query_template.replace('{role}', requirements.role).replace('{skills}', 'React, JavaScript, CSS, Next.js, Tailwind CSS');
    await store.upsert(name, [{ id: 'g1', vector: await embedder.embedQuery(query), payload: { doc_type: 'interview_guideline', doc_path: 'knowledge/g.md', chunk_index: 0, text: query } }]);
    const llm = createFakeLlm([{ name: 'groq', respond: () => JSON.stringify(llmKit()) }]);
    const kit = await runInterviewAgent({ requirements, parsedResume, matchResult }, { llm, embedder, store });
    expect(kit.source).toBe('llm');
    expect(kit.questions).toHaveLength(spec.question_count);
    expect(kit.guidelines).toEqual([{ doc_type: 'interview_guideline', doc_path: 'knowledge/g.md', chunk_index: 0, score: 1 }]);
    const sent = JSON.parse(llm.calls[0].user);
    expect(sent.interview_guidelines).toEqual([query]);
    expect(sent.gaps).toEqual(['Tailwind CSS']);
    expect(JSON.stringify(sent)).not.toMatch(/John Carter|State University/);
    expect(llm.calls[0].temperature).toBe(spec.temperature);
  });

  test('coding task time boxes come from the spec, not the model', async () => {
    const generated = llmKit();
    generated.coding_tasks.forEach((t) => {
      t.time_minutes = 25;
    });
    const llm = createFakeLlm([{ name: 'groq', respond: () => JSON.stringify(generated) }]);
    const kit = await runInterviewAgent({ requirements, parsedResume, matchResult }, { llm, ...deps() });
    expect(kit.coding_tasks.every((t) => t.time_minutes === spec.coding_task_minutes)).toBe(true);
  });

  test('removes questions about protected characteristics', async () => {
    const llm = createFakeLlm([{ name: 'groq', respond: () => JSON.stringify(llmKit({ extraQuestion: 'Are you married or planning to have children soon?' })) }]);
    const kit = await runInterviewAgent({ requirements, parsedResume, matchResult }, { llm, ...deps() });
    expect(kit.questions.some((q) => /married/.test(q.question))).toBe(false);
    expect(kit.removed_questions).toEqual([{ question: 'Are you married or planning to have children soon?', reason: 'mentions a protected characteristic' }]);
    expect(kit.questions).toHaveLength(spec.question_count);
  });

  test('protected-term screening uses word boundaries and allows technical phrases', () => {
    const isProtected = protectedQuestionTest(getSpec('evaluation/fairness-policy').excluded_attributes);
    expect(isProtected('How do you manage state across pages?')).toBe(false);
    expect(isProtected('How would you debug a race condition in a React effect?')).toBe(false);
    expect(isProtected('How do you set Cache-Control max-age for static assets?')).toBe(false);
    expect(isProtected('What is your age?')).toBe(true);
    expect(isProtected('Where were you born?')).toBe(true);
    expect(isProtected('Does your race matter for this team?')).toBe(true);
    expect(protectedTermsPattern(['marital_status']).test('Are you married?')).toBe(true);
  });

  test('rejects LLM kits with too few questions or wrong rubric levels (falls back to the next provider)', async () => {
    const bad = llmKit({ questions: 2 });
    const wrongRubric = llmKit();
    wrongRubric.questions[0].rubric = { good: 'x', bad: 'y' };
    const llm = createFakeLlm([
      { name: 'groq', respond: () => JSON.stringify(bad) },
      { name: 'openrouter', respond: () => JSON.stringify(wrongRubric) },
    ]);
    await expect(runInterviewAgent({ requirements, parsedResume, matchResult }, { llm, ...deps() })).rejects.toMatchObject({ code: 'MALFORMED_JSON' });
    expect(llm.calls.map((c) => c.provider)).toEqual(['groq', 'openrouter']);
  });
});

describe('Email Agent (specs/email/*.json via the workflow branch)', () => {
  const candidate = { name: 'John Carter', email: 'john@example.com' };
  const approval = (decision) => ({ decision, decided_by: 'a'.repeat(24) });

  test('approve → interview-invite; reject → rejection; recipient masked; idempotency key per workflow', async () => {
    const calls = [];
    const sendEmail = async (args) => {
      calls.push(args);
      return { template_id: args.templateId, template_version: '1.0.0', subject: 's', delivery: 'sent', provider_id: 'em_1' };
    };
    const invite = await runEmailAgent({ workflowId: 'w1', approval: approval('approve'), candidate, requirements }, { sendEmail });
    const reject = await runEmailAgent({ workflowId: 'w2', approval: approval('reject'), candidate, requirements }, { sendEmail });
    expect(invite).toMatchObject({ template_id: 'interview-invite', delivery: 'sent', provider_id: 'em_1', recipient: 'j***@example.com' });
    expect(invite.sent_at).toBeTruthy();
    expect(reject.template_id).toBe('rejection');
    expect(calls[0]).toMatchObject({ to: 'john@example.com', idempotencyKey: 'agenthire-w1-interview-invite', variables: { candidate_name: 'John', job_title: 'Frontend Developer', company_name: 'AgentHire' } });
  });

  test('without RESEND_API_KEY the real service records not_configured (never "sent")', async () => {
    const out = await runEmailAgent({ workflowId: 'w3', approval: approval('approve'), candidate, requirements });
    expect(out).toMatchObject({ delivery: 'not_configured', provider_id: null, sent_at: null, subject: 'Interview invitation: Frontend Developer' });
  });

  test('never sends without a recruiter decision', async () => {
    await expect(runEmailAgent({ workflowId: 'w4', approval: null, candidate, requirements })).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
  });

  test('Resend errors: configuration errors are not retryable, outages are', () => {
    expect(classifyResendError({ name: 'validation_error', statusCode: 403 })).toBe('EMAIL_CONFIG_ERROR');
    expect(classifyResendError({ name: 'invalid_api_key', statusCode: 401 })).toBe('EMAIL_CONFIG_ERROR');
    expect(classifyResendError({ name: 'rate_limit_exceeded', statusCode: 429 })).toBe('EMAIL_API_FAILURE');
    expect(classifyResendError({ name: 'internal_server_error', statusCode: 500 })).toBe('EMAIL_API_FAILURE');
    expect(new EmailDeliveryError('x', 'EMAIL_CONFIG_ERROR').retryable).toBe(false);
  });

  test('masks emails', () => {
    expect(maskEmail('alex@example.com')).toBe('a***@example.com');
    expect(maskEmail('broken')).toBe('***');
  });
});
