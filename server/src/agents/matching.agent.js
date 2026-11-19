'use strict';

const { z } = require('zod');
const { getSpec } = require('../utils/specLoader');
const { skillKey, createSkillCanonicalizer, findSkillMentions } = require('../utils/skills');
const { redactContactInfo } = require('../utils/redact');
const { retrieveKnowledge, retrieveResumeEvidence } = require('../rag/retriever');

const AGENT = 'matching_agent';

const llmAssessmentSchema = z.object({
  assessments: z
    .array(z.object({ skill: z.string().min(1).max(100), matched: z.boolean(), evidence: z.string().max(1000).nullable().optional() }))
    .max(100),
  explanation: z.string().min(1).max(2000),
});

const round1 = (n) => Math.round(n * 10) / 10;
const squash = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** experience_scoring "linear_to_minimum": full points at or above the job minimum. */
function experienceRatio(years, minimum) {
  if (!minimum) return 1;
  if (years === null || years === undefined) return 0;
  return Math.min(1, Math.max(0, years / minimum));
}

/**
 * Deterministic, reproducible score (DECISION D13). A component with no
 * requirements (e.g. a job without preferred skills) scores fully, so
 * candidates are never penalised for requirements that do not exist.
 */
function computeScore({ requiredMatched, requiredTotal, preferredMatched, preferredTotal, years, minimum }, weights) {
  const req = requiredTotal ? requiredMatched / requiredTotal : 1;
  const pref = preferredTotal ? preferredMatched / preferredTotal : 1;
  const exp = experienceRatio(years, minimum);
  const points = {
    required: weights.required_skills * req * 100,
    preferred: weights.preferred_skills * pref * 100,
    experience: weights.experience * exp * 100,
  };
  return {
    match_score: round1(points.required + points.preferred + points.experience),
    score_breakdown: {
      weights,
      required: { matched: requiredMatched, total: requiredTotal, ratio: round1(req * 100) / 100, points: round1(points.required) },
      preferred: { matched: preferredMatched, total: preferredTotal, ratio: round1(pref * 100) / 100, points: round1(points.preferred) },
      experience: { candidate_years: years ?? null, minimum, ratio: round1(exp * 100) / 100, points: round1(points.experience) },
    },
  };
}

/** Short excerpt of `text` around the first mention of `skill`. */
function excerptAround(text, skill, aliases, maxChars) {
  const lines = text.split('\n');
  const line = lines.find((l) => findSkillMentions(l, [skill], aliases).length);
  if (!line) return null;
  return line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line;
}

function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_m, k) => values[k] ?? '');
}

function templateExplanation(result, requirements) {
  const r = result.score_breakdown.required;
  const p = result.score_breakdown.preferred;
  const e = result.score_breakdown.experience;
  const parts = [`Matched ${r.matched} of ${r.total} required skills${result.matched_required_skills.length ? ` (${result.matched_required_skills.join(', ')})` : ''}.`];
  const missingReq = requirements.required_skills.filter((s) => !result.matched_required_skills.includes(s));
  if (missingReq.length) parts.push(`Missing required: ${missingReq.join(', ')}.`);
  if (p.total) parts.push(`Matched ${p.matched} of ${p.total} preferred skills.`);
  parts.push(
    e.candidate_years === null
      ? `Years of experience could not be determined from the resume (minimum ${e.minimum}).`
      : `${e.candidate_years} years of experience against a minimum of ${e.minimum}.`
  );
  return parts.join(' ');
}

/**
 * Matching Agent: compares the parsed resume with the JOB's required and
 * preferred skills and minimum experience, using RAG context from hiring
 * policies/evaluation docs and resume chunks. The LLM can only add matches
 * backed by a verbatim quote from the resume; the score is computed here.
 *
 * Input: { candidateId, parsedResume, resumeText, requirements }
 */
