import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { candidatesApi } from '../../api/candidates';

export const candidateKeys = {
  all: ['candidates'],
  list: (filters) => ['candidates', 'list', filters],
  detail: (id) => ['candidates', 'detail', id],
};

const PAGE_SIZE = 20;

export function useCandidates({ jobId, status, q } = {}) {
  return useInfiniteQuery({
    queryKey: candidateKeys.list({ jobId: jobId || 'all', status: status || 'all', q: q || '' }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => candidatesApi.list({ job_id: jobId, status, q, page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    select: (data) => ({
      candidates: data.pages.flatMap((p) => p.data.candidates),
      total: data.pages[0]?.meta.total ?? 0,
    }),
  });
}

export function useCandidate(id) {
  return useQuery({
    queryKey: candidateKeys.detail(id),
    queryFn: () => candidatesApi.get(id),
    enabled: Boolean(id),
    select: (d) => d.candidate,
  });
}

/**
 * Open the resume PDF via a short-lived signed link. Native: in-app browser.
 * Web: a tab is opened synchronously (so popup blockers allow it) and pointed
 * at the link once it has been issued.
 */
export function useOpenResume(candidateId) {
  const [state, setState] = useState({ loading: false, error: null });

  const open = useCallback(async () => {
    setState({ loading: true, error: null });
    const tab = Platform.OS === 'web' && typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const { url } = await candidatesApi.resumeUrl(candidateId);
      if (tab) tab.location.href = url;
      else if (Platform.OS === 'web') window.location.assign(url);
      else await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      setState({ loading: false, error: null });
    } catch (err) {
      if (tab) tab.close();
      setState({ loading: false, error: err });
    }
  }, [candidateId]);

  return { open, ...state };
}
