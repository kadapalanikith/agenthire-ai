import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import WorkflowsListScreen from '../../app/(recruiter)/dashboard/workflows/index';
import WorkflowDetailScreen from '../../app/(recruiter)/dashboard/workflows/[workflowId]/index';
import ApprovalScreen from '../../app/(recruiter)/dashboard/workflows/[workflowId]/approval';
import { configureApiClient } from '../../src/api/client';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { callsTo, mockApi } from '../helpers/mockApi';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Link: ({ children }) => <Text>{children}</Text>,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false), setParams: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
  };
});

const WID = 'f'.repeat(24);
const ORDER = ['resume_parser', 'embedding_agent', 'matching_agent', 'shortlisting_agent', 'human_approval', 'interview_agent', 'email_agent'];
const LABELS = { resume_parser: 'Resume Parser', embedding_agent: 'Embedding Agent', matching_agent: 'Matching Agent', shortlisting_agent: 'Shortlisting Agent', human_approval: 'Human Approval', interview_agent: 'Interview Agent', email_agent: 'Email Agent' };
const colors = { fg: '#111111', bg: '#EEEEEE', border: '#CCCCCC' };
const state = (label) => ({ label, light: colors, dark: colors });
const workflowSpec = [
  200,
  {
    success: true,
    data: {
      workflow: ORDER,
      node_labels: LABELS,
      node_states: { pending: state('Pending'), running: state('Running'), success: state('Completed'), failed: state('Failed'), waiting_approval: state('Waiting for approval'), skipped: state('Skipped') },
      approval_rules: { override_requires_reason: true, override_reason_min_length: 10 },
    },
  },
];

function detail({ status = 'waiting_approval', nodes, lastError = null, approvalRequest, logs = [] } = {}) {
  const statuses = nodes || ['success', 'success', 'success', 'success', 'waiting_approval', 'pending', 'pending'];
  return {
    approval_request:
      approvalRequest === undefined
        ? status === 'waiting_approval'
          ? { type: 'human_approval', ai_recommendation: 'shortlisted', match_score: 92, explanation: 'Strong match.', missing_skills: ['Tailwind CSS'], reason_required: { approve: false, reject: true }, reason_min_length: 10 }
          : null
        : approvalRequest,
    workflow: { id: WID, status, current_state: status === 'waiting_approval' ? 'human_approval' : lastError?.agent_name ?? null, retry_count: 0, last_error: lastError, approval: null, decision_pending: false },
    execution_order: ORDER,
    nodes: ORDER.map((name, index) => ({ name, index, status: statuses[index], attempts: statuses[index] === 'pending' ? 0 : 1, started_at: '2026-11-19T08:00:00.000Z', completed_at: '2026-11-19T08:00:02.000Z', duration_ms: 2000 })),
    state_output: {
      resume_parser: { parse_source: 'llm', llm: { provider: 'groq' }, skills: ['React', 'CSS'], experience_years: 4 },
      embedding_agent: { collection: 'agenthire_resumes', chunk_count: 3 },
      matching_agent: { match_score: 92, missing_skills: ['Tailwind CSS'], matched_required_skills: ['React'] },
      shortlisting_agent: { decision: 'shortlisted', applied_band: { effective_min_score: 80 } },
    },
    logs,
    candidate: { id: 'c'.repeat(24), name: 'John Carter', status: 'awaiting_review' },
    job: { id: 'j'.repeat(24), title: 'Frontend Developer' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  configureApiClient({ baseUrl: 'http://api.test', getToken: () => 'jwt' });
});

describe('workflows list', () => {
  test('shows workflows with progress and filters by status via the API', async () => {
    useLocalSearchParams.mockReturnValue({});
    const wf = { id: WID, status: 'waiting_approval', current_state: 'human_approval', updated_at: '2026-11-19T08:00:00.000Z', candidate: { name: 'John Carter' }, job: { title: 'Frontend Developer' }, nodes: ORDER.map((name) => ({ name, status: 'success' })) };
    mockApi({
      'GET /meta/workflow-spec': workflowSpec,
      'GET /workflow': [200, { success: true, data: { workflows: [wf] }, meta: { page: 1, limit: 20, total: 1, total_pages: 1 } }],
    });
    await renderWithProviders(<WorkflowsListScreen />);
    expect(await screen.findByText('John Carter')).toBeTruthy();
    expect(screen.getByText('At Human Approval')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('workflow-filter-failed'));
    await waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u.includes('/workflow?') && u.includes('status=failed'))).toBe(true));
  });

  test('opens pre-filtered from the dashboard banner', async () => {
    useLocalSearchParams.mockReturnValue({ status: 'waiting_approval' });
    mockApi({ 'GET /meta/workflow-spec': workflowSpec, 'GET /workflow': [200, { success: true, data: { workflows: [] }, meta: { page: 1, limit: 20, total: 0, total_pages: 1 } }] });
    await renderWithProviders(<WorkflowsListScreen />);
    await screen.findByText('Nothing here');
    expect(global.fetch.mock.calls.some(([u]) => u.includes('status=waiting_approval'))).toBe(true);
  });
});

