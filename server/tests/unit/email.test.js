'use strict';

const { renderTemplate } = require('../../src/emails/renderTemplate');

describe('email template rendering', () => {
  test('fills declared variables from the spec template', () => {
    const out = renderTemplate('rejection', { candidate_name: 'Ada', job_title: 'Frontend Developer', company_name: 'Acme' });
    expect(out.subject).toBe('Your application for Frontend Developer');
    expect(out.text).toContain('Hi Ada');
    expect(out.text).toContain('Acme Recruiting');
    expect(out.template_version).toBe('1.0.0');
  });

  test('fails when a variable is missing', () => {
    expect(() => renderTemplate('rejection', { candidate_name: 'Ada' })).toThrow(/missing variables: job_title, company_name/);
  });

  test('prevents header injection through the subject', () => {
    const out = renderTemplate('interview-invite', {
      candidate_name: 'A',
      job_title: 'Dev\r\nBcc: attacker@example.com',
      company_name: 'Acme',
    });
    expect(out.subject).not.toMatch(/[\r\n]/);
  });
});

describe('email delivery', () => {
  const variables = { user_name: 'Ada', reset_url: 'http://localhost/reset', ttl_minutes: 30 };

  function loadService(env) {
    let service;
    jest.isolateModules(() => {
      Object.assign(process.env, env);
      service = require('../../src/emails/emailService');
    });
    return service;
  }

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  test('reports not_configured (never "sent") when RESEND_API_KEY is missing', async () => {
    const service = loadService({});
    const result = await service.sendTemplatedEmail({ to: 'a@example.com', templateId: 'password-reset', variables });
    expect(result.delivery).toBe('not_configured');
    expect(result.provider_id).toBeUndefined();
    expect(service.isEmailConfigured()).toBe(false);
  });

  test('sends through Resend and returns the provider id', async () => {
    const service = loadService({ RESEND_API_KEY: 're_test_key' });
    const send = jest.fn().mockResolvedValue({ data: { id: 'email_123' }, error: null });
    service.setEmailClient({ emails: { send } });
    const result = await service.sendTemplatedEmail({
      to: 'a@example.com',
      templateId: 'password-reset',
      variables,
      idempotencyKey: 'key-1',
    });
    expect(result).toMatchObject({ delivery: 'sent', provider_id: 'email_123', template_id: 'password-reset' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@example.com'] }), { idempotencyKey: 'key-1' });
  });

  test('throws a retryable error when the provider rejects', async () => {
    const service = loadService({ RESEND_API_KEY: 're_test_key' });
    service.setEmailClient({ emails: { send: jest.fn().mockResolvedValue({ data: null, error: { message: 'rate limited' } }) } });
    await expect(
      service.sendTemplatedEmail({ to: 'a@example.com', templateId: 'password-reset', variables })
    ).rejects.toMatchObject({ code: 'EMAIL_API_FAILURE', retryable: true });
  });
});
