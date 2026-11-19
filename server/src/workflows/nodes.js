'use strict';

const fs = require('node:fs/promises');
const { interrupt } = require('@langchain/langgraph');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Workflow = require('../models/Workflow');
const WorkflowLog = require('../models/WorkflowLog');
const { AgentError } = require('./errors');
const { getSpec } = require('../utils/specLoader');
const { mergeJobRequirements } = require('../utils/jobRequirements');
const storage = require('../services/storage.service');
const { runResumeParser } = require('../agents/resumeParser.agent');
const { runEmbeddingAgent } = require('../agents/embedding.agent');
const { runMatchingAgent } = require('../agents/matching.agent');
const { runShortlistingAgent } = require('../agents/shortlisting.agent');
const { buildApprovalRequest, resolveApproval } = require('../agents/humanApproval.agent');

/**
 * Node handlers: load inputs, call the agent, persist domain results on the
 * candidate, and return { update, output }. Agents stay free of persistence.
 * `deps` = { llm, embedder, store }.
 */
function createNodeHandlers(deps) {
  return {
    async resume_parser(state) {
      const candidate = await Candidate.findById(state.candidate_id);
      const job = await Job.findById(state.job_id);
      if (!candidate || !job) throw new AgentError('INVALID_SCHEMA', 'Candidate or job no longer exists');
      let buffer;
      try {
        buffer = await fs.readFile(storage.resolveKey(candidate.resume_url));
      } catch (err) {
        throw new AgentError('INVALID_PDF', 'The stored resume file could not be read', { cause: err });
      }
      const requirements = mergeJobRequirements(job);
      const out = await runResumeParser({ resumeBuffer: buffer, requirements }, { llm: deps.llm });
      await Candidate.updateOne({ _id: candidate._id }, { $set: { parsed_resume_json: out.parsed_resume } });
      return {
        update: { requirements, resume_text: out.resume_text, parsed_resume: out.parsed_resume, parse_source: out.parse_source },
        output: {
          parse_source: out.parse_source,
          llm: out.llm,
          skills: out.parsed_resume.skills,
          experience_years: out.parsed_resume.experience_years,
          education_count: out.parsed_resume.education.length,
          project_count: out.parsed_resume.projects.length,
          text_stats: out.text_stats,
          spec_version: out.spec_version,
        },
      };
    },

    async embedding_agent(state) {
      const out = await runEmbeddingAgent(
        { candidateId: state.candidate_id, jobId: state.job_id, resumeText: state.resume_text },
        { embedder: deps.embedder, store: deps.store }
      );
      return { update: { embedding_refs: out }, output: { ...out, point_ids: undefined, point_count: out.point_ids.length } };
    },

    async matching_agent(state) {
      const out = await runMatchingAgent(
        { candidateId: state.candidate_id, parsedResume: state.parsed_resume, resumeText: state.resume_text, requirements: state.requirements },
        { llm: deps.llm, embedder: deps.embedder, store: deps.store }
      );
      await Candidate.updateOne({ _id: state.candidate_id }, { $set: { match_score: out.match_score } });
      return { update: { match_result: out }, output: out };
    },

    async shortlisting_agent(state) {
      const out = runShortlistingAgent({ matchScore: state.match_result.match_score, requirements: state.requirements });
      await Candidate.updateOne({ _id: state.candidate_id }, { $set: { ai_recommendation: out.decision } });
      return { update: { recommendation: out }, output: out };
    },

    async human_approval(state) {
      // Pauses the graph. On resume (Phase 6), LangGraph re-runs this node and
      // interrupt() returns the recruiter's decision instead of pausing.
      const decision = interrupt(buildApprovalRequest({ recommendation: state.recommendation, matchResult: state.match_result }));
      const approval = resolveApproval(decision, state.recommendation);
      await markSkippedBranches(state.workflow_id, approval.decision);
      await Candidate.updateOne({ _id: state.candidate_id }, { $set: { status: approval.decision === 'approve' ? 'approved' : 'rejected' } });
      await Workflow.updateOne({ _id: state.workflow_id }, { $set: { approval, pending_decision: null } });
      return { update: { approval }, output: approval };
    },

    // Implemented in Phase 7. They cannot be reached until the approval
    // endpoint exists (Phase 6); if reached, they fail loudly instead of faking output.
    async interview_agent() {
      throw new AgentError('NOT_IMPLEMENTED', 'The interview agent is implemented in Phase 7');
    },
    async email_agent() {
      throw new AgentError('NOT_IMPLEMENTED', 'The email agent is implemented in Phase 7');
    },
  };
}

/** Record nodes skipped by the chosen branch (e.g. interview_agent on reject). */
async function markSkippedBranches(workflowId, decision) {
  const spec = getSpec('workflow/default-hiring-workflow');
  const branch = spec.branches.human_approval?.[decision];
  for (const node of branch?.skip || []) {
    const now = new Date();
    await Workflow.updateOne(
      { _id: workflowId },
      { $set: { [`node_states.${node}.status`]: 'skipped', [`node_states.${node}.completed_at`]: now } }
    );
    await WorkflowLog.create({ workflow_id: workflowId, agent_name: node, status: 'skipped', output: { reason: `Skipped because the recruiter chose "${decision}"` }, completed_at: now });
  }
}

module.exports = { createNodeHandlers, markSkippedBranches };
