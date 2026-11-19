'use strict';

const { AgentError } = require('../workflows/errors');

let unpdf;
function loadUnpdf() {
  // unpdf is ESM-only; Node >= 22.12 can require() ES modules synchronously.
  if (!unpdf) unpdf = require('unpdf');
  return unpdf;
}

/** Collapse runs of spaces but keep line breaks (sections matter to the parser). */
function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract text from a PDF buffer with real PDF parsing (pdf.js via unpdf).
 * Throws INVALID_PDF for unreadable files and NO_EXTRACTABLE_TEXT for PDFs
 * without enough text (e.g. scanned images). Both are non-retryable.
 */
async function extractPdfText(buffer, { minChars = 1 } = {}) {
  const { extractText, getDocumentProxy } = loadUnpdf();
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err) {
    throw new AgentError('INVALID_PDF', 'The resume PDF could not be read', { cause: err });
  }
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map(normalizeText);
    const full = pages.join('\n\n').trim();
    if (full.replace(/\s/g, '').length < minChars) {
      throw new AgentError(
        'NO_EXTRACTABLE_TEXT',
        'The resume has no readable text. It may be a scanned image; upload a text-based PDF.',
        { details: { pages: totalPages, chars: full.length } }
      );
    }
    return { text: full, pages: totalPages };
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError('INVALID_PDF', 'Text could not be extracted from the resume PDF', { cause: err });
  } finally {
    await pdf.destroy?.().catch?.(() => {});
  }
}

module.exports = { extractPdfText, normalizeText };
