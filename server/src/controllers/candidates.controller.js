'use strict';

const applicationsService = require('../services/applications.service');
const candidatesService = require('../services/candidates.service');
const { sendSuccess } = require('../utils/apiResponse');

async function upload(req, res) {
  const result = await applicationsService.submitApplication({ fields: req.body, file: req.file });
  return sendSuccess(res, result, { status: 201 });
}

async function status(req, res) {
  return sendSuccess(res, await applicationsService.getApplicationStatus(req.params.statusToken));
}

async function list(req, res) {
  const { items, meta } = await candidatesService.listCandidates(req.validatedQuery, req.user);
  return sendSuccess(res, { candidates: items }, { meta });
}

async function get(req, res) {
  return sendSuccess(res, { candidate: await candidatesService.getCandidate(req.params.id, req.user) });
}

async function resumeLink(req, res) {
  return sendSuccess(res, await candidatesService.createResumeLink(req.params.id, req.user));
}

async function resume(req, res) {
  const file = await candidatesService.getResumeFile(req.params.id, { user: req.user, access: req.validatedQuery.access });
  const asciiName = file.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(file.size),
    'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    'Cache-Control': 'private, no-store',
    // Allow the PDF to be shown in an in-app browser frame.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  file.stream.on('error', (err) => res.destroy(err));
  file.stream.pipe(res);
}

module.exports = { upload, status, list, get, resumeLink, resume };
