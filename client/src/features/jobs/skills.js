/** Split comma/newline separated input into trimmed skill names. */
export function parseSkillInput(text) {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/** Append skills, skipping case-insensitive duplicates (mirrors server normalisation). */
export function mergeSkills(existing, additions) {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const out = [...existing];
  for (const skill of additions) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(skill);
    }
  }
  return out;
}

export function findOverlap(required, preferred) {
  const req = new Set(required.map((s) => s.toLowerCase()));
  return preferred.filter((s) => req.has(s.toLowerCase()));
}
