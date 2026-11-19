'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().trim().default('7d'),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  PUBLIC_WEB_URL: z.url().default('http://localhost:8081'),
  COMPANY_NAME: z.string().trim().default('AgentHire'),

  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.string().trim().default('llama-3.3-70b-versatile'),
  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_MODEL: z.string().trim().default('meta-llama/llama-3.3-70b-instruct:free'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  QDRANT_URL: z.url().default('http://127.0.0.1:6333'),
  QDRANT_API_KEY: optionalString,
  EMBEDDING_MODEL: z.string().trim().default('Xenova/bge-small-en-v1.5'),

  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().trim().default('AgentHire <onboarding@resend.dev>'),

  EXPO_ACCESS_TOKEN: optionalString,
  WORKFLOW_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
});

function invalidEnv(lines) {
  const err = new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  err.code = 'INVALID_ENV';
  return err;
}

/**
 * Parse and validate environment variables. Error messages name the
 * variables only, never their values.
 */
function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw invalidEnv(result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`));
  }
  const env = result.data;
  if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.length === 0) {
    throw invalidEnv(['  - CORS_ORIGINS: required in production']);
  }
  return Object.freeze(env);
}

let cached;
function getEnv() {
  if (!cached) cached = loadEnv();
  return cached;
}

module.exports = { loadEnv, getEnv, envSchema };
