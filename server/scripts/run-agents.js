'use strict';

/**
 * Dry run of the Phase 4 agents (resume_parser → embedding_agent →
 * matching_agent) with the real PDF extractor, embedding model, Qdrant and
 * configured LLM. Prints the results; it does NOT update candidates (that is
 * the LangGraph workflow's job, Phase 5).
 *
 *   node scripts/run-agents.js --pdf ../demo-data/resumes/john-react-resume.pdf --hiring-spec frontend-developer [--min-experience 2]
 *   node scripts/run-agents.js --candidate <candidateId>        (reads MongoDB and server/uploads)
 */
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { getEnv } = require('../src/config/env');
const { initSpecs, getHiringSpec } = require('../src/utils/specLoader');
const { getEmbedder } = require('../src/rag/embedder');
const { getVectorStore, ensureCollections } = require('../src/rag');
const { getLlmClient } = require('../src/agents/shared/llmClient');
const { mergeJobRequirements } = require('../src/utils/jobRequirements');
const { runResumeParser } = require('../src/agents/resumeParser.agent');
const { runEmbeddingAgent } = require('../src/agents/embedding.agent');
const { runMatchingAgent } = require('../src/agents/matching.agent');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function loadInput() {
  if (arg('candidate')) {
    const { connectDatabase, disconnectDatabase } = require('../src/config/db');
    const Candidate = require('../src/models/Candidate');
    const Job = require('../src/models/Job');
    const storage = require('../src/services/storage.service');
    await connectDatabase(getEnv().MONGODB_URI);
    const candidate = await Candidate.findById(arg('candidate'));
    if (!candidate) throw new Error('Candidate not found');
    const job = await Job.findById(candidate.job_id);
    const buffer = await fs.readFile(storage.resolveKey(candidate.resume_url));
    await disconnectDatabase();
    return { candidateId: String(candidate._id), jobId: String(job._id), buffer, requirements: mergeJobRequirements(job) };
  }
  const pdf = arg('pdf');
  const specId = arg('hiring-spec') || 'frontend-developer';
  if (!pdf) throw new Error('Pass --pdf <file> or --candidate <id>');
  const hiring = getHiringSpec(specId);
  if (!hiring) throw new Error(`Unknown hiring spec ${specId}`);
  const job = {
    id: 'dry-run-job',
    title: hiring.role,
    hiring_spec_id: specId,
    required_skills: hiring.required_skills,
    preferred_skills: hiring.preferred_skills,
    min_experience: Number(arg('min-experience') ?? 2),
  };
  const buffer = await fs.readFile(pdf);
  return { candidateId: `dry-run-${crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12)}`, jobId: job.id, buffer, requirements: mergeJobRequirements(job) };
}

(async () => {
  initSpecs();
  const { candidateId, jobId, buffer, requirements } = await loadInput();
  const llm = getLlmClient();
  const embedder = getEmbedder();
  const store = getVectorStore();
  await ensureCollections(store);
  process.stdout.write(`LLM providers: ${llm.configured ? llm.providerNames.join(', ') : 'none configured (deterministic fallback)'}\n`);

  const t = () => Date.now();
  let t0 = t();
  const parsed = await runResumeParser({ resumeBuffer: buffer, requirements }, { llm });
  process.stdout.write(`\n[resume_parser] ${t() - t0} ms, source=${parsed.parse_source}\n${JSON.stringify(parsed.parsed_resume, null, 2)}\n`);

  t0 = t();
  const embedded = await runEmbeddingAgent({ candidateId, jobId, resumeText: parsed.resume_text }, { embedder, store });
  process.stdout.write(`\n[embedding_agent] ${t() - t0} ms, ${embedded.chunk_count} chunk(s) in ${embedded.collection}\n`);

  t0 = t();
  const match = await runMatchingAgent({ candidateId, parsedResume: parsed.parsed_resume, resumeText: parsed.resume_text, requirements }, { llm, embedder, store });
  process.stdout.write(`\n[matching_agent] ${t() - t0} ms\n${JSON.stringify(
    {
      match_score: match.match_score,
      matched_required_skills: match.matched_required_skills,
      matched_preferred_skills: match.matched_preferred_skills,
      missing_skills: match.missing_skills,
      all_skills_matched: match.all_skills_matched,
      score_breakdown: match.score_breakdown,
      explanation: match.explanation,
      explanation_source: match.explanation_source,
      rag_context: match.rag_context,
      rejected_llm_claims: match.rejected_llm_claims,
    },
    null,
    2
  )}\n`);
})().catch((err) => {
  process.stderr.write(`Failed: ${err.code || ''} ${err.message}\n`);
  process.exit(1);
});
