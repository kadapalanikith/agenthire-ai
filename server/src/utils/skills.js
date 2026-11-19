'use strict';

/**
 * Skill normalisation shared by the parser and matching agents. Canonical
 * names and aliases come from specs/prompts/resume-parser.json.
 */

/** Comparison key: lowercase, without spaces, dots, hyphens or underscores ("Next.js" → "nextjs"). */
function skillKey(skill) {
  return String(skill)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\s._-]+/g, '');
}

/**
 * Build a canonicaliser from canonical names (known skills plus job skills)
 * and aliases. Unknown skills are returned trimmed as written.
 */
function createSkillCanonicalizer(canonicalNames, aliases = {}) {
  const byKey = new Map();
  for (const name of canonicalNames) byKey.set(skillKey(name), name);
  for (const [alias, target] of Object.entries(aliases)) {
    const canonical = byKey.get(skillKey(target)) || target;
    byKey.set(skillKey(alias), canonical);
  }
  return function canonicalize(skill) {
    const trimmed = String(skill).trim().replace(/\s+/g, ' ');
    return byKey.get(skillKey(trimmed)) || trimmed;
  };
}

/** Canonicalise and de-duplicate a list (first occurrence wins). */
function canonicalizeSkillList(skills, canonicalize) {
  const seen = new Set();
  const out = [];
  for (const s of skills) {
    if (typeof s !== 'string' || !s.trim()) continue;
    const c = canonicalize(s);
    const k = skillKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find which of `skills` are mentioned in `text`, including aliases. Matches
 * respect word boundaries so "Java" does not match "JavaScript" and "Go"
 * does not match "Google".
 */
function findSkillMentions(text, skills, aliases = {}) {
  const found = [];
  for (const skill of skills) {
    const variants = new Set([skill]);
    for (const [alias, target] of Object.entries(aliases)) {
      if (skillKey(target) === skillKey(skill)) variants.add(alias);
    }
    const matched = [...variants].some((v) => {
      const pattern = escapeRegex(v).replace(/\\\./g, '\\.?').replace(/\s+/g, '[\\s-]?');
      return new RegExp(`(^|[^A-Za-z0-9+#])${pattern}(?![A-Za-z0-9+#])`, 'i').test(text);
    });
    if (matched) found.push(skill);
  }
  return found;
}

module.exports = { skillKey, createSkillCanonicalizer, canonicalizeSkillList, findSkillMentions };
