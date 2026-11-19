'use strict';

const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const authService = require('../services/auth.service');

function extractBearer(req) {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token.trim();
}

/**
 * Verify the JWT and load the current user from MongoDB on every request
 * (so deleted users, role changes and password resets take effect at once).
 */
async function authenticate(req, _res, next) {
  const token = extractBearer(req);
  if (!token) throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
  req.user = await authService.resolveUserFromToken(token);
  next();
}

/**
 * For public routes that return extra data to signed-in recruiters. No
 * header → anonymous. A header that is present but invalid is rejected
 * (401) rather than silently ignored, so expired sessions surface.
 */
async function optionalAuthenticate(req, _res, next) {
  const token = extractBearer(req);
  if (token) req.user = await authService.resolveUserFromToken(token);
  next();
}

/** Allow only the given roles. Must run after authenticate. */
function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { authenticate, optionalAuthenticate, requireRole, extractBearer };
