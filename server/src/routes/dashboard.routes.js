'use strict';

const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

function createDashboardRouter() {
  const router = Router();
  router.use(authenticate, requireRole(ROLES.RECRUITER, ROLES.ADMIN));
  router.get('/summary', controller.summary);
  return router;
}

/** Recruiter-only spec metadata (base role specs for the job form). */
function createRecruiterMetaRouter() {
  const router = Router();
  router.get('/hiring-specs', authenticate, requireRole(ROLES.RECRUITER, ROLES.ADMIN), controller.hiringSpecs);
  return router;
}

module.exports = { createDashboardRouter, createRecruiterMetaRouter };
