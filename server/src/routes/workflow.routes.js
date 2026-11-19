'use strict';

const { Router } = require('express');
const controller = require('../controllers/workflow.controller');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { listWorkflowsQuery, startWorkflowBody, approveWorkflowBody, retryWorkflowBody } = require('../validators/workflow.validators');
const { idParams } = require('../validators/common.validators');
const { ROLES } = require('../constants/roles');

function createWorkflowRouter() {
  const router = Router();
  router.use(authenticate, requireRole(ROLES.RECRUITER, ROLES.ADMIN));
  router.get('/', validate({ query: listWorkflowsQuery }), controller.list);
  router.post('/start', validate({ body: startWorkflowBody }), controller.start);
  router.post('/approve', validate({ body: approveWorkflowBody }), controller.approve);
  router.post('/retry', validate({ body: retryWorkflowBody }), controller.retry);
  router.get('/:id', validate({ params: idParams }), controller.get);
  return router;
}

module.exports = { createWorkflowRouter };
