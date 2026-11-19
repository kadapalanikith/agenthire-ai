'use strict';

const { z } = require('zod');
const { getSpec } = require('../utils/specLoader');
const { retrieveKnowledge } = require('../rag/retriever');
const { AgentError } = require('../workflows/errors');

const AGENT = 'interview_agent';

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_m, k) => values[k] ?? '');

/** Words that would make a question about a protected characteristic (from fairness-policy). */
function protectedTermsPattern(excluded) {
  const words = new Set();
  for (const attr of excluded) for (const w of attr.split('_')) if (w.length > 2) words.add(w);
  // Common proxies for the excluded attributes.
  for (const w of ['married', 'children', 'kids', 'pregnant', 'pregnancy', 'birthday', 'born', 'church', 'mosque', 'temple', 'citizen', 'accent', 'retire', 'old are you']) words.add(w);
  const alternatives = [...words].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${alternatives})\\b`, 'i');
}

// Technical phrases that contain an excluded word but are job-related.
const TECHNICAL_EXCEPTIONS = /\brace conditions?\b|\bdata races?\b|\bimage age\b|\bcache age\b|\bmax-age\b/gi;

function protectedQuestionTest(excluded) {
  const re = protectedTermsPattern(excluded);
  return (text) => re.test(String(text).replace(TECHNICAL_EXCEPTIONS, ' '));
}

function buildSchema(spec) {
  const rubric = z.strictObject(Object.fromEntries(spec.rubric_levels.map((l) => [l, z.string().trim().min(3).max(500)])));
  return z.object({
    questions: z
      .array(z.object({ question: z.string().trim().min(10).max(600), type: z.enum(spec.question_types), skill: z.string().trim().min(1).max(80), rubric }))
      .min(spec.question_count, `expected ${spec.question_count} questions`),
    coding_tasks: z
      .array(
        z.object({
          title: z.string().trim().min(3).max(120),
          prompt: z.string().trim().min(20).max(1500),
          skills: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
          time_minutes: z.coerce.number().int().min(5).max(240),
          rubric,
        })
      )
      .min(spec.coding_task_count, `expected ${spec.coding_task_count} coding tasks`),
    focus_areas: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  });
}

function templateRubric(spec, skill) {
  return Object.fromEntries(spec.rubric_levels.map((l) => [l, fill(spec.fallback_templates.rubric[l], { skill })]));
}

/** Rule-based kit from the spec templates (used when no LLM provider is configured). */
function deterministicKit(spec, requirements, parsedResume, matchResult) {
  const t = spec.fallback_templates;
  const missing = new Set((matchResult?.missing_skills || []).map((s) => s.toLowerCase()));
  const questions = [];
  for (const p of (parsedResume?.projects || []).slice(0, 2)) {
    questions.push({ question: fill(t.project_question, { project: p.name }), type: 'experience', skill: p.technologies?.[0] || requirements.required_skills[0], rubric: templateRubric(spec, p.technologies?.[0] || 'the project work') });
  }
  for (const skill of [...requirements.required_skills, ...requirements.preferred_skills]) {
    const gap = missing.has(skill.toLowerCase());
    questions.push({
      question: fill(gap ? t.gap_question : t.experience_question, { skill }),
      type: gap ? 'situational' : 'experience',
      skill,
      rubric: templateRubric(spec, skill),
    });
  }
  const codingTasks = requirements.required_skills.slice(0, spec.coding_task_count).map((skill) => ({
    title: fill(t.coding_task_title, { skill }),
    prompt: fill(t.coding_task_prompt, { skill, role: requirements.role }),
    skills: [skill],
    time_minutes: spec.coding_task_minutes,
    rubric: templateRubric(spec, skill),
  }));
  return {
    questions: questions.slice(0, spec.question_count),
    coding_tasks: codingTasks,
    focus_areas: [...missing].length ? [`Probe gaps: ${(matchResult?.missing_skills || []).join(', ')}`] : ['Depth of experience with the required skills'],
  };
}

/**
 * Interview Agent: questions, coding tasks and rubrics per
 * specs/prompts/interview-agent.json, grounded in interview guidelines
 * retrieved from the knowledge base. Runs only after a recruiter approved.
 */
async function runInterviewAgent({ requirements, parsedResume, matchResult }, { llm, embedder, store }) {
  const spec = getSpec('prompts/interview-agent');
  const fairness = getSpec('evaluation/fairness-policy');
  const skills = [...requirements.required_skills, ...requirements.preferred_skills];

  const guidelines = await retrieveKnowledge({
    query: fill(spec.rag.query_template, { role: requirements.role, skills: skills.join(', ') }),
    docTypes: spec.rag.knowledge_doc_types,
    embedder,
    store,
  });

  let kit;
  let source;
  let llmInfo = null;
  if (llm && llm.configured) {
    const user = JSON.stringify({
      job: {
        role: requirements.role,
        title: requirements.title,
        required_skills: requirements.required_skills,
        preferred_skills: requirements.preferred_skills,
        min_experience_years: requirements.min_experience,
        interview_rounds: requirements.interview_rounds,
      },
      // Job-relevant facts only: no name, contact details or education history.
      candidate: { skills: parsedResume?.skills || [], experience_years: parsedResume?.experience_years ?? null, projects: parsedResume?.projects || [] },
      gaps: matchResult?.missing_skills || [],
      question_count: spec.question_count,
      coding_task_count: spec.coding_task_count,
      coding_task_minutes: spec.coding_task_minutes,
      question_types: spec.question_types,
      rubric_levels: spec.rubric_levels,
      interview_guidelines: guidelines.map((g) => g.text),
    });
    try {
      const res = await llm.invokeJson({ system: spec.system_prompt, user, schema: buildSchema(spec), temperature: spec.temperature });
      kit = res.data;
      source = 'llm';
      llmInfo = { provider: res.provider, model: res.model };
    } catch (err) {
      if (spec.llm_failure_policy !== 'deterministic_fallback') throw err;
      kit = deterministicKit(spec, requirements, parsedResume, matchResult);
      source = 'deterministic_fallback';
      llmInfo = { error: err.code };
    }
  } else {
    kit = deterministicKit(spec, requirements, parsedResume, matchResult);
    source = 'deterministic_fallback';
  }

  // Fairness screen: drop any question touching a protected characteristic.
  const isProtected = protectedQuestionTest(fairness.excluded_attributes);
  const removed = kit.questions.filter((q) => isProtected(q.question)).map((q) => ({ question: q.question, reason: 'mentions a protected characteristic' }));
  const questions = kit.questions.filter((q) => !isProtected(q.question)).slice(0, spec.question_count);
  if (!questions.length) throw new AgentError('INVALID_SCHEMA', 'The interview kit has no usable questions');

  return {
    questions: questions.map((q, i) => ({ id: `q${i + 1}`, ...q })),
    // The time box is a spec rule (coding_task_minutes), not left to the model.
    coding_tasks: kit.coding_tasks.slice(0, spec.coding_task_count).map((c, i) => ({ id: `t${i + 1}`, ...c, time_minutes: spec.coding_task_minutes })),
    focus_areas: kit.focus_areas || [],
    interview_rounds: requirements.interview_rounds,
    rubric_levels: spec.rubric_levels,
    source,
    llm: llmInfo,
    guidelines: guidelines.map((g) => ({ ...g.source, score: g.score })),
    removed_questions: removed,
    spec_version: spec._meta.version,
  };
}

module.exports = { runInterviewAgent, deterministicKit, protectedTermsPattern, protectedQuestionTest, AGENT };
