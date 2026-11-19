import { buildApplicationFormData, formatBytes, validateResumeFile } from '../../src/features/apply/resumeFile';
import { applicationSchema } from '../../src/features/apply/schemas';

const policy = { max_size_bytes: 5242880, allowed_mime_types: ['application/pdf'], allowed_extensions: ['.pdf'] };

describe('resume file validation (mirrors GET /meta/upload-policy)', () => {
  test('accepts a PDF within the size limit', () => {
    expect(validateResumeFile({ name: 'cv.PDF', mimeType: 'application/pdf', size: 1000 }, policy)).toBeNull();
  });

  test('requires a file', () => {
    expect(validateResumeFile(null, policy)).toBe('Attach your resume as a PDF');
  });

  test('rejects other types by extension or MIME type', () => {
    expect(validateResumeFile({ name: 'cv.docx', mimeType: 'application/pdf', size: 10 }, policy)).toBe('Resume must be a PDF file');
    expect(validateResumeFile({ name: 'cv.pdf', mimeType: 'image/png', size: 10 }, policy)).toBe('Resume must be a PDF file');
  });

  test('rejects files over the policy limit and empty files', () => {
    expect(validateResumeFile({ name: 'cv.pdf', mimeType: 'application/pdf', size: 6 * 1024 * 1024 }, policy)).toBe('Resume must be 5.0 MB or smaller');
    expect(validateResumeFile({ name: 'cv.pdf', mimeType: 'application/pdf', size: 0 }, policy)).toBe('The selected file is empty');
  });

  test('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5242880)).toBe('5.0 MB');
  });

  test('builds the multipart body with the native file descriptor', () => {
    const form = buildApplicationFormData(
      { jobId: 'job1', name: 'Jane', email: 'j@example.com', phone: '+15551234567' },
      { uri: 'file:///cache/cv.pdf', name: 'cv.pdf', size: 100 }
    );
    const parts = form.getParts();
    expect(parts.map((p) => p.fieldName)).toEqual(['job_id', 'name', 'email', 'phone', 'resume']);
    expect(parts[4]).toMatchObject({ uri: 'file:///cache/cv.pdf', name: 'cv.pdf', type: 'application/pdf' });
  });
});

describe('application form schema', () => {
  test('validates name, email and phone', () => {
    expect(applicationSchema.safeParse({ name: 'Jane Doe', email: 'jane@example.com', phone: '+1 (555) 123-4567' }).success).toBe(true);
    const bad = applicationSchema.safeParse({ name: 'J', email: 'x', phone: '123' });
    expect(bad.error.issues.map((i) => i.path[0]).sort()).toEqual(['email', 'name', 'phone']);
  });
});
