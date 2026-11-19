'use strict';

const { Router } = require('express');
const controller = require('../controllers/system.controller');

function createSystemRouter() {
  const router = Router();
  router.get('/health', controller.health);
  router.get('/meta/workflow-spec', controller.workflowSpec);
  router.get('/meta/auth-policy', controller.authPolicy);
  return router;
}

module.exports = { createSystemRouter };
