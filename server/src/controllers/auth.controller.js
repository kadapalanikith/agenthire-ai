'use strict';

const authService = require('../services/auth.service');
const passwordResetService = require('../services/passwordReset.service');
const { sendSuccess } = require('../utils/apiResponse');

async function signup(req, res) {
  const { user, token } = await authService.signup(req.body);
  return sendSuccess(res, { user, token }, { status: 201 });
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  return sendSuccess(res, { user, token });
}

async function me(req, res) {
  return sendSuccess(res, { user: req.user });
}

async function forgotPassword(req, res) {
  passwordResetService.requestPasswordResetInBackground(req.body.email);
  return sendSuccess(
    res,
    { message: 'If an account exists for this email, a password reset link has been sent.' },
    { status: 202 }
  );
}

async function resetPassword(req, res) {
  await passwordResetService.resetPassword(req.body);
  return sendSuccess(res, { message: 'Password updated. Please sign in with your new password.' });
}

module.exports = { signup, login, me, forgotPassword, resetPassword };
