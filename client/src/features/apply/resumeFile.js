import { Platform } from 'react-native';

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check a picked file against the server upload policy (GET /meta/upload-policy).
 * Returns an error message, or null when the file is acceptable. The server
 * re-validates the actual bytes.
 */
export function validateResumeFile(asset, policy) {
  if (!asset) return 'Attach your resume as a PDF';
  const name = (asset.name || '').toLowerCase();
  const extOk = policy ? policy.allowed_extensions.some((ext) => name.endsWith(ext)) : name.endsWith('.pdf');
  const mimeOk = !asset.mimeType || (policy ? policy.allowed_mime_types.includes(asset.mimeType) : asset.mimeType === 'application/pdf');
  if (!extOk || !mimeOk) return 'Resume must be a PDF file';
  if (policy && Number.isFinite(asset.size) && asset.size > policy.max_size_bytes) {
    return `Resume must be ${formatBytes(policy.max_size_bytes)} or smaller`;
  }
  if (asset.size === 0) return 'The selected file is empty';
  return null;
}

/** Build the multipart body for POST /candidates/upload on web and native. */
export function buildApplicationFormData({ jobId, name, email, phone }, asset) {
  const form = new FormData();
  form.append('job_id', jobId);
  form.append('name', name);
  form.append('email', email);
  form.append('phone', phone);
  if (Platform.OS === 'web' && asset.file) {
    form.append('resume', asset.file, asset.name);
  } else {
    // React Native's FormData streams the file from its local URI.
    form.append('resume', { uri: asset.uri, name: asset.name || 'resume.pdf', type: 'application/pdf' });
  }
  return form;
}
