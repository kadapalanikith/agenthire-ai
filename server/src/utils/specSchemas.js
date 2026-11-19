'use strict';

const { z } = require('zod');
const {
  AGENT_NODES,
  NODE_STATUSES,
  RECOMMENDATIONS,
  APPROVAL_DECISIONS,
} = require('../constants/workflow');

/**
 * Zod schemas for every file under /specs. Specs are the business-rule
 * contract, so a malformed file must stop the server at startup rather
 * than fail later inside a workflow.
 */

const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'must be a semantic version (x.y.z)');

const meta = z.object({
  id: z.string().min(1),
  version: semver,
  provenance: z.string().min(1),
});

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be a #RRGGBB colour');
const skillList = z.array(z.string().trim().min(1)).refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, {
  message: 'skills must be unique (case-insensitive)',
});
const agentNode = z.enum(AGENT_NODES);
const score = z.number().min(0).max(100);

const hiringSpec = z.object({
  _meta: meta,
  role: z.string().min(1),
  required_skills: skillList.min(1),
  preferred_skills: skillList,
  minimum_score: score,
  interview_rounds: z.number().int().min(1).max(10),
});

const workflowSpec = z
  .object({
    _meta: meta,
    workflow: z.array(agentNode).min(1),
    node_labels: z.record(agentNode, z.string().min(1).max(40)),
    checkpoint_nodes: z.array(agentNode),
    branches: z.partialRecord(
      agentNode,
      z.record(
        z.enum(APPROVAL_DECISIONS),
        z.object({
          next: agentNode,
          skip: z.array(agentNode).optional(),
          email_template: z.string().min(1),
        })
      )
    ),
    retry_policy_ref: z.string().min(1),
    node_states_ref: z.string().min(1),
  })
  .superRefine((spec, ctx) => {
    const seen = new Set(spec.workflow);
    if (seen.size !== spec.workflow.length) {
      ctx.addIssue({ code: 'custom', path: ['workflow'], message: 'workflow nodes must be unique' });
    }
    const missing = AGENT_NODES.filter((n) => !seen.has(n));
    if (missing.length) {
      ctx.addIssue({ code: 'custom', path: ['workflow'], message: `workflow must include every agent node; missing: ${missing.join(', ')}` });
    }
    for (const node of spec.checkpoint_nodes) {
      if (!seen.has(node)) ctx.addIssue({ code: 'custom', path: ['checkpoint_nodes'], message: `${node} is not in workflow` });
    }
    for (const [from, decisions] of Object.entries(spec.branches)) {
      const fromIdx = spec.workflow.indexOf(from);
      for (const [decision, branch] of Object.entries(decisions)) {
        const path = ['branches', from, decision];
        if (spec.workflow.indexOf(branch.next) <= fromIdx) {
          ctx.addIssue({ code: 'custom', path, message: 'branch target must come after its source node' });
        }
        for (const s of branch.skip || []) {
          if (spec.workflow.indexOf(s) <= fromIdx) {
            ctx.addIssue({ code: 'custom', path, message: `skipped node ${s} must come after ${from}` });
          }
        }
      }
    }
  });

const colorSet = z.object({ fg: hexColor, bg: hexColor, border: hexColor });
const nodeStatesSpec = z
  .object({
    _meta: meta,
    states: z.record(z.enum(NODE_STATUSES), z.object({ label: z.string().min(1), light: colorSet, dark: colorSet })),
  })
  .superRefine((spec, ctx) => {
    const missing = NODE_STATUSES.filter((s) => !spec.states[s]);
    if (missing.length) ctx.addIssue({ code: 'custom', path: ['states'], message: `missing node states: ${missing.join(', ')}` });
  });

const retryPolicySpec = z.object({
  _meta: meta,
  max_retries: z.number().int().min(0).max(10),
  retry_delay_ms: z.number().int().min(0).max(600000),
  backoff_multiplier: z.number().min(1).max(10),
  retryable_errors: z.array(z.string().min(1)).min(1),
  non_retryable_errors: z.array(z.string().min(1)).min(1),
});

const rateLimit = z.object({ window_ms: z.number().int().positive(), max: z.number().int().positive() });