describe('workflow detail timeline', () => {
  test('renders all seven agents in spec order with real statuses, summaries and a decision prompt', async () => {
    useLocalSearchParams.mockReturnValue({ workflowId: WID });
    mockApi({ 'GET /meta/workflow-spec': workflowSpec, [`GET /workflow/${WID}`]: [200, { success: true, data: detail() }] });
    await renderWithProviders(<WorkflowDetailScreen />);
    await screen.findByTestId('workflow-timeline');
    for (const [i, name] of ORDER.entries()) expect(screen.getByText(`${i + 1}. ${LABELS[name]}`)).toBeTruthy();
    expect(within(screen.getByTestId('timeline-status-human_approval')).getByText('Waiting for approval')).toBeTruthy();
    expect(within(screen.getByTestId('timeline-status-resume_parser')).getByText('Completed')).toBeTruthy();
    expect(screen.getByText('2 skills, 4 yrs experience (via groq)')).toBeTruthy();
    expect(screen.getByText('Score 92/100 · missing: Tailwind CSS')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('go-approval'));
    expect(router.push).toHaveBeenCalledWith(`/dashboard/workflows/${WID}/approval`);
  });

  test('tapping an agent opens its execution details and attempt history', async () => {
    useLocalSearchParams.mockReturnValue({ workflowId: WID });
    const logs = [
      { id: 'l1', agent_name: 'embedding_agent', status: 'failed', attempt: 1, created_at: '2026-11-19T08:00:01.000Z', duration_ms: 10, error: { code: 'VECTOR_DB_TIMEOUT', message: 'qdrant down', retryable: true } },
      { id: 'l2', agent_name: 'embedding_agent', status: 'success', attempt: 2, created_at: '2026-11-19T08:00:02.000Z', duration_ms: 700 },
    ];
    mockApi({ 'GET /meta/workflow-spec': workflowSpec, [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ logs }) }] });
    await renderWithProviders(<WorkflowDetailScreen />);
    await fireEvent.press(await screen.findByTestId('timeline-step-embedding_agent'));
    expect(screen.getByTestId('agent-sheet-title').props.children).toBe('Embedding Agent');
    const attempts = screen.getByTestId('agent-sheet-attempts');
    expect(within(attempts).getByText(/VECTOR_DB_TIMEOUT: qdrant down \(retryable\)/)).toBeTruthy();
    expect(within(screen.getByTestId('agent-sheet-output')).getByText('agenthire_resumes')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('agent-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('agent-sheet-title')).toBeNull());
  });

  test('a failed workflow shows the error and retries through the API', async () => {
    useLocalSearchParams.mockReturnValue({ workflowId: WID });
    const lastError = { agent_name: 'embedding_agent', code: 'VECTOR_DB_TIMEOUT', message: 'qdrant down', retryable: true };
    mockApi({
      'GET /meta/workflow-spec': workflowSpec,
      [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ status: 'failed', lastError, nodes: ['success', 'failed', 'pending', 'pending', 'pending', 'pending', 'pending'] }) }],
      'POST /workflow/retry': [202, { success: true, data: { workflow: { id: WID, status: 'running', retry_count: 1 } } }],
    });
    await renderWithProviders(<WorkflowDetailScreen />);
    expect(await screen.findByText('Failed at Embedding Agent')).toBeTruthy();
    expect(screen.queryByTestId('approval-cta')).toBeNull();
    await fireEvent.press(screen.getByTestId('retry-workflow'));
    await waitFor(() => expect(callsTo('POST /workflow/retry')).toHaveLength(1));
    expect(JSON.parse(callsTo('POST /workflow/retry')[0][1].body)).toEqual({ workflow_id: WID });
  });
});

