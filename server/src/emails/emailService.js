'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { Resend } = require('resend');
const { getEnv } = require('../config/env');
const { logger } = require('../utils/logger');
const { renderTemplate } = require('./renderTemplate');

const OUTBOX_FILE = path.resolve(__dirname, '../../logs/email-outbox.jsonl');

/** Retryable delivery failure (retry-policy: EMAIL_API_FAILURE). */
class EmailDeliveryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = 'EMAIL_API_FAILURE';
    this.retryable = true;
  }
}

let client;
function getClient(apiKey) {
  if (!client) client = new Resend(apiKey);
  return client;
}

/** Test hook: replace the Resend client. */
function setEmailClient(c) {
  client = c;
}

function isEmailConfigured() {
  return Boolean(getEnv().RESEND_API_KEY);
}

/**
 * Development-only outbox so locally-generated emails (e.g. reset links) can
 * be read without an email provider. Disabled in production; the file lives
 * under the gitignored server/logs/ directory.
 */
async function writeDevOutbox(entry) {
  if (getEnv().NODE_ENV !== 'development') return false;
  await fs.mkdir(path.dirname(OUTBOX_FILE), { recursive: true });
  await fs.appendFile(OUTBOX_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  return true;
}

/**
 * Render and send an email.
 * Returns { delivery: 'sent', provider_id } or { delivery: 'not_configured' }.
 * Never reports a send that did not happen. Throws EmailDeliveryError when
 * the provider fails so callers can apply the retry policy.
 */
async function sendTemplatedEmail({ to, templateId, variables, idempotencyKey }) {
  const env = getEnv();
  const rendered = renderTemplate(templateId, variables);
  const base = {
    template_id: rendered.template_id,
    template_version: rendered.template_version,
    subject: rendered.subject,
  };

  if (!env.RESEND_API_KEY) {
    const outbox = await writeDevOutbox({ to, ...rendered, created_at: new Date().toISOString() }).catch((err) => {
      logger.warn({ err: err.message }, 'Could not write development email outbox');
      return false;
    });
    logger.warn({ template_id: templateId }, 'RESEND_API_KEY not set; email not sent');
    return { ...base, delivery: 'not_configured', dev_outbox: outbox };
  }

  let response;
  try {
    response = await getClient(env.RESEND_API_KEY).emails.send(
      { from: env.EMAIL_FROM, to: [to], subject: rendered.subject, text: rendered.text },
      idempotencyKey ? { idempotencyKey } : undefined
    );
  } catch (err) {
    throw new EmailDeliveryError(`Email provider request failed: ${err.message}`);
  }
  if (response.error) {
    throw new EmailDeliveryError(`Email provider rejected the request: ${response.error.message || response.error.name}`);
  }
  return { ...base, delivery: 'sent', provider_id: response.data.id };
}

module.exports = { sendTemplatedEmail, isEmailConfigured, setEmailClient, EmailDeliveryError };
