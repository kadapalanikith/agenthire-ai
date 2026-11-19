'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SPEC_SCHEMAS, hiringSpec } = require('./specSchemas');

const DEFAULT_SPECS_DIR = path.resolve(__dirname, '../../../specs');
const HIRING_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class SpecError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SpecError';
    this.code = 'INVALID_SPEC';
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function readJson(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new SpecError(`Spec file not found or unreadable: ${file} (${err.code})`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new SpecError(`Spec file is not valid JSON: ${file} (${err.message})`);
  }
}

function validate(schema, data, label) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `    - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new SpecError(`Spec "${label}" failed validation:\n${issues}`);
  }
  return result.data;
}

function loadHiringSpecs(specsDir) {
  const dir = path.join(specsDir, 'hiring');
  if (!fs.existsSync(dir)) throw new SpecError(`Missing hiring spec directory: ${dir}`);
  const hiring = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const id = path.basename(file, '.json');
    if (!HIRING_ID_PATTERN.test(id)) throw new SpecError(`Hiring spec file name must be kebab-case: ${file}`);
    const spec = validate(hiringSpec, readJson(path.join(dir, file)), `hiring/${id}`);
    if (spec._meta.id !== id) throw new SpecError(`hiring/${id}: _meta.id must equal the file name ("${id}")`);
    hiring[id] = spec;
  }
  if (Object.keys(hiring).length === 0) throw new SpecError('At least one hiring spec is required in specs/hiring/');
  return hiring;
}

function crossValidate(specs) {
  const workflow = specs['workflow/default-hiring-workflow'];
  for (const ref of [workflow.retry_policy_ref, workflow.node_states_ref]) {
    if (!specs[ref]) throw new SpecError(`workflow/default-hiring-workflow references unknown spec "${ref}"`);
  }
  for (const [from, decisions] of Object.entries(workflow.branches)) {
    for (const [decision, branch] of Object.entries(decisions)) {
      if (!specs[`email/${branch.email_template}`]) {
        throw new SpecError(`branches.${from}.${decision}.email_template "${branch.email_template}" has no specs/email file`);
      }
    }
  }
  const ragTypes = specs['evaluation/rag-retrieval'].knowledge_doc_types;
  for (const key of ['prompts/matching-agent', 'prompts/interview-agent']) {
    for (const t of specs[key].rag.knowledge_doc_types) {
      if (!ragTypes.includes(t)) throw new SpecError(`${key}: rag.knowledge_doc_types "${t}" is not defined in evaluation/rag-retrieval`);
    }
  }
  for (const [key, spec] of Object.entries(specs)) {
    const expectedId = key.split('/').pop();
    if (spec._meta.id !== expectedId) throw new SpecError(`${key}: _meta.id must be "${expectedId}"`);
  }
}

/**
 * Load and validate every spec file. Returns a deeply frozen registry so
 * business rules cannot be mutated at runtime.
 */
function loadSpecs(specsDir = DEFAULT_SPECS_DIR) {
  const specs = {};
  for (const [key, schema] of Object.entries(SPEC_SCHEMAS)) {
    specs[key] = validate(schema, readJson(path.join(specsDir, `${key}.json`)), key);
  }
  crossValidate(specs);
  const hiring = loadHiringSpecs(specsDir);

  const versions = {};
  for (const [key, spec] of Object.entries(specs)) versions[key] = spec._meta.version;
  for (const [id, spec] of Object.entries(hiring)) versions[`hiring/${id}`] = spec._meta.version;

  return deepFreeze({ specsDir, specs, hiring, versions });
}

let registry;

/** Initialise the process-wide registry (called once at startup). */
function initSpecs(specsDir) {
  registry = loadSpecs(specsDir);
  return registry;
}

function ensure() {
  if (!registry) initSpecs();
  return registry;
}

/** Get a fixed spec by key, e.g. getSpec('system/retry-policy'). */
function getSpec(key) {
  const spec = ensure().specs[key];
  if (!spec) throw new SpecError(`Unknown spec "${key}"`);
  return spec;
}

/** Get a role hiring spec by id, or null when it does not exist. */
function getHiringSpec(id) {
  return ensure().hiring[id] || null;
}

function listHiringSpecs() {
  return Object.values(ensure().hiring).map((s) => ({ id: s._meta.id, role: s.role, version: s._meta.version }));
}

function getSpecVersions() {
  return ensure().versions;
}

module.exports = {
  loadSpecs,
  initSpecs,
  getSpec,
  getHiringSpec,
  listHiringSpecs,
  getSpecVersions,
  SpecError,
  DEFAULT_SPECS_DIR,
};