const uploadPolicySpec = z.object({
  _meta: meta,
  resume: z.object({
    allowed_mime_types: z.array(z.string().min(1)).min(1),
    allowed_extensions: z.array(z.string().regex(/^\.[a-z0-9]+$/)).min(1),
    max_size_bytes: z.number().int().positive().max(50 * 1024 * 1024),
    require_pdf_signature: z.boolean(),
  }),
  rate_limits: z.object({ application_upload: rateLimit, application_status: rateLimit }),
  resume_access_link_ttl_seconds: z.number().int().min(30).max(3600),
});
const authPolicySpec = z.object({
  _meta: meta,
  password: z
    .object({
      min_length: z.number().int().min(8),
      max_length: z.number().int().max(1024),
      require_letter: z.boolean(),
      require_number: z.boolean(),
    })
    .refine((p) => p.max_length >= p.min_length, { message: 'max_length must be >= min_length' }),
  bcrypt_rounds: z.number().int().min(10).max(15),
  password_reset: z.object({ token_ttl_minutes: z.number().int().min(5).max(1440) }),
  signup_default_role: z.literal('recruiter'),
  rate_limits: z.object({ auth: rateLimit, password_reset: rateLimit, general: rateLimit }),
});

const shortlistingRulesSpec = z
  .object({
    _meta: meta,
    score_range: z.object({ min: z.number(), max: z.number() }),
    bands: z.array(z.object({ decision: z.enum(RECOMMENDATIONS), min_score: score })).min(2),
    role_minimum_score_policy: z.object({
      mode: z.enum(['stricter_only']),
      applies_to: z.enum(RECOMMENDATIONS),
      description: z.string().min(1),
    }),
    recommendation_only: z.literal(true),
    requires_human_approval: z.literal(true),
    override_requires_reason: z.boolean(),
  })
  .superRefine((spec, ctx) => {
    const { bands } = spec;
    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i].min_score >= bands[i - 1].min_score) {
        ctx.addIssue({ code: 'custom', path: ['bands', i], message: 'bands must be ordered by strictly descending min_score' });
      }
    }
    if (bands[bands.length - 1].min_score !== spec.score_range.min) {
      ctx.addIssue({ code: 'custom', path: ['bands'], message: 'lowest band must start at score_range.min so every score maps to a decision' });
    }
    if (new Set(bands.map((b) => b.decision)).size !== bands.length) {
      ctx.addIssue({ code: 'custom', path: ['bands'], message: 'each decision may appear in only one band' });
    }
    if (!bands.some((b) => b.decision === spec.role_minimum_score_policy.applies_to)) {
      ctx.addIssue({ code: 'custom', path: ['role_minimum_score_policy', 'applies_to'], message: 'must reference an existing band' });
    }
  });

const chunking = z.object({ chunk_size: z.number().int().min(50).max(8000), chunk_overlap: z.number().int().min(0) });
const ragRetrievalSpec = z
  .object({
    _meta: meta,
    embedding_model: z.string().min(1),
    vector_size: z.number().int().positive(),
    distance: z.enum(['Cosine', 'Dot', 'Euclid']),
    query_instruction: z.string(),
    chunking: z.object({ resume: chunking, policy: chunking }),
    retrieval: z.object({
      top_k: z.number().int().min(1).max(50),
      // Knowledge documents (hiring policies, evaluation docs, interview guidelines).
      minimum_similarity: z.number().min(0).max(1),
      // The candidate's own resume chunks (already filtered by candidate_id).
      resume_minimum_similarity: z.number().min(0).max(1),
    }),
    collections: z.object({ resumes: z.string().min(1), knowledge: z.string().min(1) }),
    knowledge_doc_types: z.array(z.string().min(1)).min(1),
    knowledge_sources: z
      .array(z.object({ dir: z.string().regex(/^knowledge\/[a-z0-9-]+$/), doc_type: z.string().min(1) }))
      .min(1),
  })
  .superRefine((spec, ctx) => {
    for (const c of ['resume', 'policy']) {
      if (spec.chunking[c].chunk_overlap >= spec.chunking[c].chunk_size) {
        ctx.addIssue({ code: 'custom', path: ['chunking', c, 'chunk_overlap'], message: 'overlap must be smaller than chunk_size' });
      }
    }
    for (const [i, src] of spec.knowledge_sources.entries()) {
      if (!spec.knowledge_doc_types.includes(src.doc_type)) {
        ctx.addIssue({ code: 'custom', path: ['knowledge_sources', i, 'doc_type'], message: `unknown doc_type ${src.doc_type}` });
      }
    }
  });

const fairnessPolicySpec = z.object({
  _meta: meta,
  excluded_attributes: z.array(z.string().min(1)).min(1),
  never_send_to_scoring_prompts: z.array(z.string().min(1)),
  decision_inputs_allowed: z.array(z.string().min(1)).min(1),
  auto_final_decisions: z.literal(false),
  override_reason_min_length: z.number().int().min(1).max(500),
});

const temperature = z.number().min(0).max(2);
const llmFailurePolicy = z.enum(['fail', 'deterministic_fallback']);

