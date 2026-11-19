'use strict';

const { Router } = require('express');
const { createSystemRouter } = require('./system.routes');
const { createAuthRouter } = require('./auth.routes');
const { createJobsRouter } = require('./jobs.routes');
const { createCandidatesRouter } = require('./candidates.routes');
const { createDashboardRouter, createRecruiterMetaRouter } = require('./dashboard.routes');

function createRouter(limiters) {
  const router = Router();
  router.use('/', createSystemRouter());
  router.use('/meta', createRecruiterMetaRouter());
  router.use('/auth', createAuthRouter(limiters));
  router.use('/jobs', createJobsRouter());
  router.use('/candidates', createCandidatesRouter(limiters));
  router.use('/dashboard', createDashboardRouter());
  return router;
}

module.exports = { createRouter };
