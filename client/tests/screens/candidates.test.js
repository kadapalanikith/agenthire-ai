import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import CandidatesListScreen from '../../app/(recruiter)/dashboard/candidates/index';
import CandidateDetailScreen from '../../app/(recruiter)/dashboard/candidates/[candidateId]';
import { configureApiClient } from '../../src/api/client';
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

const CID = 'e'.repeat(24);
const candidate = {
  id: CID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 555 123 4567',
  status: 'applied',
  match_score: null,
  created_at: '2026-11-19T08:00:00.000Z',
  resume_file: { original_name: 'Jane-CV.pdf', size_bytes: 48213, mime_type: 'application/pdf' },
  job: { id: 'j'.repeat(24), title: 'Frontend Developer', status: 'open' },
  workflow: { id: 'w'.repeat(24), status: 'pending', current_state: null, retry_count: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
  configureApiClient({ baseUrl: 'http://api.test', getToken: () => 'jwt' });
});

describe('candidates list', () => {
  test('shows candidates with status and an honest "not scored" label', async () => {
    useLocalSearchParams.mockReturnValue({});
    mockApi({ 'GET /candidates': [200, { success: true, data: { candidates: [candidate] }, meta: { page: 1, limit: 20, total: 1, total_pages: 1 } }] });
    await renderWithProviders(<CandidatesListScreen />);
    expect(await screen.findByText('Jane Doe')).toBeTruthy();
    const card = screen.getByTestId(`candidate-card-${CID}`);
    expect(within(card).getByText('Applied')).toBeTruthy();
    expect(within(card).getByText('Not scored yet')).toBeTruthy();
    expect(screen.getByText(/Frontend Developer/)).toBeTruthy();
  });

  test('passes the job filter from the route and status filters to the API', async () => {
    useLocalSearchParams.mockReturnValue({ jobId: 'j'.repeat(24) });
    mockApi({
      'GET /candidates': [200, { success: true, data: { candidates: [] }, meta: { page: 1, limit: 20, total: 0, total_pages: 1 } }],
      [`GET /jobs/${'j'.repeat(24)}`]: [200, { success: true, data: { job: { title: 'Frontend Developer' }, can_manage: true } }],
    });
    await renderWithProviders(<CandidatesListScreen />);
    await screen.findByText('No matching candidates');
    expect(global.fetch.mock.calls.some(([u]) => u.includes(`job_id=${'j'.repeat(24)}`))).toBe(true);
    await fireEvent.press(screen.getByTestId('candidate-filter-awaiting_review'));
    await waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u.includes('status=awaiting_review'))).toBe(true));
  });

  test('empty workspace explains how candidates arrive', async () => {
    useLocalSearchParams.mockReturnValue({});
    mockApi({ 'GET /candidates': [200, { success: true, data: { candidates: [] }, meta: { page: 1, limit: 20, total: 0, total_pages: 1 } }] });
    await renderWithProviders(<CandidatesListScreen />);
    expect(await screen.findByText('No candidates yet')).toBeTruthy();
  });
});

describe('candidate detail', () => {
  test('shows contact, job, resume and a pending screening state', async () => {
    useLocalSearchParams.mockReturnValue({ candidateId: CID });
    mockApi({ [`GET /candidates/${CID}`]: [200, { success: true, data: { candidate } }] });
    await renderWithProviders(<CandidateDetailScreen />);
    expect(await screen.findByTestId('candidate-name')).toBeTruthy();
    expect(screen.getByText('jane@example.com')).toBeTruthy();
    expect(screen.getByText('Jane-CV.pdf · 47 KB')).toBeTruthy();
    expect(screen.getByText('Queued')).toBeTruthy();
    expect(screen.getByTestId('screening-pending')).toBeTruthy();
  });

  test('opens the resume through a short-lived signed link', async () => {
    useLocalSearchParams.mockReturnValue({ candidateId: CID });
    mockApi({
      [`GET /candidates/${CID}`]: [200, { success: true, data: { candidate } }],
      [`GET /candidates/${CID}/resume-link`]: [
        200,
        { success: true, data: { path: `/candidates/${CID}/resume?access=signed`, expires_at: '2026-11-19T08:05:00.000Z' } },
      ],
    });
    await renderWithProviders(<CandidateDetailScreen />);
    await fireEvent.press(await screen.findByTestId('view-resume'));
    await waitFor(() =>
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(`http://api.test/candidates/${CID}/resume?access=signed`, expect.any(Object))
    );
  });

  test('shows a not-found state for inaccessible candidates', async () => {
    useLocalSearchParams.mockReturnValue({ candidateId: CID });
    mockApi({ [`GET /candidates/${CID}`]: [404, { success: false, error: { code: 'NOT_FOUND', message: 'Candidate not found' } }] });
    await renderWithProviders(<CandidateDetailScreen />);
    expect((await screen.findAllByText('Candidate not found')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('view-resume')).toBeNull();
  });
});