const resumeParserPrompt = z.object({
  _meta: meta,
  temperature,
  max_resume_chars: z.number().int().positive(),
  min_text_chars: z.number().int().min(1),
  llm_failure_policy: llmFailurePolicy,
  redact_before_llm: z.array(z.enum(['email', 'phone', 'url'])),
  system_prompt: z.string().min(20),
  known_skills: skillList.min(1),
  skill_aliases: z.record(z.string().regex(/^[a-z0-9.+#-]+$/, 'alias keys must be lowercase'), z.string().min(1)),
  output_schema: z.record(z.string(), z.unknown()),
});

const matchingAgentPrompt = z.object({
  _meta: meta,
  temperature,
  llm_failure_policy: llmFailurePolicy,
  weights: z
    .object({ required_skills: z.number().min(0), preferred_skills: z.number().min(0), experience: z.number().min(0) })
    .refine((w) => Math.abs(w.required_skills + w.preferred_skills + w.experience - 1) < 1e-9, {
      message: 'weights must sum to 1',
    }),
  experience_scoring: z.enum(['linear_to_minimum']),
  evidence: z.object({
    require_verbatim_quote: z.boolean(),
    min_quote_chars: z.number().int().min(1),
    max_quote_chars: z.number().int().min(10),
  }),
  rag: z.object({
    knowledge_doc_types: z.array(z.string().min(1)).min(1),
    knowledge_query_template: z.string().includes('{role}'),
    resume_query_template: z.string().includes('{skill}'),
    max_resume_queries: z.number().int().min(0).max(50),
  }),
  system_prompt: z.string().min(20),
  output_fields: z.array(z.string().min(1)).min(1),
});

const interviewAgentPrompt = z
  .object({
    _meta: meta,
    temperature,
    llm_failure_policy: llmFailurePolicy,
    question_count: z.number().int().min(1).max(30),
    coding_task_count: z.number().int().min(0).max(10),
    coding_task_minutes: z.number().int().min(5).max(240),
    question_types: z.array(z.string().regex(/^[a-z_]+$/)).min(1),
    rubric_levels: z.array(z.string().regex(/^[a-z_]+$/)).min(2),
    rag: z.object({
      knowledge_doc_types: z.array(z.string().min(1)).min(1),
      query_template: z.string().includes('{role}'),
    }),
    system_prompt: z.string().min(20),
    fallback_templates: z.object({
      experience_question: z.string().includes('{skill}'),
      gap_question: z.string().includes('{skill}'),
      project_question: z.string().includes('{project}'),
      coding_task_title: z.string().includes('{skill}'),
      coding_task_prompt: z.string().includes('{skill}'),
      rubric: z.record(z.string(), z.string().min(1)),
    }),
  })
  .superRefine((spec, ctx) => {
    const keys = Object.keys(spec.fallback_templates.rubric).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...spec.rubric_levels].sort())) {
      ctx.addIssue({ code: 'custom', path: ['fallback_templates', 'rubric'], message: 'rubric templates must cover exactly the rubric_levels' });
    }
  });

const emailTemplate = z
  .object({
    _meta: meta,
    subject: z.string().min(1),
    text: z.string().min(1),
    variables: z.array(z.string().regex(/^[a-z_]+$/)),
  })
  .superRefine((t, ctx) => {
    const used = new Set([...`${t.subject}\n${t.text}`.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]));
    for (const v of used) {
      if (!t.variables.includes(v)) ctx.addIssue({ code: 'custom', path: ['variables'], message: `placeholder {{${v}}} is not declared` });
    }
  });

/** Fixed spec files: registry key → schema. Key equals the path under /specs without `.json`. */
const SPEC_SCHEMAS = Object.freeze({
  'workflow/default-hiring-workflow': workflowSpec,
  'workflow/node-states': nodeStatesSpec,
  'system/retry-policy': retryPolicySpec,
  'system/upload-policy': uploadPolicySpec,
  'system/auth-policy': authPolicySpec,
  'evaluation/shortlisting-rules': shortlistingRulesSpec,
  'evaluation/rag-retrieval': ragRetrievalSpec,
  'evaluation/fairness-policy': fairnessPolicySpec,
  'prompts/resume-parser': resumeParserPrompt,
  'prompts/matching-agent': matchingAgentPrompt,
  'prompts/interview-agent': interviewAgentPrompt,
  'email/interview-invite': emailTemplate,
  'email/rejection': emailTemplate,
  'email/password-reset': emailTemplate,
});

module.exports = { SPEC_SCHEMAS, hiringSpec };
