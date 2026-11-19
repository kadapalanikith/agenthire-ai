import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import PublicJobScreen from '../../app/jobs/[jobId]/index';
import ApplyScreen from '../../app/jobs/[jobId]/apply';
import ApplicationStatusScreen from '../../app/applications/[statusToken]';
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

const JOB_ID = 'c'.repeat(24);
const TOKEN = 'd'.repeat(64);
const publicJob = {
  id: JOB_ID,
  title: 'Frontend Developer',
  description: 'Build accessible interfaces for our recruiter console.',
  required_skills: ['React', 'JavaScript'],
  preferred_skills: ['Next.js'],
  min_experience: 2,
  status: 'open',
  created_at: '2026-11-19T08:00:00.000Z',
};
const policy = [200, { success: true, data: { version: '1.1.0', max_size_bytes: 5242880, allowed_mime_types: ['application/pdf'], allowed_extensions: ['.pdf'] } }];
const pdfAsset = { uri: 'file:///cache/Jane-CV.pdf', name: 'Jane-CV.pdf', size: 48213, mimeType: 'application/pdf' };

beforeEach(() => {
  jest.clearAllMocks();
  // Candidates are anonymous: the client must not send a recruiter token.
  configureApiClient({ baseUrl: 'http://api.test', getToken: () => null });
});

async function fillForm() {
  await fireEvent.changeText(screen.getByTestId('apply-name'), 'Jane Doe');
  await fireEvent.changeText(screen.getByTestId('apply-email'), 'jane@example.com');
  await fireEvent.changeText(screen.getByTestId('apply-phone'), '+1 555 123 4567');
}

describe('public job page', () => {
  test('shows the job and an apply button without authentication', async () => {
    useLocalSearchParams.mockReturnValue({ jobId: JOB_ID });
    mockApi({ [`GET /jobs/${JOB_ID}`]: [200, { success: true, data: { job: publicJob, can_manage: false } }] });
    await renderWithProviders(<PublicJobScreen />);
    expect(await screen.findByTestId('public-job-title')).toBeTruthy();
    expect(screen.getByText('Accepting applications')).toBeTruthy();
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    await fireEvent.press(screen.getByTestId('apply-now'));
    expect(router.push).toHaveBeenCalledWith(`/jobs/${JOB_ID}/apply`);
  });

  test('closed jobs show a notice and no apply button', async () => {
    useLocalSearchParams.mockReturnValue({ jobId: JOB_ID });
    mockApi({ [`GET /jobs/${JOB_ID}`]: [200, { success: true, data: { job: { ...publicJob, status: 'closed' }, can_manage: false } }] });
    await renderWithProviders(<PublicJobScreen />);
    expect(await screen.findByText('This job is closed')).toBeTruthy();
    expect(screen.queryByTestId('apply-now')).toBeNull();
  });

  test('unknown jobs show a not-found state', async () => {
    useLocalSearchParams.mockReturnValue({ jobId: JOB_ID });
    mockApi({ [`GET /jobs/${JOB_ID}`]: [404, { success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } }] });
    await renderWithProviders(<PublicJobScreen />);
    expect(await screen.findByText('Job not found')).toBeTruthy();
  });
});

