import { useMutation, useQuery } from '@tanstack/react-query';
import { candidatesApi } from '../../api/candidates';
import { jobsApi } from '../../api/jobs';
import { systemApi } from '../../api/system';

export const applyKeys = {
  job: (id) => ['public', 'job', id],
  uploadPolicy: ['meta', 'upload-policy'],
  status: (token) => ['public', 'application-status', token],
};

const STATUS_POLL_MS = 15 * 1000;

export function usePublicJob(jobId) {
  return useQuery({
    queryKey: applyKeys.job(jobId),
    queryFn: () => jobsApi.getPublic(jobId),
    enabled: Boolean(jobId),
    select: (d) => d.job,
  });
}

export function useUploadPolicy() {
  return useQuery({ queryKey: applyKeys.uploadPolicy, queryFn: systemApi.uploadPolicy, staleTime: 60 * 60 * 1000 });
}

export function useSubmitApplication() {
  return useMutation({ mutationFn: (formData) => candidatesApi.apply(formData) });
}

/** Public status; polls until a decision has been made. */
export function useApplicationStatus(token) {
  return useQuery({
    queryKey: applyKeys.status(token),
    queryFn: () => candidatesApi.status(token),
    enabled: Boolean(token),
    refetchInterval: (query) => (query.state.data?.stage === 'decision_made' ? false : STATUS_POLL_MS),
  });
}