async function runMatchingAgent({ candidateId, parsedResume, resumeText, requirements }, { llm, embedder, store }) {
  const spec = getSpec('prompts/matching-agent');
  const parserSpec = getSpec('prompts/resume-parser');
  const fairness = getSpec('evaluation/fairness-policy');
  const aliases = parserSpec.skill_aliases;
  const canonicalize = createSkillCanonicalizer([...requirements.required_skills, ...requirements.preferred_skills, ...parserSpec.known_skills], aliases);

  // 1. Deterministic evidence: parsed skills, project technologies and text mentions.
  const candidateKeys = new Set(
    [...parsedResume.skills, ...parsedResume.projects.flatMap((p) => p.technologies)].map((s) => skillKey(canonicalize(s)))
  );
  const jobSkills = [...requirements.required_skills, ...requirements.preferred_skills];
  const mentioned = new Set(findSkillMentions(resumeText, jobSkills, aliases).map(skillKey));
  const evidence = [];
  const matchedKeys = new Set();
  for (const skill of jobSkills) {
    const k = skillKey(skill);
    if (candidateKeys.has(k) || mentioned.has(k)) {
      matchedKeys.add(k);
      evidence.push({ skill, quote: excerptAround(resumeText, skill, aliases, spec.evidence.max_quote_chars), source: 'resume_text' });
    }
  }

  // 2. RAG context.
  const knowledge = await retrieveKnowledge({
    query: fillTemplate(spec.rag.knowledge_query_template, { role: requirements.role, skills: jobSkills.join(', ') }),
    docTypes: spec.rag.knowledge_doc_types,
    embedder,
    store,
  });
  const unmatched = jobSkills.filter((s) => !matchedKeys.has(skillKey(s)));
  const resumeHits = [];
  for (const skill of unmatched.slice(0, spec.rag.max_resume_queries)) {
    const hits = await retrieveResumeEvidence({ query: fillTemplate(spec.rag.resume_query_template, { skill }), candidateId: String(candidateId), embedder, store });
    for (const h of hits) if (!resumeHits.some((x) => x.id === h.id)) resumeHits.push({ ...h, query_skill: skill });
  }

  // 3. LLM assessment for skills without deterministic evidence.
  let explanation = null;
  let explanationSource = 'deterministic';
  let llmInfo = null;
  const rejected = [];
  if (llm && llm.configured) {
    const evidenceCorpus = squash([resumeText, ...parsedResume.projects.map((p) => `${p.name} ${p.description}`)].join('\n'));
    const user = JSON.stringify({
      job: {
        role: requirements.role,
        title: requirements.title,
        required_skills: requirements.required_skills,
        preferred_skills: requirements.preferred_skills,
        min_experience_years: requirements.min_experience,
      },
      // Only job-relevant facts: no name, contact details, institution or graduation years.
      candidate: {
        skills: parsedResume.skills,
        experience_years: parsedResume.experience_years,
        education: parsedResume.education.map((e) => ({ degree: e.degree, field: e.field })),
        projects: parsedResume.projects,
      },
      deterministic_matches: evidence.map((e) => e.skill),
      skills_to_assess: unmatched,
      resume_excerpts: resumeHits.map((h) => redactContactInfo(h.text, parserSpec.redact_before_llm)),
      policy_context: knowledge.map((k) => k.text),
    });
    let res = null;
    try {
      res = await llm.invokeJson({ system: spec.system_prompt, user, schema: llmAssessmentSchema, temperature: spec.temperature });
    } catch (err) {
      if (spec.llm_failure_policy !== 'deterministic_fallback') throw err;
      llmInfo = { error: err.code };
    }
    if (res) {
      llmInfo = { provider: res.provider, model: res.model };
      explanation = res.data.explanation;
      explanationSource = 'llm';
    }
    for (const a of res ? res.data.assessments : []) {
      const skill = unmatched.find((s) => skillKey(s) === skillKey(canonicalize(a.skill)));
      if (!skill || !a.matched) continue;
      const quote = (a.evidence || '').trim();
      const okLength = quote.length >= spec.evidence.min_quote_chars && quote.length <= spec.evidence.max_quote_chars;
      const verbatim = !spec.evidence.require_verbatim_quote || evidenceCorpus.includes(squash(quote));
      if (okLength && verbatim) {
        matchedKeys.add(skillKey(skill));
        evidence.push({ skill, quote, source: 'llm_verified_quote' });
      } else {
        rejected.push({ skill, reason: okLength ? 'quote not found in resume' : 'quote missing or wrong length' });
      }
    }
  }

  // 4. Score from the spec weights.
  const matchedRequired = requirements.required_skills.filter((s) => matchedKeys.has(skillKey(s)));
  const matchedPreferred = requirements.preferred_skills.filter((s) => matchedKeys.has(skillKey(s)));
  const scored = computeScore(
    {
      requiredMatched: matchedRequired.length,
      requiredTotal: requirements.required_skills.length,
      preferredMatched: matchedPreferred.length,
      preferredTotal: requirements.preferred_skills.length,
      years: parsedResume.experience_years,
      minimum: requirements.min_experience,
    },
    spec.weights
  );
  const missingRequired = requirements.required_skills.filter((s) => !matchedKeys.has(skillKey(s)));
  const missingPreferred = requirements.preferred_skills.filter((s) => !matchedKeys.has(skillKey(s)));

  const result = {
    matched_required_skills: matchedRequired,
    matched_preferred_skills: matchedPreferred,
    missing_skills: [...missingRequired, ...missingPreferred],
    missing_required_skills: missingRequired,
    all_skills_matched: missingRequired.length === 0 && missingPreferred.length === 0,
    ...scored,
  };

  return {
    ...result,
    explanation: explanation || templateExplanation(result, requirements),
    explanation_source: explanationSource,
    evidence,
    rejected_llm_claims: rejected,
    rag_context: {
      knowledge: knowledge.map((k) => ({ ...k.source, score: k.score })),
      resume: resumeHits.map((h) => ({ chunk_index: h.source.chunk_index, score: h.score, query_skill: h.query_skill })),
      minimum_similarity: getSpec('evaluation/rag-retrieval').retrieval.minimum_similarity,
    },
    excluded_from_scoring: fairness.never_send_to_scoring_prompts,
    llm: llmInfo,
    requirements: {
      job_id: requirements.job_id,
      required_skills: requirements.required_skills,
      preferred_skills: requirements.preferred_skills,
      min_experience: requirements.min_experience,
      hiring_spec: requirements.hiring_spec,
    },
    spec_version: spec._meta.version,
  };
}

module.exports = { runMatchingAgent, computeScore, experienceRatio, llmAssessmentSchema, AGENT };
