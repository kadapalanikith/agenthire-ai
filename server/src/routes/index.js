'use strict';

const { Router } = require('express');
const { createSystemRouter } = require('./system.routes');
const { createAuthRouter } = require('./auth.routes');

function createRouter(limiters) {
  const router = Router();
  router.use('/', createSystemRouter());
  router.use('/auth', createAuthRouter(limiters));
  return router;
}

module.exports = { createRouter };
