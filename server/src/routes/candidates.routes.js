'use strict';

const { Router } = require('express');
const controller = require('../controllers/candidates.controller');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { resumeUpload } = require('../middleware/upload');
const {
  applicationFields,
  statusTokenParams,
  listCandidatesQuery,
  resumeQuery,
} = require('../validators/candidate.validators');
const { idParams } = require('../validators/common.validators');
const { ROLES } = require('../constants/roles');

const recruiterOnly = [authenticate, requireRole(ROLES.RECRUITER, ROLES.ADMIN)];

/** Recruiter auth unless a signed `access` query token is supplied (verified in the service). */
function recruiterOrSignedLink(req, res, next) {
  if (req.validatedQuery && req.validatedQuery.access) return next();
  return authenticate(req, res, (err) => (err ? next(err) : requireRole(ROLES.RECRUITER, ROLES.ADMIN)(req, res, next)));
}

function createCandidatesRouter(limiters) {
  const router = Router();

  // Public candidate endpoints — no recruiter authentication.
  router.post('/upload', limiters.applicationUpload, resumeUpload('resume'), validate({ body: applicationFields }), controller.upload);
  router.get('/status/:statusToken', limiters.applicationStatus, validate({ params: statusTokenParams }), controller.status);

  // Recruiter endpoints.
  router.get('/', ...recruiterOnly, validate({ query: listCandidatesQuery }), controller.list);
  router.get('/:id', ...recruiterOnly, validate({ params: idParams }), controller.get);
  router.get('/:id/resume-link', ...recruiterOnly, validate({ params: idParams }), controller.resumeLink);
  router.get('/:id/resume', validate({ params: idParams, query: resumeQuery }), recruiterOrSignedLink, controller.resume);

  return router;
}

module.exports = { createCandidatesRouter };
