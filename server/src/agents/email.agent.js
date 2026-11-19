'use strict';

const { getSpec } = require('../utils/specLoader');
const { getEnv } = require('../config/env');
const { AgentError } = require('../workflows/errors');
const { sendTemplatedEmail } = require('../emails/emailService');

const AGENT = 'email_agent';

function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * Email Agent: sends the interview invite or the rejection chosen by the
 * recruiter's decision (template from the workflow spec branch, content from
 * specs/email/*.json) through Resend. Without RESEND_API_KEY the result is
 * recorded as `not_configured` instead of failing the workflow. Resend's
 * idempotency key prevents duplicate emails when a step is retried.
 */
async function runEmailAgent({ workflowId, approval, candidate, requirements }, deps = {}) {
  if (!approval || !approval.decision) {
    throw new AgentError('INVALID_SCHEMA', 'Emails are only sent after a recruiter decision');
  }
  const branch = getSpec('workflow/default-hiring-workflow').branches.human_approval?.[approval.decision];
  if (!branch) throw new AgentError('INVALID_SCHEMA', `No email template for decision "${approval.decision}"`);

  const send = deps.sendEmail || sendTemplatedEmail;
  const idempotencyKey = `agenthire-${workflowId}-${branch.email_template}`;
  const result = await send({
    to: candidate.email,
    templateId: branch.email_template,
    variables: {
      candidate_name: candidate.name.split(' ')[0],
      job_title: requirements.title,
      company_name: getEnv().COMPANY_NAME,
    },
    idempotencyKey,
  });

  return {
    decision: approval.decision,
    template_id: result.template_id,
    template_version: result.template_version,
    subject: result.subject,
    delivery: result.delivery,
    provider_id: result.provider_id ?? null,
    recipient: maskEmail(candidate.email),
    sent_at: result.delivery === 'sent' ? new Date().toISOString() : null,
    idempotency_key: idempotencyKey,
  };
}

module.exports = { runEmailAgent, maskEmail, AGENT };
