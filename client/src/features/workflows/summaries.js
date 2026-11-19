/**
 * One-line, human-readable summaries of each agent's real output
 * (GET /workflow/:id → state_output). Returns null when the agent has not
 * produced output yet; nothing is inferred.
 */
export function summarizeOutputs(stateOutput = {}) {
  const o = stateOutput;
  const out = {};
  if (o.resume_parser) {
    const p = o.resume_parser;
    const via = p.parse_source === 'llm' && p.llm?.provider ? `via ${p.llm.provider}` : 'rule-based fallback';
    out.resume_parser = `${p.skills?.length ?? 0} skills, ${p.experience_years ?? 'unknown'} yrs experience (${via})`;
  }
  if (o.embedding_agent) out.embedding_agent = `${o.embedding_agent.chunk_count} chunk(s) stored in ${o.embedding_agent.collection}`;
  if (o.matching_agent) {
    const m = o.matching_agent;
    out.matching_agent = `Score ${m.match_score}/100 · missing: ${m.missing_skills?.length ? m.missing_skills.join(', ') : 'none'}`;
  }
  if (o.shortlisting_agent) {
    const s = o.shortlisting_agent;
    out.shortlisting_agent = `AI recommends "${s.decision}" (band ≥ ${s.applied_band?.effective_min_score})`;
  }
  if (o.human_approval) {
    const a = o.human_approval;
    out.human_approval = `Recruiter chose "${a.decision}"${a.overridden ? ' (overrode AI)' : ''}`;
  }
  if (o.interview_agent) {
    const k = o.interview_agent;
    out.interview_agent = `${k.questions?.length ?? 0} questions, ${k.coding_tasks?.length ?? 0} coding tasks (${k.source === 'llm' ? 'AI-generated' : 'template-based'})`;
  }
  if (o.email_agent) out.email_agent = `${o.email_agent.template_id}: ${EMAIL_DELIVERY_LABEL[o.email_agent.delivery] || o.email_agent.delivery}`;
  return out;
}

/** How each delivery outcome is described (never "sent" unless the provider accepted it). */
export const EMAIL_DELIVERY_LABEL = {
  sent: 'sent',
  not_configured: 'not sent (email delivery not configured)',
};

/** Latest error per agent from the workflow logs. */
export function latestErrors(logs = []) {
  const out = {};
  for (const l of logs) if (l.status === 'failed' && l.error) out[l.agent_name] = l.error;
  return out;
}