describe('apply page', () => {
  beforeEach(() => useLocalSearchParams.mockReturnValue({ jobId: JOB_ID }));

  test('uploads the form and PDF as multipart and opens the status page', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset] });
    mockApi({
      [`GET /jobs/${JOB_ID}`]: [200, { success: true, data: { job: publicJob, can_manage: false } }],
      'GET /meta/upload-policy': policy,
      'POST /candidates/upload': [
        201,
        { success: true, data: { candidate_id: 'x', status_token: TOKEN, status: 'applied', stage: 'received', workflow: { status: 'pending' } } },
      ],
    });
    await renderWithProviders(<ApplyScreen />);
    await screen.findByTestId('apply-job-title');
    await fillForm();
    await fireEvent.press(screen.getByTestId('resume-pick'));
    expect(await screen.findByText('Jane-CV.pdf')).toBeTruthy();
    expect(screen.getByText('47 KB')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('apply-submit'));

    await waitFor(() => expect(callsTo('POST /candidates/upload')).toHaveLength(1));
    const [, init] = callsTo('POST /candidates/upload')[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined(); // boundary set by the platform
    expect(init.headers.Authorization).toBeUndefined();
    const parts = Object.fromEntries(init.body.getParts().map((p) => [p.fieldName, p.string ?? p]));
    expect(parts).toMatchObject({ job_id: JOB_ID, name: 'Jane Doe', email: 'jane@example.com', phone: '+1 555 123 4567' });
    expect(parts.resume).toMatchObject({ uri: pdfAsset.uri, type: 'application/pdf' });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/applications/${TOKEN}?submitted=1`));
  });

  test('requires a resume and blocks non-PDF picks before uploading', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ ...pdfAsset, name: 'cv.docx', mimeType: 'application/msword' }] });
    mockApi({
      [`GET /jobs/${JOB_ID}`]: [200, { success: true, data: { job: publicJob, can_manage: false } }],
      'GET /meta/upload-policy': policy,
    });
    await renderWithProviders(<ApplyScreen />);
    await screen.findByTestId('apply-job-title');
    await fillForm();
    await fireEvent.press(screen.getByTestId('apply-submit'));
    expect(await screen.findByText('Attach your resume as a PDF')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('resume-pick'));
    expect(await screen.findByText('Resume must be a PDF file')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('apply-submit'));
    expect(callsTo('POST /candidates/upload')).toHaveLength(0);
  });

  test('shows server-side file and duplicate errors', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset] });
    const responses = [
      [400, { success: false, error: { code: 'INVALID_PDF', message: 'The uploaded file is not a PDF' } }],
      [409, { success: false, error: { code: 'ALREADY_APPLIED', message: 'You have already applied for this job with this email address' } }],
    ];
    mockApi({
      [`GET /jobs/${JOB_ID}`]: [200, { success: true, data: { job: publicJob, can_manage: false } }],
      'GET /meta/upload-policy': policy,
      'POST /candidates/upload': () => responses.shift(),
    });
    await renderWithProviders(<ApplyScreen />);
    await screen.findByTestId('apply-job-title');
    await fillForm();
    await fireEvent.press(screen.getByTestId('resume-pick'));
    await screen.findByText('Jane-CV.pdf');
    await fireEvent.press(screen.getByTestId('apply-submit'));
    expect(await screen.findByText('The uploaded file is not a PDF')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('apply-submit'));
    expect(await screen.findByText('Already applied')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('application status page', () => {
  test('shows confirmation and the real stage from the API', async () => {
    useLocalSearchParams.mockReturnValue({ statusToken: TOKEN, submitted: '1' });
    mockApi({
      [`GET /candidates/status/${TOKEN}`]: [
        200,
        { success: true, data: { applicant_name: 'Jane', job: { id: JOB_ID, title: 'Frontend Developer' }, stage: 'received', submitted_at: '2026-11-19T08:00:00.000Z' } },
      ],
    });
    await renderWithProviders(<ApplicationStatusScreen />);
    expect(await screen.findByText('Application submitted')).toBeTruthy();
    expect(screen.getByText(/Thanks, Jane/)).toBeTruthy();
    expect(screen.getByTestId('status-job-title')).toBeTruthy();
    expect(screen.getByText('Your details and resume were submitted.')).toBeTruthy();
  });

  test('invalid links show a not-found state', async () => {
    useLocalSearchParams.mockReturnValue({ statusToken: TOKEN });
    mockApi({ [`GET /candidates/status/${TOKEN}`]: [404, { success: false, error: { code: 'NOT_FOUND', message: 'nope' } }] });
    await renderWithProviders(<ApplicationStatusScreen />);
    expect(await screen.findByText('Application not found')).toBeTruthy();
  });
});
