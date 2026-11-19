'use strict';

const { getSpec } = require('../utils/specLoader');

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

/**
 * Render an email template from specs/email/<templateId>.json.
 * Every declared variable must be supplied; unknown placeholders are
 * rejected at spec-load time.
 */
function renderTemplate(templateId, variables) {
  const template = getSpec(`email/${templateId}`);
  const missing = template.variables.filter((v) => variables[v] === undefined || variables[v] === null);
  if (missing.length) {
    const err = new Error(`Email template "${templateId}" is missing variables: ${missing.join(', ')}`);
    err.code = 'EMAIL_TEMPLATE_VARIABLES';
    throw err;
  }
  const fill = (s) => s.replace(PLACEHOLDER, (_m, key) => String(variables[key]));
  return {
    template_id: templateId,
    template_version: template._meta.version,
    subject: fill(template.subject).replace(/[\r\n]+/g, ' '),
    text: fill(template.text),
  };
}

module.exports = { renderTemplate };
