'use strict';

const { Annotation } = require('@langchain/langgraph');

// Each channel holds the latest value written by its agent.
const last = (prev, next) => (next === undefined ? prev : next);
const channel = () => Annotation({ reducer: last, default: () => null });

/**
 * Shared, serialisable LangGraph state. Agents never call each other; they
 * read earlier agents' outputs from here and write their own.
 */
const HiringState = Annotation.Root({
  workflow_id: channel(),
  candidate_id: channel(),
  job_id: channel(),
  requirements: channel(), // resume_parser (job + hiring spec snapshot)
  resume_text: channel(), // resume_parser
  parsed_resume: channel(), // resume_parser
  parse_source: channel(), // resume_parser
  embedding_refs: channel(), // embedding_agent
  match_result: channel(), // matching_agent
  recommendation: channel(), // shortlisting_agent
  approval: channel(), // human_approval (recruiter decision)
  interview_kit: channel(), // interview_agent (Phase 7)
  email_result: channel(), // email_agent (Phase 7)
});

module.exports = { HiringState };
