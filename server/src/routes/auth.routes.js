'use strict';

const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { buildAuthSchemas } = require('../validators/auth.validators');
const { ROLES } = require('../constants/roles');

function createAuthRouter(limiters) {
  const schemas = buildAuthSchemas();
  const router = Router();

  router.post('/signup', limiters.auth, validate({ body: schemas.signup }), controller.signup);
  router.post('/login', limiters.auth, validate({ body: schemas.login }), controller.login);
  router.post('/forgot-password', limiters.passwordReset, validate({ body: schemas.forgotPassword }), controller.forgotPassword);
  router.post('/reset-password', limiters.passwordReset, validate({ body: schemas.resetPassword }), controller.resetPassword);
  router.get('/me', authenticate, requireRole(ROLES.RECRUITER, ROLES.ADMIN), controller.me);

  return router;
}

module.exports = { createAuthRouter };
