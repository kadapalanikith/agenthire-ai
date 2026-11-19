'use strict';

const { Router } = require('express');
const controller = require('../controllers/jobs.controller');
const { validate } = require('../middleware/validate');
const { authenticate, optionalAuthenticate, requireRole } = require('../middleware/auth');
const { createJob, updateJob, listJobsQuery } = require('../validators/job.validators');
const { idParams } = require('../validators/common.validators');
const { ROLES } = require('../constants/roles');

const recruiterOnly = [authenticate, requireRole(ROLES.RECRUITER, ROLES.ADMIN)];

function createJobsRouter() {
  const router = Router();
  // Public so candidate job pages can load; `scope=mine` requires a token.
  router.get('/', optionalAuthenticate, validate({ query: listJobsQuery }), controller.list);
  router.post('/', ...recruiterOnly, validate({ body: createJob }), controller.create);
  router.get('/:id', optionalAuthenticate, validate({ params: idParams }), controller.get);
  router.put('/:id', ...recruiterOnly, validate({ params: idParams, body: updateJob }), controller.update);
  return router;
}

module.exports = { createJobsRouter };
