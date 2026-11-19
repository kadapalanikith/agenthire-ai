'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getEnv } = require('../config/env');
const { getSpec } = require('../utils/specLoader');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');

const JWT_ISSUER = 'agenthire';
const JWT_AUDIENCE = 'agenthire-app';

function bcryptRounds() {
  return getSpec('system/auth-policy').bcrypt_rounds;
}

async function hashPassword(password) {
  return bcrypt.hash(password, bcryptRounds());
}

// Compared against when the email is unknown, so login timing does not
// reveal whether an account exists.
let dummyHash;
function getDummyHash() {
  if (!dummyHash) dummyHash = bcrypt.hashSync('agenthire-timing-equaliser', bcryptRounds());
  return dummyHash;
}

function signToken(user) {
  const env = getEnv();
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256',
  });
}

function unauthorized(message = 'Authentication required', code = ERROR_CODES.UNAUTHORIZED) {
  return new AppError(401, code, message);
}

/** Verify a JWT and load the live user from MongoDB. */
async function resolveUserFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, getEnv().JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('Session expired. Please sign in again.', ERROR_CODES.TOKEN_EXPIRED);
    throw unauthorized('Invalid authentication token');
  }
  if (!payload.sub || !/^[a-f0-9]{24}$/.test(payload.sub)) throw unauthorized('Invalid authentication token');

  const user = await User.findById(payload.sub).select('+password_changed_at');
  if (!user) throw unauthorized('Account no longer exists');
  if (user.password_changed_at && payload.iat < Math.floor(user.password_changed_at.getTime() / 1000)) {
    throw unauthorized('Session expired. Please sign in again.', ERROR_CODES.TOKEN_EXPIRED);
  }
  return user;
}

async function signup({ name, email, password }) {
  if (await User.exists({ email })) {
    throw new AppError(409, ERROR_CODES.EMAIL_IN_USE, 'An account with this email already exists');
  }
  let user;
  try {
    user = await User.create({
      name,
      email,
      password: await hashPassword(password),
      role: getSpec('system/auth-policy').signup_default_role,
    });
  } catch (err) {
    if (err && err.code === 11000) throw new AppError(409, ERROR_CODES.EMAIL_IN_USE, 'An account with this email already exists');
    throw err;
  }
  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  const valid = await bcrypt.compare(password, user ? user.password : getDummyHash());
  if (!user || !valid) throw unauthorized('Email or password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  return { user, token: signToken(user) };
}

module.exports = { signup, login, resolveUserFromToken, hashPassword, signToken, JWT_ISSUER, JWT_AUDIENCE };
