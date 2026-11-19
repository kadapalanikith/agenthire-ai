import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowsApi } from '../../api/workflows';
import { systemApi } from '../../api/system';

export const workflowKeys = {
  all: ['workflows'],
  list: (filters) => ['workflows', 'list', filters],
  detail: (id) => ['workflows', 'detail', id],
  spec: ['meta', 'workflow-spec'],
};

const ACTIVE = ['pending', 'running'];
const DETAIL_POLL_MS = 2500;
const LIST_POLL_MS = 5000;

/** Workflow order, node labels, node-state colours and approval rules from /specs. */
export function useWorkflowSpec() {
  return useQuery({ queryKey: workflowKeys.spec, queryFn: systemApi.workflowSpec, staleTime: 30 * 60 * 1000 });
}

/**
 * Real backend state, refreshed by polling while a run is active (stops at
 * the approval checkpoint and at terminal states). No progress is simulated.
 */
export function useWorkflow(id) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: () => workflowsApi.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) => (ACTIVE.includes(query.state.data?.workflow?.status) ? DETAIL_POLL_MS : false),
  });
}

export function useWorkflows({ status } = {}) {
  return useInfiniteQuery({
    queryKey: workflowKeys.list({ status: status || 'all' }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => workflowsApi.list({ status, page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    select: (data) => ({ workflows: data.pages.flatMap((p) => p.data.workflows), total: data.pages[0]?.meta.total ?? 0 }),
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.data.workflows.some((w) => ACTIVE.includes(w.status))) ? LIST_POLL_MS : false,
  });
}

function useInvalidateAfterAction() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    queryClient.invalidateQueries({ queryKey: ['candidates'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useApproveWorkflow(workflowId) {
  const invalidate = useInvalidateAfterAction();
  return useMutation({
    mutationFn: ({ decision, reason }) => workflowsApi.approve({ workflowId, decision, reason }),
    onSuccess: invalidate,
  });
}

export function useRetryWorkflow(workflowId) {
  const invalidate = useInvalidateAfterAction();
  return useMutation({ mutationFn: () => workflowsApi.retry(workflowId), onSuccess: invalidate });
}
