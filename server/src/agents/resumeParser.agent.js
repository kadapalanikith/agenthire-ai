'use strict';

const { z } = require('zod');
const { getSpec } = require('../utils/specLoader');
const { extractPdfText } = require('../utils/pdfText');
const { redactContactInfo, stripExcludedAttributes } = require('../utils/redact');
const { createSkillCanonicalizer, canonicalizeSkillList, findSkillMentions } = require('../utils/skills');
const { AgentError } = require('../workflows/errors');

const AGENT = 'resume_parser';

const nullableString = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(300).nullable());
const nullableYear = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().min(1950).max(2100).nullable());

/** Output contract of the parser (LLM output is validated against it). */
const parsedResumeSchema = z.object({
  name: nullableString.default(null),
  skills: z.array(z.string().trim().min(1).max(60)).max(150).default([]),
  experience_years: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(0).max(60).nullable()).default(null),
  education: z
    .array(z.object({ institution: z.string().trim().min(1).max(200), degree: nullableString.default(null), field: nullableString.default(null), year: nullableYear.default(null) }))
    .max(20)
    .default([]),
  projects: z
    .array(z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(1000).default(''), technologies: z.array(z.string().trim().min(1).max(60)).max(30).default([]) }))
    .max(30)
    .default([]),
});

const DEGREE_RE = /\b(bachelor|master|ph\.?d|doctorate|associate|b\.?\s?(?:sc|s|a|tech|e|eng)\b|m\.?\s?(?:sc|s|a|tech|eng|ba)\b|mba|diploma)/i;
const SECTION_RE = /^(experience|work experience|employment|education|projects?|skills|technical skills|summary|profile|certifications?|awards?|languages?)\s*:?$/i;

/** Largest "N years" figure stated in the text, or null. */
function extractExperienceYears(text) {
  const values = [...text.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b/gi)].map((m) => Number(m[1]));
  const plausible = values.filter((v) => v >= 0 && v <= 60);
  return plausible.length ? Math.max(...plausible) : null;
}

function sectionLines(text, header) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^${header}\\s*:?$`, 'i').test(l.trim()));
  if (start === -1) return [];
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (SECTION_RE.test(line.trim())) break;
    if (line.trim()) out.push(line.trim());
  }
  return out;
}

/**
 * Rule-based extraction used when no LLM provider is configured. It is
 * real extraction from the PDF text, clearly tagged as a fallback.
 */
function deterministicParse(text, canonicalSkills, aliases) {
  const skills = findSkillMentions(text, canonicalSkills, aliases);
  const education = text
    .split('\n')
    .filter((l) => DEGREE_RE.test(l))
    .slice(0, 5)
    .map((l) => {
      const year = l.match(/\b(19[5-9]\d|20\d{2})\b/g);
      return { institution: l.slice(0, 200), degree: (l.match(DEGREE_RE) || [null])[0], field: null, year: year ? Number(year[year.length - 1]) : null };
    });
  const projects = sectionLines(text, 'projects?')
    .slice(0, 10)
    .map((line) => {
      const [name, ...rest] = line.replace(/^[-•*]\s*/, '').split(/\s[-–:]\s/);
      return { name: name.slice(0, 200), description: rest.join(' - ').slice(0, 1000), technologies: findSkillMentions(line, canonicalSkills, aliases) };
    });
  return { name: null, skills, experience_years: extractExperienceYears(text), education, projects };
}

/**
 * Resume Parser Agent.
 * Input: { resumeBuffer, requirements } (requirements from mergeJobRequirements).
 * Output: { resume_text, parsed_resume, parse_source, llm, text_stats }.
 * Prompt, temperature, known skills, aliases, redaction and failure policy
 * come from specs/prompts/resume-parser.json.
 */
async function runResumeParser({ resumeBuffer, requirements }, { llm }) {
  const spec = getSpec('prompts/resume-parser');
  const fairness = getSpec('evaluation/fairness-policy');

  const { text: fullText, pages } = await extractPdfText(resumeBuffer, { minChars: spec.min_text_chars });
  const text = fullText.slice(0, spec.max_resume_chars);

  // The parser respects both the spec's known skills and this job's skills.
  const canonicalSkills = [...new Set([...spec.known_skills, ...requirements.required_skills, ...requirements.preferred_skills])];
  const canonicalize = createSkillCanonicalizer(canonicalSkills, spec.skill_aliases);

  let raw;
  let source;
  let llmInfo = null;
  if (llm && llm.configured) {
    const user = JSON.stringify({
      known_skills: canonicalSkills,
      resume_text: redactContactInfo(text, spec.redact_before_llm),
    });
    try {
      const res = await llm.invokeJson({ system: spec.system_prompt, user, schema: parsedResumeSchema, temperature: spec.temperature });
      raw = res.data;
      source = 'llm';
      llmInfo = { provider: res.provider, model: res.model };
    } catch (err) {
      if (spec.llm_failure_policy !== 'deterministic_fallback') throw err;
      raw = deterministicParse(text, canonicalSkills, spec.skill_aliases);
      source = 'deterministic_fallback';
      llmInfo = { error: err.code };
    }
  } else {
    raw = deterministicParse(text, canonicalSkills, spec.skill_aliases);
    source = 'deterministic_fallback';
  }

  // Never keep protected characteristics, whatever the LLM returned.
  const safe = stripExcludedAttributes(raw, fairness.excluded_attributes);
  const checked = parsedResumeSchema.safeParse(safe);
  if (!checked.success) throw new AgentError('INVALID_SCHEMA', `${AGENT} produced output that does not match its schema`);
  const parsed = checked.data;
  parsed.skills = canonicalizeSkillList(parsed.skills, canonicalize);
  parsed.projects = parsed.projects.map((p) => ({ ...p, technologies: canonicalizeSkillList(p.technologies, canonicalize) }));

  return {
    resume_text: text,
    parsed_resume: parsed,
    parse_source: source,
    llm: llmInfo,
    text_stats: { pages, chars: text.length, truncated: fullText.length > text.length },
    spec_version: spec._meta.version,
  };
}

module.exports = { runResumeParser, parsedResumeSchema, deterministicParse, extractExperienceYears, AGENT };
