'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { getEnv } = require('./config/env');
const { logger } = require('./utils/logger');
const { requestId } = require('./middleware/requestId');
const { sanitizeRequest, sanitizedQueryParser } = require('./middleware/sanitize');
const { createRateLimiters } = require('./middleware/rateLimiters');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { createRouter } = require('./routes');

/**
 * Build the Express application. `options.rateLimits` overrides the spec
 * rate limits (tests only).
 */
function createApp(options = {}) {
  const env = getEnv();
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.set('query parser', sanitizedQueryParser);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    })
  );
  app.use(helmet());
  // Native mobile requests carry no Origin header and are unaffected by CORS;
  // browsers (Expo web) are limited to the configured origins.
  app.use(cors({ origin: env.CORS_ORIGINS, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], maxAge: 600 }));

  const limiters = createRateLimiters(options.rateLimits);
  app.use(limiters.general);
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitizeRequest);

  app.use(createRouter(limiters));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
