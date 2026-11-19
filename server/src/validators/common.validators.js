'use strict';

const { z } = require('zod');
const { PAGINATION } = require('../constants/jobs');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');

const idParams = z.strictObject({ id: objectId });

const pagination = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
};

module.exports = { objectId, idParams, pagination };
