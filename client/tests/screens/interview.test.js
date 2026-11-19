import { fireEvent, screen, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import InterviewKitScreen from '../../app/(recruiter)/dashboard/workflows/[workflowId]/interview';
import WorkflowDetailScreen from '../../app/(recruiter)/dashboard/workflows/[workflowId]/index';
import { configureApiClient } from '../../src/api/client';
import { summarizeOutputs } from '../../src/features/workflows/summaries';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { mockApi } from '../helpers/mockApi';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Link: ({ children }) => <Text>{children}</Text>,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false), setParams: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
  };
});

const WID = 'a'.repeat(24);
const ORDER = ['resume_parser', 'embedding_agent', 'matching_agent', 'shortlisting_agent', 'human_approval', 'interview_agent', 'email_agent'];
const LEVELS = ['does_not_meet', 'partially_meets', 'meets', 'exceeds'];
const rubric = Object.fromEntries(LEVELS.map((l) => [l, `Behaviour for ${l}`]));
const kit = {
  questions: [
    { id: 'q1', question: 'Walk me through your project "Recipe Finder".', type: 'experience', skill: 'React', rubric },
    { id: 'q2', question: 'How would you get productive with Tailwind CSS?', type: 'situational', skill: 'Tailwind CSS', rubric },
  ],
  coding_tasks: [{ id: 't1', title: 'React exercise', prompt: 'Build a small accessible form with validation.', skills: ['React'], time_minutes: 45, rubric }],
  focus_areas: ['Probe gaps: Tailwind CSS'],
  interview_rounds: 2,
  rubric_levels: LEVELS,
  source: 'llm',
  llm: { provider: 'groq', model: 'openai/gpt-oss-120b' },
  guidelines: [{ doc_path: 'knowledge/interview-guidelines/structured-interview-guidelines.md', chunk_index: 0, score: 0.7 }],
  removed_questions: [],
  spec_version: '1.1.0',
};

function detail({ stateOutput = {}, nodes } = {}) {
  const statuses = nodes || ORDER.map(() => 'success');
  return {
    approval_request: null,
    workflow: { id: WID, status: 'completed', current_state: null, retry_count: 0, last_error: null, approval: { decision: 'approve', ai_recommendation: 'shortlisted', overridden: false }, decision_pending: false },
    execution_order: ORDER,
    nodes: ORDER.map((name, index) => ({ name, index, status: statuses[index], attempts: 1 })),
    state_output: stateOutput,
    logs: [],
    candidate: { id: 'c'.repeat(24), name: 'John Carter' },
    job: { id: 'j'.repeat(24), title: 'Frontend Developer' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  configureApiClient({ baseUrl: 'http://api.test', getToken: () => 'jwt' });
  useLocalSearchParams.mockReturnValue({ workflowId: WID });
});

describe('interview kit screen', () => {
  test('lists questions and coding tasks; rubrics expand on tap', async () => {
    mockApi({ [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ stateOutput: { interview_agent: kit } }) }] });
    await renderWithProviders(<InterviewKitScreen />);
    expect(await screen.findByText('Questions (2)')).toBeTruthy();
    expect(screen.getByText('AI-generated (groq)')).toBeTruthy();
    expect(screen.getByText('• Probe gaps: Tailwind CSS')).toBeTruthy();
    expect(screen.queryByText('Behaviour for exceeds')).toBeNull();
    await fireEvent.press(within(screen.getByTestId('question-q1')).getByText('1. Walk me through your project "Recipe Finder".'));
    expect(within(screen.getByTestId('question-q1')).getByText('Behaviour for exceeds')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText(/structured-interview-guidelines\.md/)).toBeTruthy();
  });

  test('explains why there is no kit for a rejected candidate', async () => {
    mockApi({ [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ nodes: ['success', 'success', 'success', 'success', 'success', 'skipped', 'success'] }) }] });
    await renderWithProviders(<InterviewKitScreen />);
    expect(await screen.findByText('The candidate was rejected, so no interview kit was generated.')).toBeTruthy();
  });
});

describe('workflow detail after completion', () => {
  const spec = [200, { success: true, data: { workflow: ORDER, node_labels: {}, node_states: {}, approval_rules: {} } }];

  test('shows the interview kit link and states honestly that the email was not sent', async () => {
    const email = { decision: 'approve', template_id: 'interview-invite', subject: 'Interview invitation: Frontend Developer', delivery: 'not_configured', recipient: 'j***@example.com' };
    mockApi({ 'GET /meta/workflow-spec': spec, [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ stateOutput: { interview_agent: kit, email_agent: email } }) }] });
    await renderWithProviders(<WorkflowDetailScreen />);
    expect(await screen.findByText('Interview kit (2 questions)')).toBeTruthy();
    const card = screen.getByTestId('email-card');
    expect(within(card).getByText('Not sent')).toBeTruthy();
    expect(within(card).getByText(/not configured/)).toBeTruthy();
    expect(within(card).queryByText('Sent')).toBeNull();
  });

  test('a delivered email is shown as sent with the masked recipient', async () => {
    const email = { decision: 'approve', template_id: 'interview-invite', subject: 'Interview invitation', delivery: 'sent', provider_id: 'em_1', recipient: 'j***@example.com' };
    mockApi({ 'GET /meta/workflow-spec': spec, [`GET /workflow/${WID}`]: [200, { success: true, data: detail({ stateOutput: { email_agent: email } }) }] });
    await renderWithProviders(<WorkflowDetailScreen />);
    const card = await screen.findByTestId('email-card');
    expect(within(card).getByText('Sent')).toBeTruthy();
    expect(within(card).getByText('Delivered to j***@example.com via Resend.')).toBeTruthy();
  });

  test('timeline summaries describe interview and email outputs', () => {
    const s = summarizeOutputs({ interview_agent: kit, email_agent: { template_id: 'rejection', delivery: 'not_configured' } });
    expect(s.interview_agent).toBe('2 questions, 1 coding tasks (AI-generated)');
    expect(s.email_agent).toBe('rejection: not sent (email delivery not configured)');
  });
});
