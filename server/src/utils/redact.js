'use strict';

const PATTERNS = {
  email: { re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, token: '[EMAIL]' },
  url: { re: /\b(?:https?:\/\/|www\.)[^\s)]+/gi, token: '[URL]' },
  // 7+ digits with common separators; avoids short numbers like years or "4 years".
  phone: { re: /(?:\+?\d[\d\s().-]{6,}\d)/g, token: '[PHONE]' },
};

// Date ranges such as "2019 - 2023" or "(2018-2020)" are experience data, not phone numbers.
const YEAR_RANGE = /^\(?(?:19|20)\d{2}\)?(?:\s*[-–/.]\s*\(?(?:19|20)\d{2}\)?)*$/;

/**
 * Remove contact details before text is sent to an LLM. `kinds` comes from
 * the prompt spec (redact_before_llm). Order matters: emails and URLs are
 * removed before phone numbers so their digits are not mis-detected.
 */
function redactContactInfo(text, kinds) {
  let out = text;
  for (const kind of ['email', 'url', 'phone']) {
    if (!kinds.includes(kind)) continue;
    const { re, token } = PATTERNS[kind];
    out = out.replace(re, (m) => {
      if (kind === 'phone' && (m.replace(/\D/g, '').length < 7 || YEAR_RANGE.test(m.trim()))) return m;
      return token;
    });
  }
  return out;
}

/** Drop object keys that name excluded (protected) attributes, recursively. */
function stripExcludedAttributes(value, excluded) {
  const banned = new Set(excluded.map((k) => k.toLowerCase()));
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        if (!banned.has(k.toLowerCase())) out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(value);
}

module.exports = { redactContactInfo, stripExcludedAttributes };
