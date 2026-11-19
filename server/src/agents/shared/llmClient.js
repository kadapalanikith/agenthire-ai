'use strict';

const { getEnv } = require('../../config/env');
const { AgentError } = require('../../workflows/errors');
const { logger } = require('../../utils/logger');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Map a provider/SDK error to a retry-policy code. */
function classifyProviderError(err) {
  const status = err?.status ?? err?.response?.status ?? err?.statusCode;
  const name = err?.name || '';
  const msg = String(err?.message || '');
  if (name === 'AbortError' || name === 'TimeoutError' || /timed? ?out|timeout|aborted/i.test(msg)) return 'LLM_TIMEOUT';
  if (status === 401 || status === 403 || status === 404 || /invalid api key|unauthori[sz]ed|model.*not.*found/i.test(msg)) {
    return 'LLM_CONFIG_ERROR';
  }
  return 'LLM_PROVIDER_ERROR';
}

/** Extract the first JSON object from model text (tolerates code fences). */
function parseJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(candidate.slice(start, end + 1));
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
  return '';
}

/** Wrap a LangChain chat model as a provider: { name, model, complete(system, user, opts) → text }. */
function langchainProvider(name, modelName, chatModel) {
  return {
    name,
    model: modelName,
    async complete({ system, user, temperature, timeoutMs }) {
      const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
      const res = await chatModel.invoke([new SystemMessage(system), new HumanMessage(user)], {
        signal: AbortSignal.timeout(timeoutMs),
        response_format: { type: 'json_object' },
        temperature,
      });
      return contentToText(res.content);
    },
  };
}

/** Build providers from env: Groq (primary) then OpenRouter (fallback). Keys never leave the server. */
function providersFromEnv(env = getEnv()) {
  const providers = [];
  if (env.GROQ_API_KEY) {
    const { ChatGroq } = require('@langchain/groq');
    providers.push(langchainProvider('groq', env.GROQ_MODEL, new ChatGroq({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, maxRetries: 0 })));
  }
  if (env.OPENROUTER_API_KEY) {
    const { ChatOpenAI } = require('@langchain/openai');
    providers.push(
      langchainProvider(
        'openrouter',
        env.OPENROUTER_MODEL,
        new ChatOpenAI({
          apiKey: env.OPENROUTER_API_KEY,
          model: env.OPENROUTER_MODEL,
          maxRetries: 0,
          configuration: { baseURL: OPENROUTER_BASE_URL, defaultHeaders: { 'X-Title': 'AgentHire' } },
        })
      )
    );
  }
  return providers;
}

/**
 * LLM client with ordered provider fallback and Zod-validated JSON output.
 * Per call, each provider is tried once in order (in-run retries are the
 * workflow engine's job, driven by the retry policy).
 */
function createLlmClient({ providers, timeoutMs }) {
  return {
    get configured() {
      return providers.length > 0;
    },
    get providerNames() {
      return providers.map((p) => `${p.name}:${p.model}`);
    },

    /** @returns {Promise<{ data, provider, model }>} */
    async invokeJson({ system, user, schema, temperature = 0 }) {
      if (!providers.length) throw new AgentError('LLM_CONFIG_ERROR', 'No LLM provider is configured');
      const failures = [];
      for (const provider of providers) {
        let text;
        try {
          text = await provider.complete({ system, user, temperature, timeoutMs });
        } catch (err) {
          const code = classifyProviderError(err);
          failures.push({ provider: provider.name, code, message: err.message });
          logger.warn({ provider: provider.name, code }, 'LLM provider call failed');
          continue;
        }
        try {
          const parsed = schema.safeParse(parseJsonObject(text));
          if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
          return { data: parsed.data, provider: provider.name, model: provider.model };
        } catch (err) {
          failures.push({ provider: provider.name, code: 'MALFORMED_JSON', message: err.message });
          logger.warn({ provider: provider.name, code: 'MALFORMED_JSON' }, 'LLM returned invalid JSON');
        }
      }
      // Prefer a retryable classification when any provider failed transiently.
      const transient = failures.find((f) => f.code === 'LLM_TIMEOUT') || failures.find((f) => f.code === 'LLM_PROVIDER_ERROR');
      const chosen = transient || failures[0];
      throw new AgentError(chosen.code, `All LLM providers failed (${failures.map((f) => `${f.provider}: ${f.code}`).join(', ')})`, {
        details: { failures },
      });
    },
  };
}

let client;
function getLlmClient() {
  if (!client) client = createLlmClient({ providers: providersFromEnv(), timeoutMs: getEnv().LLM_TIMEOUT_MS });
  return client;
}

/** Test hook. */
function setLlmClient(c) {
  client = c;
}

module.exports = { createLlmClient, getLlmClient, setLlmClient, providersFromEnv, classifyProviderError, parseJsonObject };
