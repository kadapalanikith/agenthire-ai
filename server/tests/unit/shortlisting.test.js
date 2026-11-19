'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runShortlistingAgent } = require('../../src/agents/shortlisting.agent');
const { resolveApproval, isOverride } = require('../../src/agents/humanApproval.agent');
const { initSpecs, DEFAULT_SPECS_DIR } = require('../../src/utils/specLoader');

const req = (minimum_score = 75) => ({ minimum_score, hiring_spec: { id: 'frontend-developer', version: '1.0.0' } });

afterEach(() => initSpecs()); // restore the real /specs registry

describe('Shortlisting Agent (specs/evaluation/shortlisting-rules.json)', () => {
  test.each([
    [100, 'shortlisted'],
    [80, 'shortlisted'],
    [79.9, 'hold'],
    [60, 'hold'],
    [59.9, 'rejected'],
    [0, 'rejected'],
  ])('score %s → %s with the current bands', (score, decision) => {
    expect(runShortlistingAgent({ matchScore: score, requirements: req() }).decision).toBe(decision);
  });

  test('records a full, explainable trace and is a recommendation only', () => {
    const out = runShortlistingAgent({ matchScore: 85, requirements: req() });
    expect(out).toMatchObject({
      decision: 'shortlisted',
      applied_band: { decision: 'shortlisted', min_score: 80, effective_min_score: 80 },
      role_minimum_score: 75,
      role_minimum_score_policy: 'stricter_only',
      role_minimum_applied: false,
      recommendation_only: true,
      requires_human_approval: true,
      spec_version: '1.0.0',
    });
    expect(out.thresholds.map((t) => t.decision)).toEqual(['shortlisted', 'hold', 'rejected']);
  });

  test('stricter_only: a role minimum above the band raises the shortlist bar but never lowers it', () => {
    const strict = runShortlistingAgent({ matchScore: 82, requirements: req(85) });
    expect(strict.decision).toBe('hold');
    expect(strict.thresholds[0].effective_min_score).toBe(85);
    expect(strict.role_minimum_applied).toBe(true);
    const lenient = runShortlistingAgent({ matchScore: 77, requirements: req(70) });
    expect(lenient.decision).toBe('hold'); // 70 does not lower the 80 shortlist bar
    expect(lenient.thresholds[0].effective_min_score).toBe(80);
  });

  test('thresholds are read from the spec file, never hardcoded', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthire-rules-'));
    try {
      fs.cpSync(DEFAULT_SPECS_DIR, dir, { recursive: true });
      const file = path.join(dir, 'evaluation/shortlisting-rules.json');
      const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
      rules.bands = [
        { decision: 'shortlisted', min_score: 90 },
        { decision: 'hold', min_score: 70 },
        { decision: 'rejected', min_score: 0 },
      ];
      fs.writeFileSync(file, JSON.stringify(rules));
      initSpecs(dir);
      expect(runShortlistingAgent({ matchScore: 85, requirements: req() }).decision).toBe('hold');
      expect(runShortlistingAgent({ matchScore: 65, requirements: req() }).decision).toBe('rejected');
      expect(runShortlistingAgent({ matchScore: 90, requirements: req() }).decision).toBe('shortlisted');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a missing score', () => {
    expect(() => runShortlistingAgent({ matchScore: undefined, requirements: req() })).toThrow(/numeric/);
  });
});

describe('Human approval decision rules', () => {
  const rec = (decision) => ({ decision, match_score: 50 });
  const base = { decided_by: 'a'.repeat(24), decided_at: new Date().toISOString() };

  test('identifies overrides of the AI recommendation', () => {
    expect(isOverride('approve', 'rejected')).toBe(true);
    expect(isOverride('reject', 'shortlisted')).toBe(true);
    expect(isOverride('approve', 'hold')).toBe(false);
    expect(isOverride('reject', 'hold')).toBe(false);
  });

  test('an override requires a reason of the spec minimum length', () => {
    expect(() => resolveApproval({ ...base, decision: 'approve' }, rec('rejected'))).toThrow(/reason/);
    const ok = resolveApproval({ ...base, decision: 'approve', reason: 'Strong portfolio outside the resume' }, rec('rejected'));
    expect(ok).toMatchObject({ decision: 'approve', overridden: true, ai_recommendation: 'rejected' });
  });

  test('agreeing with the recommendation needs no reason', () => {
    expect(resolveApproval({ ...base, decision: 'reject' }, rec('rejected'))).toMatchObject({ overridden: false, reason: null });
  });
});
