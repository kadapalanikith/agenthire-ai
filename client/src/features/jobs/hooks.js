import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../../api/jobs';
import { dashboardApi } from '../../api/dashboard';

export const jobKeys = {
  all: ['jobs'],
  mine: (filters) => ['jobs', 'mine', filters],
  detail: (id) => ['jobs', 'detail', id],
};

export const dashboardKeys = {
  summary: ['dashboard', 'summary'],
  hiringSpecs: ['meta', 'hiring-specs'],
};

const PAGE_SIZE = 20;

/** Recruiter's own jobs, paginated for infinite scrolling. */
export function useMyJobs({ status, q } = {}) {
  return useInfiniteQuery({
    queryKey: jobKeys.mine({ status: status || 'all', q: q || '' }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => jobsApi.list({ scope: 'mine', status, q, page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    select: (data) => ({
      jobs: data.pages.flatMap((p) => p.data.jobs),
      total: data.pages[0]?.meta.total ?? 0,
    }),
  });
}

export function useJob(id) {
  return useQuery({ queryKey: jobKeys.detail(id), queryFn: () => jobsApi.get(id), enabled: Boolean(id) });
}

export function useHiringSpecs() {
  return useQuery({
    queryKey: dashboardKeys.hiringSpecs,
    queryFn: dashboardApi.hiringSpecs,
    staleTime: 10 * 60 * 1000,
    select: (d) => d.hiring_specs,
  });
}

export function useDashboardSummary() {
  return useQuery({ queryKey: dashboardKeys.summary, queryFn: dashboardApi.summary });
}

function useInvalidateJobs() {
  const queryClient = useQueryClient();
  return (job) => {
    if (job) queryClient.setQueryData(jobKeys.detail(job.id), { job, can_manage: true });
    queryClient.invalidateQueries({ queryKey: jobKeys.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateJob() {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: (payload) => jobsApi.create(payload),
    onSuccess: ({ job }) => invalidate(job),
  });
}

export function useUpdateJob(id) {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: (payload) => jobsApi.update(id, payload),
    onSuccess: ({ job }) => invalidate(job),
  });
}