describe('approval screen', () => {
  beforeEach(() => useLocalSearchParams.mockReturnValue({ workflowId: WID }));

  test('approving in line with the AI needs no reason', async () => {
    mockApi({
      [`GET /workflow/${WID}`]: [200, { success: true, data: detail() }],
      'POST /workflow/approve': [202, { success: true, data: { workflow: { id: WID, status: 'running' }, approval: { decision: 'approve' } } }],
    });
    await renderWithProviders(<ApprovalScreen />);
    expect(await screen.findByText('Advisory only. You make the final decision.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('decision-approve'));
    expect(screen.getByText('Reason (optional)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('submit-decision'));
    await waitFor(() => expect(callsTo('POST /workflow/approve')).toHaveLength(1));
    expect(JSON.parse(callsTo('POST /workflow/approve')[0][1].body)).toEqual({ workflow_id: WID, decision: 'approve' });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/dashboard/workflows/${WID}`));
  });

  test('overriding the AI requires a reason of the spec length before submitting', async () => {
    mockApi({
      [`GET /workflow/${WID}`]: [200, { success: true, data: detail() }],
      'POST /workflow/approve': [202, { success: true, data: { workflow: { id: WID, status: 'running' }, approval: { decision: 'reject' } } }],
    });
    await renderWithProviders(<ApprovalScreen />);
    await fireEvent.press(await screen.findByTestId('decision-reject'));
    expect(screen.getByText('Reason (required: this overrides the AI recommendation)')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('decision-reason'), 'too short');
    await fireEvent.press(screen.getByTestId('submit-decision'));
    expect(await screen.findByText(/at least 10 characters/)).toBeTruthy();
    expect(callsTo('POST /workflow/approve')).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('decision-reason'), 'Requires on-site work the candidate declined');
    await fireEvent.press(screen.getByTestId('submit-decision'));
    await waitFor(() => expect(callsTo('POST /workflow/approve')).toHaveLength(1));
    expect(JSON.parse(callsTo('POST /workflow/approve')[0][1].body)).toEqual({ workflow_id: WID, decision: 'reject', reason: 'Requires on-site work the candidate declined' });
  });

  test('explains when no decision is needed', async () => {
    mockApi({ [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ status: 'running', approvalRequest: null }) }] });
    await renderWithProviders(<ApprovalScreen />);
    expect(await screen.findByText('No decision needed')).toBeTruthy();
  });

  test('shows a conflict when another recruiter already decided', async () => {
    mockApi({
      [`GET /workflow/${WID}`]: [200, { success: true, data: detail() }],
      'POST /workflow/approve': [409, { success: false, error: { code: 'WORKFLOW_STATE_CONFLICT', message: 'This workflow was already decided' } }],
    });
    await renderWithProviders(<ApprovalScreen />);
    await fireEvent.press(await screen.findByTestId('decision-approve'));
    await fireEvent.press(screen.getByTestId('submit-decision'));
    expect(await screen.findByText('This workflow was already decided')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
