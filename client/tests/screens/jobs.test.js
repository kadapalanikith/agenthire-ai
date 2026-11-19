import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import JobsListScreen from '../../app/(recruiter)/dashboard/jobs/index';
import CreateJobScreen from '../../app/(recruiter)/dashboard/jobs/create';
import { configureApiClient } from '../../src/api/client';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { callsTo, mockApi } from '../helpers/mockApi';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Link: ({ children }) => <Text>{children}</Text>,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
    useLocalSearchParams: jest.fn(() => ({})),
  };
});

const job = {
  id: 'b'.repeat(24),
  title: 'Frontend Developer',
  description: 'Build accessible interfaces for our recruiter console.',
  required_skills: ['React', 'JavaScript', 'CSS', 'HTML', 'Git'],
  preferred_skills: ['Next.js'],
  min_experience: 2,
  status: 'open',
  created_at: '2026-11-19T08:00:00.000Z',
  apply_url: `http://localhost:8081/jobs/${'b'.repeat(24)}/apply`,
};

const page = (jobs, total = jobs.length) => [200, { success: true, data: { jobs }, meta: { page: 1, limit: 20, total, total_pages: 1 } }];

beforeEach(() => {
  jest.clearAllMocks();
  configureApiClient({ baseUrl: 'http://api.test', getToken: () => 'jwt' });
});

describe('Jobs list screen', () => {
  test('lists the recruiter’s jobs from the API with overflow skill chip', async () => {
    mockApi({ 'GET /jobs': page([job]) });
    await renderWithProviders(<JobsListScreen />);
    expect(await screen.findByText('Frontend Developer')).toBeTruthy();
    expect(screen.getByText('1 job')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('scope=mine');
    expect(init.headers.Authorization).toBe('Bearer jwt');
  });

  test('copies the public apply link from a card', async () => {
    mockApi({ 'GET /jobs': page([job]) });
    await renderWithProviders(<JobsListScreen />);
    await fireEvent.press(await screen.findByTestId(`copy-link-${job.id}`));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(job.apply_url);
    expect(await screen.findByText('Copied')).toBeTruthy();
  });

  test('shows an empty state for a new recruiter', async () => {
    mockApi({ 'GET /jobs': page([]) });
    await renderWithProviders(<JobsListScreen />);
    expect(await screen.findByText('Create your first job')).toBeTruthy();
  });

  test('filters by status through the API', async () => {
    mockApi({ 'GET /jobs': page([]) });
    await renderWithProviders(<JobsListScreen />);
    await screen.findByText('Create your first job');
    await fireEvent.press(screen.getByTestId('jobs-filter-closed'));
    await waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u.includes('status=closed'))).toBe(true));
    expect(await screen.findByText('No matching jobs')).toBeTruthy();
  });

  test('shows an error state with retry when the API is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<JobsListScreen />);
    expect(await screen.findByText('You appear to be offline')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});

describe('Create job screen', () => {
  const specs = [
    200,
    {
      success: true,
      data: {
        hiring_specs: [
          {
            id: 'frontend-developer',
            role: 'Frontend Developer',
            required_skills: ['React', 'JavaScript', 'CSS'],
            preferred_skills: ['Next.js', 'Tailwind CSS'],
            minimum_score: 75,
            interview_rounds: 2,
          },
        ],
      },
    },
  ];

  test('prefills skills from the selected role spec and submits the job', async () => {
    mockApi({
      'GET /meta/hiring-specs': specs,
      'POST /jobs': (_url, init) => [201, { success: true, data: { job: { ...job, ...JSON.parse(init.body), id: job.id } } }],
    });
    await renderWithProviders(<CreateJobScreen />);

    await fireEvent.press(await screen.findByTestId('spec-frontend-developer'));
    expect(screen.getByTestId('required-skills-chip-React')).toBeTruthy();
    expect(screen.getByTestId('preferred-skills-chip-Next.js')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('job-title'), 'Frontend Developer');
    await fireEvent.changeText(screen.getByTestId('job-description'), 'Build accessible interfaces for our recruiter console.');
    await fireEvent.changeText(screen.getByTestId('job-min-experience'), '2');
    await fireEvent.press(screen.getByTestId('preferred-skills-chip-Tailwind CSS-remove'));
    await fireEvent.changeText(screen.getByTestId('required-skills'), 'TypeScript');
    await fireEvent.press(screen.getByTestId('required-skills-add'));
    await fireEvent.press(screen.getByTestId('job-submit'));

    await waitFor(() => expect(callsTo('POST /jobs')).toHaveLength(1));
    expect(JSON.parse(callsTo('POST /jobs')[0][1].body)).toEqual({
      title: 'Frontend Developer',
      description: 'Build accessible interfaces for our recruiter console.',
      hiring_spec_id: 'frontend-developer',
      required_skills: ['React', 'JavaScript', 'CSS', 'TypeScript'],
      preferred_skills: ['Next.js'],
      min_experience: 2,
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/dashboard/jobs/${job.id}`));
  });

  test('blocks submission with client validation errors', async () => {
    mockApi({ 'GET /meta/hiring-specs': specs });
    await renderWithProviders(<CreateJobScreen />);
    await screen.findByTestId('spec-frontend-developer');
    await fireEvent.press(screen.getByTestId('job-submit'));
    expect(await screen.findByText('Add at least one required skill')).toBeTruthy();
    expect(callsTo('POST /jobs')).toHaveLength(0);
  });

  test('maps server validation errors onto fields', async () => {
    mockApi({
      'GET /meta/hiring-specs': specs,
      'POST /jobs': [
        400,
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [{ path: 'title', message: 'Title is taken by the server' }] },
        },
      ],
    });
    await renderWithProviders(<CreateJobScreen />);
    await fireEvent.press(await screen.findByTestId('spec-frontend-developer'));
    await fireEvent.changeText(screen.getByTestId('job-title'), 'Frontend Developer');
    await fireEvent.changeText(screen.getByTestId('job-description'), 'Build accessible interfaces for our recruiter console.');
    await fireEvent.changeText(screen.getByTestId('job-min-experience'), '1');
    await fireEvent.press(screen.getByTestId('job-submit'));
    expect(await screen.findByText('Title is taken by the server')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
