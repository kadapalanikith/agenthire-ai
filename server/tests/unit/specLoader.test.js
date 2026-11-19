'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadSpecs, SpecError, DEFAULT_SPECS_DIR } = require('../../src/utils/specLoader');

function copySpecs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthire-specs-'));
  fs.cpSync(DEFAULT_SPECS_DIR, dir, { recursive: true });
  return dir;
}

function mutate(dir, key, fn) {
  const file = path.join(dir, `${key}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  fn(json);
  fs.writeFileSync(file, JSON.stringify(json));
}

function expectInvalid(key, fn, pattern) {
  const dir = copySpecs();
  try {
    mutate(dir, key, fn);
    expect(() => loadSpecs(dir)).toThrow(SpecError);
    expect(() => loadSpecs(dir)).toThrow(pattern);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('spec loader', () => {
  test('loads and validates every spec file in /specs', () => {
    const { specs, hiring, versions } = loadSpecs();
    expect(specs['workflow/default-hiring-workflow'].workflow).toEqual([
      'resume_parser',
      'embedding_agent',
      'matching_agent',
      'shortlisting_agent',
      'human_approval',
      'interview_agent',
      'email_agent',
    ]);
    expect(specs['system/retry-policy']).toMatchObject({ max_retries: 3, retry_delay_ms: 5000 });
    expect(specs['evaluation/rag-retrieval'].retrieval).toEqual({ top_k: 5, minimum_similarity: 0.75 });
    expect(hiring['frontend-developer'].required_skills).toEqual(['React', 'JavaScript', 'CSS']);
    expect(Object.keys(specs['workflow/node-states'].states)).toEqual(
      expect.arrayContaining(['pending', 'running', 'success', 'failed', 'waiting_approval', 'skipped'])
    );
    expect(versions['hiring/frontend-developer']).toBe('1.0.0');
  });

  test('returns a deeply frozen registry', () => {
    const { specs } = loadSpecs();
    const bands = specs['evaluation/shortlisting-rules'].bands;
    expect(Object.isFrozen(bands)).toBe(true);
    expect(() => {
      bands[0].min_score = 1;
    }).toThrow(TypeError);
  });

  test('rejects shortlisting bands that are not strictly descending', () => {
    expectInvalid('evaluation/shortlisting-rules', (j) => {
      j.bands[1].min_score = 90;
    }, /strictly descending/);
  });

  test('rejects bands that leave scores unmapped', () => {
    expectInvalid('evaluation/shortlisting-rules', (j) => {
      j.bands[2].min_score = 10;
    }, /score_range.min/);
  });

  test('rejects a shortlisting spec that allows automatic final decisions', () => {
    expectInvalid('evaluation/shortlisting-rules', (j) => {
      j.requires_human_approval = false;
    }, /requires_human_approval/);
  });

  test('rejects a workflow missing an agent node', () => {
    expectInvalid('workflow/default-hiring-workflow', (j) => {
      j.workflow = j.workflow.filter((n) => n !== 'human_approval');
    }, /missing: human_approval/);
  });

  test('rejects unknown workflow nodes', () => {
    expectInvalid('workflow/default-hiring-workflow', (j) => {
      j.workflow.push('chatbot_agent');
    }, /workflow/);
  });

  test('rejects a branch that points backwards', () => {
    expectInvalid('workflow/default-hiring-workflow', (j) => {
      j.branches.human_approval.approve.next = 'matching_agent';
    }, /after its source node/);
  });

  test('rejects node-states missing the skipped state', () => {
    expectInvalid('workflow/node-states', (j) => {
      delete j.states.skipped;
    }, /skipped/);
  });

  test('rejects matching weights that do not sum to 1', () => {
    expectInvalid('prompts/matching-agent', (j) => {
      j.weights.experience = 0.5;
    }, /sum to 1/);
  });

  test('rejects undeclared email template placeholders', () => {
    expectInvalid('email/rejection', (j) => {
      j.text += ' {{secret_value}}';
    }, /not declared/);
  });

  test('rejects malformed JSON', () => {
    const dir = copySpecs();
    try {
      fs.writeFileSync(path.join(dir, 'system/retry-policy.json'), '{ not json');
      expect(() => loadSpecs(dir)).toThrow(/not valid JSON/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a hiring spec whose id does not match its file name', () => {
    expectInvalid('hiring/frontend-developer', (j) => {
      j._meta.id = 'backend-developer';
    }, /must equal the file name/);
  });
});
