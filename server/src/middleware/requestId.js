'use strict';

const { randomUUID } = require('node:crypto');

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Attach a request id (accepting a well-formed incoming X-Request-Id). */
function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };
